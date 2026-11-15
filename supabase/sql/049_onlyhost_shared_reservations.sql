CREATE OR REPLACE FUNCTION public.ccx_hosting_reserve(
 p_guest uuid,p_property uuid,p_start timestamptz,p_end timestamptz,p_crew integer,
 p_use text,p_note text,p_addons jsonb DEFAULT '[]'::jsonb,p_bundle uuid DEFAULT NULL,
 p_discount_hash text DEFAULT NULL,p_origin_brand text DEFAULT 'content_connect'
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
 IF p_origin_brand NOT IN ('content_connect','onlyhost') THEN RAISE EXCEPTION 'Invalid booking brand'; END IF;
 IF p_origin_brand='content_connect' AND NOT EXISTS(
  SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=p_guest
  AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())
 ) THEN RAISE EXCEPTION 'Premium membership required'; END IF;
 IF p_origin_brand='onlyhost' AND NOT EXISTS(
  SELECT 1 FROM public.onlyhost_accounts a WHERE a.user_id=p_guest AND a.status='active'
 ) THEN RAISE EXCEPTION 'OnlyHost account registration required'; END IF;
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
  hourly_rate_snapshot,estimated_total,source_brand)
 VALUES(p_property,p_guest,prop.owner_id,p_start,p_end,'requested',p_crew,p_use,left(coalesce(p_note,''),1000),
  prop.hourly_rate,(quoted->>'total_cents')::bigint/100.0,p_origin_brand) RETURNING id INTO booking_id;
 FOR addon IN SELECT key,value FROM jsonb_each_text(quoted->'inventory') ORDER BY key LOOP
  INSERT INTO public.hosting_booking_addons(booking_id,addon_id,quantity,hourly_cents_snapshot,total_cents)
  SELECT booking_id,asset.id,addon.value::integer,asset.hourly_cents,
   (SELECT coalesce(sum((line->>'total_cents')::bigint),0)
    FROM jsonb_array_elements(quoted->'lines') AS line
    WHERE line->>'id'=addon.key)
  FROM public.hosting_addons asset WHERE asset.id=addon.key::uuid;
 END LOOP;
 IF discount_uuid IS NOT NULL THEN
  UPDATE public.hosting_discount_codes SET redemptions=redemptions+1
   WHERE id=discount_uuid AND redemptions<max_redemptions;
 END IF;
 INSERT INTO public.hosting_quote_snapshots(booking_id,breakdown) VALUES(booking_id,quoted);
 RETURN booking_id;
END $$;

REVOKE ALL ON FUNCTION public.ccx_hosting_reserve(uuid,uuid,timestamptz,timestamptz,integer,text,text,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_reserve(uuid,uuid,timestamptz,timestamptz,integer,text,text,jsonb,uuid,text,text) TO service_role;
