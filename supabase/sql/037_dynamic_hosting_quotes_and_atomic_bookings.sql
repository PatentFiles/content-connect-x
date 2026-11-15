-- Deterministic 15-minute rental quote; all amounts USD cents.
-- This is only executable by the trusted service role, never by browsers.
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
  SELECT r.multiplier_bps INTO multiplier FROM public.hosting_seasonal_rates r
   WHERE r.property_id=p_property AND local_date BETWEEN r.starts_on AND r.ends_on
   ORDER BY CASE r.kind WHEN 'holiday' THEN 3 WHEN 'seasonal' THEN 2 ELSE 1 END DESC,r.created_at DESC
   LIMIT 1;
  multiplier:=coalesce(multiplier,CASE WHEN extract(isodow FROM slot AT TIME ZONE prop.timezone) IN (6,7)
    THEN prop.weekend_bps ELSE 10000 END);
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
  price_cents:=round(asset.hourly_cents*duration_quarters/4.0)::bigint*qty;
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
   price_cents:=round(asset.hourly_cents*duration_quarters/4.0)::bigint*bundle_line.quantity;
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
  'currency','USD','price_version','ccx-quarter-hour-v1');
END $$;
REVOKE ALL ON FUNCTION public.ccx_hosting_price_quote(uuid,timestamptz,timestamptz,integer,text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_price_quote(uuid,timestamptz,timestamptz,integer,text,jsonb,uuid,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.hosting_quote_snapshots(
 booking_id uuid PRIMARY KEY REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 breakdown jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_quote_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_quote_participants ON public.hosting_quote_snapshots FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id
  AND (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

-- Atomic reservation: lock venue and selected equipment before capacity checks.
CREATE OR REPLACE FUNCTION public.ccx_hosting_reserve(
 p_guest uuid,p_property uuid,p_start timestamptz,p_end timestamptz,p_crew integer,
 p_use text,p_note text,p_addons jsonb DEFAULT '[]'::jsonb,p_bundle uuid DEFAULT NULL,
 p_discount_hash text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 prop public.properties%rowtype;
 quoted jsonb;
 addon record;
 requested integer;
 occupied integer;
 booking_id uuid;
 discount_uuid uuid;
 BEGIN
 SELECT * INTO prop FROM public.properties WHERE id=p_property AND status='active' AND approved_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR prop.owner_id=p_guest THEN RAISE EXCEPTION 'Property unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.age_verification_requests v WHERE v.user_id=p_guest
  AND v.id=(SELECT latest.id FROM public.age_verification_requests latest WHERE latest.user_id=p_guest
   ORDER BY latest.created_at DESC LIMIT 1) AND v.status='approved'
  AND (v.expires_at IS NULL OR v.expires_at>now())) THEN RAISE EXCEPTION 'Guest is not verified'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=p_guest
  AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())) THEN
   RAISE EXCEPTION 'Premium membership required'; END IF;
 IF EXISTS (SELECT 1 FROM public.member_blocks b WHERE
  (b.blocker_id=p_guest AND b.blocked_id=prop.owner_id) OR
  (b.blocked_id=p_guest AND b.blocker_id=prop.owner_id)) THEN RAISE EXCEPTION 'Host unavailable'; END IF;
 quoted:=public.ccx_hosting_price_quote(p_property,p_start,p_end,p_crew,p_use,p_addons,p_bundle,p_discount_hash);
 IF p_discount_hash IS NOT NULL THEN
  SELECT id INTO discount_uuid FROM public.hosting_discount_codes
   WHERE property_id=p_property AND code_sha256=p_discount_hash AND active
    AND redemptions<max_redemptions AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
  IF discount_uuid IS NULL THEN RAISE EXCEPTION 'Discount no longer valid'; END IF;
 END IF;
 -- Inventory is locked in deterministic ID order across concurrent reservations.
 FOR addon IN SELECT key,value FROM jsonb_each_text(quoted->'inventory') ORDER BY key LOOP
  PERFORM 1 FROM public.hosting_addons WHERE id=addon.key::uuid AND active FOR UPDATE;
  requested:=addon.value::integer;
  SELECT coalesce(sum(ba.quantity),0) INTO occupied FROM public.hosting_booking_addons ba
   JOIN public.property_booking_requests b ON b.id=ba.booking_id
   WHERE ba.addon_id=addon.key::uuid AND b.status IN ('requested','accepted')
   AND b.starts_at<p_end AND b.ends_at>p_start;
  IF requested+occupied>(SELECT quantity FROM public.hosting_addons WHERE id=addon.key::uuid)
   THEN RAISE EXCEPTION 'Equipment quantity unavailable'; END IF;
 END LOOP;
 INSERT INTO public.property_booking_requests(
  property_id,requester_id,owner_id,starts_at,ends_at,status,crew_size,requested_use,notes,
  hourly_rate_snapshot,estimated_total)
 VALUES(p_property,p_guest,prop.owner_id,p_start,p_end,'requested',p_crew,p_use,left(coalesce(p_note,''),1000),
  prop.hourly_rate,(quoted->>'total_cents')::bigint/100.0) RETURNING id INTO booking_id;
 FOR addon IN SELECT key,value FROM jsonb_each_text(quoted->'inventory') ORDER BY key LOOP
  INSERT INTO public.hosting_booking_addons(booking_id,addon_id,quantity,hourly_cents_snapshot,total_cents)
  SELECT booking_id,asset.id,addon.value::integer,asset.hourly_cents,
   round(asset.hourly_cents*(quoted->>'duration_minutes')::integer/60.0)::bigint*addon.value::integer
  FROM public.hosting_addons asset WHERE asset.id=addon.key::uuid;
 END LOOP;
 IF discount_uuid IS NOT NULL THEN
  UPDATE public.hosting_discount_codes SET redemptions=redemptions+1
   WHERE id=discount_uuid AND redemptions<max_redemptions;
 END IF;
 INSERT INTO public.hosting_quote_snapshots(booking_id,breakdown) VALUES(booking_id,quoted);
 RETURN booking_id;
END $$;
REVOKE ALL ON FUNCTION public.ccx_hosting_reserve(uuid,uuid,timestamptz,timestamptz,integer,text,text,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_reserve(uuid,uuid,timestamptz,timestamptz,integer,text,text,jsonb,uuid,text) TO service_role;

-- Prevent a direct write from slipping past inventory enforcement.
CREATE OR REPLACE FUNCTION public.ccx_guard_addon_inventory() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prop uuid; active_count integer; cap integer; booking_st timestamptz;booking_end timestamptz;
BEGIN
 SELECT property_id,starts_at,ends_at INTO prop,booking_st,booking_end
 FROM public.property_booking_requests WHERE id=NEW.booking_id;
 SELECT quantity INTO cap FROM public.hosting_addons WHERE id=NEW.addon_id AND property_id=prop FOR UPDATE;
 IF cap IS NULL THEN RAISE EXCEPTION 'Add-on does not belong to venue'; END IF;
 SELECT coalesce(sum(ba.quantity),0) INTO active_count FROM public.hosting_booking_addons ba
 JOIN public.property_booking_requests b ON b.id=ba.booking_id
 WHERE ba.addon_id=NEW.addon_id AND b.status IN ('requested','accepted')
 AND b.starts_at<booking_end AND b.ends_at>booking_st
 AND (ba.booking_id,ba.addon_id) IS DISTINCT FROM (NEW.booking_id,NEW.addon_id);
 IF active_count+NEW.quantity>cap THEN RAISE EXCEPTION 'Add-on quantity unavailable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_prevent_addon_overbooking ON public.hosting_booking_addons;
CREATE TRIGGER ccx_prevent_addon_overbooking BEFORE INSERT OR UPDATE ON public.hosting_booking_addons
 FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_addon_inventory();
