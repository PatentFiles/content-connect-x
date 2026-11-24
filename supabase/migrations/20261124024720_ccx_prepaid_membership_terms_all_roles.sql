-- Preserve existing monthly plan IDs, role entitlements and paid contracts.
-- Six-month and annual purchases are single, non-renewing provider terms.
ALTER TABLE public.ccx_membership_checkout_attempts DROP CONSTRAINT ccx_membership_checkout_attempts_period_days_check,
 ADD CONSTRAINT ccx_membership_checkout_attempts_period_days_check CHECK(period_days IN (30,180,365));
ALTER TABLE public.ccx_membership_contracts ADD COLUMN period_days integer NOT NULL DEFAULT 30 CHECK(period_days IN (30,180,365));
ALTER TABLE public.ccx_integrations ADD COLUMN membership_prepaid_max_cents integer NOT NULL DEFAULT 0 CHECK(membership_prepaid_max_cents BETWEEN 0 AND 1000000);
-- 0 means prepaid merchant approval has not been recorded.
INSERT INTO public.membership_plan_catalog(plan_code,role_type,monthly_cents,label,display_order)
VALUES
 ('director_producer_pro','director_producer',1999,'Director / Producer Premium',90),
 ('hair_stylist_pro','hair_stylist',1999,'Hair Stylist Premium',100),
 ('makeup_artist_pro','makeup_artist',1999,'Makeup Artist Premium',110),
 ('wardrobe_stylist_pro','wardrobe_stylist',1999,'Wardrobe Stylist Premium',120),
 ('equipment_rental_pro','equipment_rental',1999,'Equipment Rental Premium',130),
 ('chef_pro','chef',1999,'Chef / Catering Premium',140),
 ('spa_provider_pro','spa_provider',1999,'Spa / Wellness Premium',150)
ON CONFLICT(plan_code) DO NOTHING;
CREATE FUNCTION public.ccx_membership_term_price(p_monthly integer,p_days integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE p_days WHEN 30 THEN p_monthly WHEN 180 THEN round(p_monthly::numeric*6*0.90)::integer
 WHEN 365 THEN round(p_monthly::numeric*12*0.80)::integer ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION public.ccx_start_membership_checkout_term(p_user uuid, p_plan text, p_account text, p_subaccount text, p_days integer, p_expected_cents integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE plan public.membership_plan_catalog; attempt public.ccx_membership_checkout_attempts; amount_due integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,11429));
 IF p_account !~ '^\d{6}$' OR p_subaccount !~ '^\d{4}$' OR NOT EXISTS(SELECT 1 FROM public.member_admissions a JOIN public.account_security s ON s.user_id=a.user_id WHERE a.user_id=p_user AND NOT s.banned AND NOT s.suspended) THEN RAISE EXCEPTION 'Eligible signed-in member required'; END IF;
 SELECT p.* INTO plan FROM public.membership_plan_catalog p JOIN public.member_profiles m ON m.role_type=p.role_type WHERE p.plan_code=p_plan AND p.active AND m.id=p_user;
 IF NOT FOUND OR plan.currency<>'USD' OR plan.monthly_cents<300 THEN RAISE EXCEPTION 'Plan does not match current professional role'; END IF;
 IF p_days IS NULL OR p_days NOT IN (30,180,365) THEN RAISE EXCEPTION 'Invalid membership term'; END IF;
 amount_due:=public.ccx_membership_term_price(plan.monthly_cents,p_days);
 IF amount_due IS NULL OR amount_due NOT BETWEEN 300 AND 1000000 OR (p_expected_cents IS NOT NULL AND p_expected_cents<>amount_due) THEN RAISE EXCEPTION 'Price changed; review the current membership total'; END IF;
 IF p_days<>30 AND NOT EXISTS(SELECT 1 FROM public.ccx_integrations WHERE provider='ccbill' AND enabled AND membership_prepaid_max_cents>=amount_due) THEN RAISE EXCEPTION 'Prepaid checkout awaits merchant approval for this amount'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=p_user AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())) OR EXISTS(SELECT 1 FROM public.ccx_membership_contracts c WHERE c.user_id=p_user AND c.status IN ('active','past_due') AND NOT c.cancel_at_period_end) THEN RAISE EXCEPTION 'Manage the existing subscription before starting another'; END IF;
 UPDATE public.ccx_membership_checkout_attempts SET status='expired' WHERE user_id=p_user AND status='created' AND expires_at<now();
 SELECT * INTO attempt FROM public.ccx_membership_checkout_attempts WHERE user_id=p_user AND status='created' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN IF attempt.plan_code<>p_plan OR attempt.account<>p_account OR attempt.subaccount<>p_subaccount OR attempt.period_days<>p_days OR attempt.amount_cents<>amount_due THEN RAISE EXCEPTION 'A different checkout is already open; wait for it to expire'; END IF; RETURN to_jsonb(attempt); END IF;
 INSERT INTO public.ccx_membership_checkout_attempts(user_id,plan_code,amount_cents,account,subaccount,period_days) VALUES(p_user,p_plan,amount_due,p_account,p_subaccount,p_days) RETURNING * INTO attempt;
 RETURN to_jsonb(attempt);
