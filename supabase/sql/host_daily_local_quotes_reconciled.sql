-- Reconciled from the historical full-day booking branch into current main.
-- This is a staged SQL reference, not an automatically-applied migration.
-- Apply through Supabase migration tool only after Edge and frontend API parity are validated.
-- Day-based Host Connect pricing; explicit 3 p.m. local venue check-in and
-- checkout. This replaces 15-minute hourly rental quoting, not existing
-- cancellation/merchant/availability gates.
BEGIN;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS daily_rate numeric(12,2);
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_daily_rate_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_daily_rate_check CHECK (daily_rate BETWEEN 1 AND 100000);
ALTER TABLE public.property_booking_requests ADD COLUMN IF NOT EXISTS daily_rate_snapshot numeric(12,2);
COMMENT ON COLUMN public.properties.daily_rate IS
 'Host-confirmed full-day USD rental price. Null on legacy drafts until the host explicitly sets it. No hourly reservation option.';
COMMENT ON COLUMN public.property_booking_requests.daily_rate_snapshot IS
 'The host-approved nightly base rate when the booking was quoted; NULL on historical hourly requests.';
CREATE OR REPLACE FUNCTION public.ccx_hosting_price_quote(p_property uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_crew integer, p_use text, p_addons jsonb DEFAULT '[]'::jsonb, p_bundle uuid DEFAULT NULL::uuid, p_discount_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 rental_days integer;
 local_start date;
 local_end date;
 booking_cents bigint:=0;
 addon_cents bigint:=0;
 discount_cents bigint:=0;
 cleaning_cents bigint;
 bundle_discount integer:=0;
 bundle_addon_cents bigint:=0;
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
  OR p_end<=p_start
  OR p_start<now()+make_interval(hours=>prop.min_notice_hours)
  OR p_crew<1 OR p_crew>prop.capacity OR p_use<>ALL(prop.permitted_uses)
  OR (p_start AT TIME ZONE prop.timezone)::time <> time '15:00'
  OR (p_end AT TIME ZONE prop.timezone)::time <> time '15:00'
 THEN RAISE EXCEPTION 'Quote requires property-local 3 p.m. daily check-in/out, approved use and notice'; END IF;
 IF prop.daily_rate IS NULL OR prop.daily_rate<1 THEN
   RAISE EXCEPTION 'Host must confirm a daily rate before booking'; END IF;
 local_start:=(p_start AT TIME ZONE prop.timezone)::date;
 local_end:=(p_end AT TIME ZONE prop.timezone)::date;
 rental_days:=local_end-local_start;
 IF rental_days<1 OR rental_days>365 THEN
   RAISE EXCEPTION 'Rentals must cover 1 to 365 local calendar days'; END IF;
 -- Nights are measured in property-local calendar days; DST never adds or
 -- subtracts an extra billable day. Equipment uses the same full-day count.
 duration_quarters:=rental_days*96;
 IF jsonb_typeof(p_addons)<>'array' OR jsonb_array_length(p_addons)>25 THEN
  RAISE EXCEPTION 'Add-on list must contain up to 25 items';
 END IF;
 -- Price each property-local day once, not each 15-minute interval.
 FOR local_date IN SELECT local_start + i FROM generate_series(0,rental_days-1) AS i LOOP
  multiplier:=CASE WHEN extract(isodow FROM local_date) IN (6,7)
    THEN prop.weekend_bps ELSE 10000 END;
  SELECT r.multiplier_bps,r.kind INTO multiplier,rate_kind FROM public.hosting_seasonal_rates r
   WHERE r.property_id=p_property AND local_date BETWEEN r.starts_on AND r.ends_on
   ORDER BY CASE r.kind WHEN 'holiday' THEN 3 WHEN 'seasonal' THEN 2 ELSE 1 END DESC,r.created_at DESC
   LIMIT 1;
  multiplier:=coalesce(multiplier,CASE WHEN extract(isodow FROM local_date) IN (6,7)
    THEN prop.weekend_bps ELSE 10000 END);
  IF rate_kind='holiday' THEN multiplier:=round(multiplier*prop.holiday_bps/10000.0)::integer; END IF;
  rate_kind:=NULL;
  booking_cents:=booking_cents+round(prop.daily_rate*100*multiplier/10000.0)::bigint;
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
  price_cents:=(coalesce(asset.daily_cents,asset.hourly_cents*24)::bigint*rental_days)*qty;
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
   price_cents:=(coalesce(asset.daily_cents,asset.hourly_cents*24)::bigint*rental_days)*bundle_line.quantity;
   addon_cents:=addon_cents+price_cents;
   bundle_addon_cents:=bundle_addon_cents+price_cents;
   lines:=lines||jsonb_build_array(jsonb_build_object('id',asset.id,'quantity',bundle_line.quantity,
     'label',asset.label,'hourly_cents',asset.hourly_cents,'total_cents',price_cents));
  END LOOP;
 END IF;
 discount_cents:=round(bundle_addon_cents*bundle_discount/10000.0)::bigint;
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
  'rental_days',rental_days,'daily_rate_cents',round(prop.daily_rate*100)::bigint,
  'duration_minutes',rental_days*1440,'lines',lines,'inventory',asset_counts,
  'currency','USD','price_version','ccx-daily-3pm-v1');
END $function$

COMMENT ON FUNCTION public.ccx_hosting_price_quote(uuid,timestamptz,timestamptz,integer,text,jsonb,uuid,text) IS
 'Day-based venue-local 3 p.m.–3 p.m. booking quote, up to 365 days. Currency, bundles, cleaning and discounts calculated transactionally.';
-- Defense-in-depth: no second Edge Function or direct service insert may
-- create a minute/hour-based booking behind the daily quote handler.
CREATE FUNCTION public.ccx_hosting_daily_booking_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE
  venue_timezone text;
  daily numeric;
  days integer;
BEGIN
 SELECT timezone,daily_rate INTO venue_timezone,daily
 FROM public.properties WHERE id=NEW.property_id;
 IF venue_timezone IS NULL OR daily IS NULL THEN
  RAISE EXCEPTION 'Venue daily pricing has not been confirmed';
 END IF;
 days:=((NEW.ends_at AT TIME ZONE venue_timezone)::date-
       (NEW.starts_at AT TIME ZONE venue_timezone)::date);
 IF NEW.ends_at<=NEW.starts_at OR days<1 OR days>365
  OR (NEW.starts_at AT TIME ZONE venue_timezone)::time<>time '15:00'
  OR (NEW.ends_at AT TIME ZONE venue_timezone)::time<>time '15:00'
 THEN RAISE EXCEPTION 'Book whole calendar days only, 3 p.m. to 3 p.m. venue-local time';
 END IF;
 NEW.daily_rate_snapshot:=daily;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION public.ccx_hosting_daily_booking_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_hosting_daily_booking_guard
 BEFORE INSERT OR UPDATE OF starts_at,ends_at ON public.property_booking_requests
 FOR EACH ROW EXECUTE FUNCTION public.ccx_hosting_daily_booking_guard();
COMMIT;
