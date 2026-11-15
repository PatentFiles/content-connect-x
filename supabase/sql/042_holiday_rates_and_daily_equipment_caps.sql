CREATE OR REPLACE FUNCTION public.ccx_hosting_price_quote(
 p_property uuid,p_start timestamptz,p_end timestamptz,
 p_crew integer,p_use text,p_addons jsonb DEFAULT '[]'::jsonb,
 p_bundle uuid DEFAULT NULL,p_discount_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 prop public.properties%rowtype;
 slot timestamptz;
 local_date date;
 multiplier integer;
 item jsonb;
 asset public.hosting_addons%rowtype;
 bundle public.hosting_addon_bundles%rowtype;
 bundle_line record;
 duration_quarters integer;
 booking_cents bigint:=0;
 addon_cents bigint:=0;
 discount_cents bigint:=0;
 cleaning_cents bigint;
 bundle_discount integer:=0;
 discount_record public.hosting_discount_codes%rowtype;
 price_cents bigint;
 qty integer;
 lines jsonb:='[]'::jsonb;
 asset_counts jsonb:='{}'::jsonb;
 label text;
 rate_kind text;
 BEGIN
 SELECT * INTO prop FROM public.properties WHERE id=p_property AND status='active' AND approved_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved listing unavailable'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_start<=now()
  OR p_end<=p_start OR p_end-p_start>interval '72 hours'
  OR p_start<now()+make_interval(hours=>prop.min_notice_hours)
  OR p_crew<1 OR p_crew>prop.capacity OR p_use<>ALL(prop.permitted_uses)
  OR p_start<>date_trunc('minute',p_start) OR p_end<>date_trunc('minute',p_end)
  OR extract(minute FROM p_start)::integer%15<>0 OR extract(minute FROM p_end)::integer%15<>0
 THEN RAISE EXCEPTION 'Quote violates venue notice, crew, permitted use or 15-minute booking increments'; END IF;
 duration_quarters:=extract(epoch FROM (p_end-p_start))::integer/900;
 IF duration_quarters < prop.minimum_hours*4 THEN RAISE EXCEPTION 'Minimum rental duration not met'; END IF;
 IF jsonb_typeof(p_addons)<>'array' OR jsonb_array_length(p_addons)>25 THEN
  RAISE EXCEPTION 'Add-on list must contain up to 25 items';
 END IF;
 -- 15-minute slots allow weekend/seasonal/holiday tiers per local calendar date.
 FOR slot IN SELECT generate_series(p_start,p_end-interval '15 minutes',interval '15 minutes') LOOP
  local_date:=(slot AT TIME ZONE prop.timezone)::date;
  multiplier:=CASE WHEN extract(isodow FROM slot AT TIME ZONE prop.timezone) IN (6,7)
    THEN prop.weekend_bps ELSE 10000 END;
  SELECT r.multiplier_bps,r.kind INTO multiplier,rate_kind FROM public.hosting_seasonal_rates r
   WHERE r.property_id=p_property AND local_date BETWEEN r.starts_on AND r.ends_on
   ORDER BY CASE r.kind WHEN 'holiday' THEN 3 WHEN 'seasonal' THEN 2 ELSE 1 END DESC,r.created_at DESC
   LIMIT 1;
  multiplier:=coalesce(multiplier,CASE WHEN extract(isodow FROM slot AT TIME ZONE prop.timezone) IN (6,7)
    THEN prop.weekend_bps ELSE 10000 END);
  IF rate_kind='holiday' THEN multiplier:=round(multiplier*prop.holiday_bps/10000.0)::integer; END IF;
  rate_kind:=NULL;
  booking_cents:=booking_cents+round(prop.hourly_rate*100*multiplier/40000.0)::bigint;
 END LOOP;
 cleaning_cents:=prop.cleaning_fee_cents;
 FOR item IN SELECT value FROM jsonb_array_elements(p_addons) LOOP
  IF NOT (item ? 'id') OR NOT (item ? 'quantity') OR (item->>'id') !~
   '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
   RAISE EXCEPTION 'Invalid add-on identifier'; END IF;
  qty:=(item->>'quantity')::integer;
  IF qty<1 OR qty>1000 THEN RAISE EXCEPTION 'Invalid add-on quantity'; END IF;
  IF asset_counts ? (item->>'id') THEN RAISE EXCEPTION 'Duplicate add-on selected'; END IF;
  SELECT * INTO asset FROM public.hosting_addons WHERE id=(item->>'id')::uuid
   AND property_id=p_property AND active AND condition NOT IN ('maintenance','retired');
  IF NOT FOUND OR qty>asset.quantity THEN RAISE EXCEPTION 'Unavailable add-on'; END IF;
  asset_counts:=asset_counts||jsonb_build_object(asset.id::text,qty);
  price_cents:=(CASE WHEN asset.daily_cents IS NOT NULL THEN LEAST(round(asset.hourly_cents*duration_quarters/4.0)::bigint,asset.daily_cents*ceil(duration_quarters/96.0)::bigint) ELSE round(asset.hourly_cents*duration_quarters/4.0)::bigint END)*qty;
  addon_cents:=addon_cents+price_cents;
  lines:=lines||jsonb_build_array(jsonb_build_object('id',asset.id,'quantity',qty,
   'label',asset.label,'hourly_cents',asset.hourly_cents,'total_cents',price_cents));
 END LOOP;
 IF p_bundle IS NOT NULL THEN
  SELECT * INTO bundle FROM public.hosting_addon_bundles
   WHERE id=p_bundle AND property_id=p_property AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle unavailable'; END IF;
  bundle_discount:=bundle.discount_bps;
  FOR bundle_line IN SELECT addon_id,quantity FROM public.hosting_bundle_items WHERE bundle_id=bundle.id LOOP
   SELECT * INTO asset FROM public.hosting_addons WHERE id=bundle_line.addon_id
    AND property_id=p_property AND active AND condition NOT IN ('maintenance','retired');
   IF NOT FOUND THEN RAISE EXCEPTION 'Bundle item unavailable'; END IF;
   qty:=bundle_line.quantity+coalesce((asset_counts->>asset.id::text)::integer,0);
   IF qty>asset.quantity THEN RAISE EXCEPTION 'Not enough bundle inventory'; END IF;
   asset_counts:=asset_counts||jsonb_build_object(asset.id::text,qty);
   price_cents:=(CASE WHEN asset.daily_cents IS NOT NULL THEN LEAST(round(asset.hourly_cents*duration_quarters/4.0)::bigint,asset.daily_cents*ceil(duration_quarters/96.0)::bigint) ELSE round(asset.hourly_cents*duration_quarters/4.0)::bigint END)*bundle_line.quantity;
   addon_cents:=addon_cents+price_cents;
   lines:=lines||jsonb_build_array(jsonb_build_object('id',asset.id,'quantity',bundle_line.quantity,
     'label',asset.label,'hourly_cents',asset.hourly_cents,'total_cents',price_cents));
  END LOOP;
 END IF;
 discount_cents:=round(addon_cents*bundle_discount/10000.0)::bigint;
 IF p_discount_hash IS NOT NULL THEN
  SELECT * INTO discount_record FROM public.hosting_discount_codes d
   WHERE d.property_id=p_property AND d.code_sha256=p_discount_hash AND d.active
    AND d.redemptions<d.max_redemptions AND (d.expires_at IS NULL OR d.expires_at>now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid, inactive or exhausted discount code'; END IF;
  discount_cents:=discount_cents+round(booking_cents*discount_record.discount_bps/10000.0)::bigint;
 END IF;
 IF booking_cents+addon_cents+cleaning_cents-discount_cents>100000000 THEN
  RAISE EXCEPTION 'Booking exceeds transaction limits'; END IF;
 RETURN jsonb_build_object(
  'rental_cents',booking_cents,'addon_cents',addon_cents,'cleaning_cents',cleaning_cents,
  'discount_cents',discount_cents,
  'total_cents',booking_cents+addon_cents+cleaning_cents-discount_cents,
  'deposit_cents',round((booking_cents+addon_cents+cleaning_cents-discount_cents)*prop.deposit_percent/100.0)::bigint,
  'overtime_hour_cents',round(prop.hourly_rate*100*prop.overtime_bps/10000.0)::bigint,
  'duration_minutes',duration_quarters*15,'lines',lines,'inventory',asset_counts,
  'currency','USD','price_version','ccx-quarter-hour-v2');
END $$;