END $function$;
-- Keep existing clients and rollback fixtures compatible.
CREATE OR REPLACE FUNCTION public.ccx_start_membership_checkout(p_user uuid,p_plan text,p_account text,p_subaccount text)
RETURNS jsonb LANGUAGE sql SET search_path='' AS $$
 SELECT public.ccx_start_membership_checkout_term(p_user,p_plan,p_account,p_subaccount,30,NULL)
$$;
CREATE OR REPLACE FUNCTION public.ccx_apply_membership_event(p_event jsonb, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE e text:=p_event->>'event_type'; eid text:=p_event->>'event_id'; sid text:=p_event->>'subscription_id'; at timestamptz:=(p_event->>'occurred_at')::timestamptz; until_at timestamptz:=(p_event->>'period_end')::timestamptz; amount integer:=(p_event->>'amount_cents')::integer; a public.ccx_membership_checkout_attempts; c public.ccx_membership_contracts; prior public.ccx_membership_payment_events; owner_id uuid; result_status text:='applied'; reason text:=NULL; event_tx text:=p_event->>'transaction_id';
BEGIN
 IF eid !~ '^[0-9a-f]{64}$' OR p_hash !~ '^[0-9a-f]{64}$' OR at IS NULL OR at>now()+interval '5 minutes' OR e NOT IN ('NewSaleSuccess','NewSaleFailure','RenewalSuccess','RenewalFailure','Cancellation','Expiration','Refund','Chargeback','Void','Return') THEN RAISE EXCEPTION 'Invalid normalized provider event'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(sid,p_event->>'checkout_nonce'),91802));
 SELECT * INTO prior FROM public.ccx_membership_payment_events WHERE event_id=eid;
 IF FOUND THEN IF prior.payload_hash<>p_hash THEN RAISE EXCEPTION 'Conflicting duplicate payment event'; END IF; RETURN jsonb_build_object('ok',true,'duplicate',true,'status',prior.status); END IF;
 IF e IN ('NewSaleSuccess','NewSaleFailure') THEN
  SELECT * INTO a FROM public.ccx_membership_checkout_attempts WHERE checkout_nonce=(p_event->>'checkout_nonce')::uuid FOR UPDATE;
  IF NOT FOUND OR a.account IS DISTINCT FROM p_event->>'account' OR a.subaccount IS DISTINCT FROM p_event->>'subaccount' THEN RAISE EXCEPTION 'Unknown checkout attempt'; END IF;
  owner_id:=a.user_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,11429));
  IF e='NewSaleFailure' THEN IF a.status='created' THEN UPDATE public.ccx_membership_checkout_attempts SET status='failed' WHERE id=a.id; END IF;
  ELSIF sid IS NULL OR until_at IS NULL OR event_tx IS NULL OR amount IS DISTINCT FROM a.amount_cents OR p_event->>'currency' IS DISTINCT FROM 'USD' OR until_at<=at OR (a.period_days=30 AND (coalesce((p_event->>'period_days')::integer,30)<>30 OR coalesce(p_event->>'billing_mode','recurring')<>'recurring' OR until_at>at+interval '32 days'))
 OR (a.period_days<>30 AND ((p_event->>'period_days')::integer IS DISTINCT FROM a.period_days OR p_event->>'billing_mode' IS DISTINCT FROM 'prepaid' OR until_at IS DISTINCT FROM at+make_interval(secs=>a.period_days::double precision*86400)))
 OR at<a.created_at-interval '5 minutes' OR at>a.expires_at OR a.status='completed' OR EXISTS(SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=owner_id AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())) THEN
   result_status:='reconciliation_required';reason:='Payment requires checkout, amount, time or duplicate-subscription reconciliation';IF a.status<>'completed' THEN UPDATE public.ccx_membership_checkout_attempts SET status='reconciliation_required' WHERE id=a.id; END IF;
  ELSE
   INSERT INTO public.ccx_membership_contracts(subscription_id,user_id,attempt_id,plan_code,amount_cents,account,subaccount,period_end,status,latest_transaction_id,last_event_at,period_days,cancel_at_period_end) VALUES(sid,owner_id,a.id,a.plan_code,a.amount_cents,a.account,a.subaccount,until_at,'active',event_tx,at,a.period_days,a.period_days<>30) RETURNING * INTO c;
   UPDATE public.ccx_membership_checkout_attempts SET status='completed' WHERE id=a.id;
  END IF;
 ELSE
  SELECT * INTO c FROM public.ccx_membership_contracts WHERE subscription_id=sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not yet reconciled; retry after the initial sale'; END IF;
  owner_id:=c.user_id;PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,11429));
  IF c.account IS DISTINCT FROM p_event->>'account' OR c.subaccount IS DISTINCT FROM p_event->>'subaccount' THEN RAISE EXCEPTION 'Merchant mismatch'; END IF;
  IF at<c.last_event_at THEN result_status:='ignored';reason:='Older than the last applied subscription event';
  ELSIF e='RenewalSuccess' THEN
   IF c.period_days<>30 OR c.status IN ('expired','cancelled') OR amount IS DISTINCT FROM c.amount_cents OR p_event->>'currency' IS DISTINCT FROM 'USD' OR until_at IS NULL OR until_at<=c.period_end OR until_at>at+interval '32 days' OR event_tx IS NULL THEN result_status:='reconciliation_required';reason:='Renewal conflicts with price, paid period or terminal state';
   ELSE c.status:='active';c.period_end:=until_at;c.latest_transaction_id:=event_tx;END IF;
  ELSIF e='Cancellation' THEN c.cancel_at_period_end:=true;
  ELSIF e='RenewalFailure' THEN IF c.period_end<=now() THEN c.status:='past_due';END IF;
  ELSIF e='Expiration' THEN c.status:='expired';c.period_end:=least(c.period_end,at);c.cancel_at_period_end:=true;
  ELSIF e IN ('Refund','Chargeback','Void','Return') THEN
   IF event_tx=c.latest_transaction_id OR e='Chargeback' THEN c.status:='cancelled';c.period_end:=least(c.period_end,at);c.cancel_at_period_end:=true;ELSE result_status:='reconciliation_required';reason:='Adjustment relates to an older transaction';END IF;
  END IF;
  IF result_status='applied' THEN c.last_event_at:=at;UPDATE public.ccx_membership_contracts SET status=c.status,period_end=c.period_end,cancel_at_period_end=c.cancel_at_period_end,last_event_at=at,latest_transaction_id=c.latest_transaction_id,updated_at=now() WHERE subscription_id=sid;END IF;
 END IF;
 IF result_status='applied' AND e<>'NewSaleFailure' THEN
  INSERT INTO public.member_subscriptions(user_id,billing_provider,provider_subscription_id,plan_id,status,period_end,updated_at) VALUES(owner_id,'ccbill',sid,c.plan_code,c.status,c.period_end,now())
   ON CONFLICT(user_id) DO UPDATE SET billing_provider='ccbill',provider_subscription_id=excluded.provider_subscription_id,plan_id=excluded.plan_id,status=excluded.status,period_end=excluded.period_end,updated_at=now() WHERE e='NewSaleSuccess' OR member_subscriptions.provider_subscription_id=sid;
  INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES(owner_id,'membership_updated','Your membership billing status was updated',jsonb_build_object('page','Membership'));
 END IF;
 INSERT INTO public.ccx_membership_payment_events(event_id,payload_hash,subscription_id,user_id,event_type,occurred_at,status,reason,normalized) VALUES(eid,p_hash,sid,owner_id,e,at,result_status,reason,p_event);
 RETURN jsonb_build_object('ok',true,'status',result_status);
END $function$;
REVOKE ALL ON FUNCTION public.ccx_membership_term_price(integer,integer),public.ccx_start_membership_checkout_term(uuid,text,text,text,integer,integer),public.ccx_start_membership_checkout(uuid,text,text,text),public.ccx_apply_membership_event(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_membership_term_price(integer,integer),public.ccx_start_membership_checkout_term(uuid,text,text,text,integer,integer),public.ccx_start_membership_checkout(uuid,text,text,text),public.ccx_apply_membership_event(jsonb,text) TO service_role;
