CREATE TABLE IF NOT EXISTS public.ccx_membership_checkout_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checkout_nonce uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plan_code text NOT NULL REFERENCES public.membership_plan_catalog(plan_code), amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 300 AND 1000000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'), period_days integer NOT NULL DEFAULT 30 CHECK(period_days=30),
 account text NOT NULL CHECK(account ~ '^\d{6}$'), subaccount text NOT NULL CHECK(subaccount ~ '^\d{4}$'),
 status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','completed','failed','expired','reconciliation_required')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes'
);
CREATE INDEX IF NOT EXISTS ccx_membership_attempt_user_idx ON public.ccx_membership_checkout_attempts(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_membership_attempt_plan_idx ON public.ccx_membership_checkout_attempts(plan_code);
CREATE TABLE IF NOT EXISTS public.ccx_membership_contracts (
 subscription_id text PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 attempt_id uuid NOT NULL UNIQUE REFERENCES public.ccx_membership_checkout_attempts(id),
 plan_code text NOT NULL REFERENCES public.membership_plan_catalog(plan_code),amount_cents integer NOT NULL,
 account text NOT NULL,subaccount text NOT NULL,period_end timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('active','past_due','expired','cancelled')),
 cancel_at_period_end boolean NOT NULL DEFAULT false,latest_transaction_id text NOT NULL,
 last_event_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccx_membership_contract_user_idx ON public.ccx_membership_contracts(user_id);
CREATE INDEX IF NOT EXISTS ccx_membership_contract_plan_idx ON public.ccx_membership_contracts(plan_code);
CREATE TABLE IF NOT EXISTS public.ccx_membership_payment_events (
 event_id text PRIMARY KEY CHECK(event_id ~ '^[0-9a-f]{64}$'),payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),
 subscription_id text,user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,event_type text NOT NULL,
 occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN ('applied','ignored','reconciliation_required')),reason text,
 normalized jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ccx_membership_event_user_idx ON public.ccx_membership_payment_events(user_id);
CREATE INDEX IF NOT EXISTS ccx_membership_event_review_idx ON public.ccx_membership_payment_events(status,received_at);
ALTER TABLE public.ccx_membership_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_membership_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_membership_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_membership_checkout_attempts,public.ccx_membership_contracts,public.ccx_membership_payment_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ccx_membership_checkout_attempts,public.ccx_membership_contracts,public.ccx_membership_payment_events TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_start_membership_checkout(p_user uuid,p_plan text,p_account text,p_subaccount text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE plan public.membership_plan_catalog; attempt public.ccx_membership_checkout_attempts;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,11429));
 IF p_account !~ '^\d{6}$' OR p_subaccount !~ '^\d{4}$' OR NOT EXISTS(
   SELECT 1 FROM public.member_admissions a JOIN public.account_security s ON s.user_id=a.user_id
   WHERE a.user_id=p_user AND NOT s.banned AND NOT s.suspended
 ) THEN RAISE EXCEPTION 'Eligible signed-in member required'; END IF;
 SELECT p.* INTO plan FROM public.membership_plan_catalog p JOIN public.member_profiles m ON m.role_type=p.role_type
  WHERE p.plan_code=p_plan AND p.active AND m.id=p_user;
 IF NOT FOUND OR plan.currency<>'USD' OR plan.monthly_cents<300 THEN RAISE EXCEPTION 'Plan does not match current professional role'; END IF;
 IF EXISTS(SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=p_user AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now()))
   OR EXISTS(SELECT 1 FROM public.ccx_membership_contracts c WHERE c.user_id=p_user AND c.status IN ('active','past_due') AND NOT c.cancel_at_period_end)
   THEN RAISE EXCEPTION 'Manage the existing subscription before starting another'; END IF;
 UPDATE public.ccx_membership_checkout_attempts SET status='expired' WHERE user_id=p_user AND status='created' AND expires_at<now();
 SELECT * INTO attempt FROM public.ccx_membership_checkout_attempts WHERE user_id=p_user AND status='created' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
  IF attempt.plan_code<>p_plan OR attempt.account<>p_account OR attempt.subaccount<>p_subaccount THEN RAISE EXCEPTION 'A different checkout is already open; wait for it to expire'; END IF;
  RETURN to_jsonb(attempt);
 END IF;
 INSERT INTO public.ccx_membership_checkout_attempts(user_id,plan_code,amount_cents,account,subaccount)
  VALUES(p_user,p_plan,plan.monthly_cents,p_account,p_subaccount) RETURNING * INTO attempt;
 RETURN to_jsonb(attempt);
END $$;
REVOKE ALL ON FUNCTION public.ccx_start_membership_checkout(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_start_membership_checkout(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_apply_membership_event(p_event jsonb,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e text:=p_event->>'event_type'; eid text:=p_event->>'event_id'; sid text:=p_event->>'subscription_id';
 at timestamptz:=(p_event->>'occurred_at')::timestamptz; until_at timestamptz:=(p_event->>'period_end')::timestamptz;
 amount integer:=(p_event->>'amount_cents')::integer; a public.ccx_membership_checkout_attempts;
 c public.ccx_membership_contracts; prior public.ccx_membership_payment_events;
 owner_id uuid; result_status text:='applied'; reason text:=NULL; event_tx text:=p_event->>'transaction_id';
BEGIN
 IF eid !~ '^[0-9a-f]{64}$' OR p_hash !~ '^[0-9a-f]{64}$' OR at IS NULL OR at>now()+interval '5 minutes'
  OR e NOT IN ('NewSaleSuccess','NewSaleFailure','RenewalSuccess','RenewalFailure','Cancellation','Expiration','Refund','Chargeback','Void','Return')
  THEN RAISE EXCEPTION 'Invalid normalized provider event'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(sid,p_event->>'checkout_nonce'),91802));
 SELECT * INTO prior FROM public.ccx_membership_payment_events WHERE event_id=eid;
 IF FOUND THEN
  IF prior.payload_hash<>p_hash THEN RAISE EXCEPTION 'Conflicting duplicate payment event'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'status',prior.status);
 END IF;
 IF e IN ('NewSaleSuccess','NewSaleFailure') THEN
  SELECT * INTO a FROM public.ccx_membership_checkout_attempts WHERE checkout_nonce=(p_event->>'checkout_nonce')::uuid FOR UPDATE;
  IF NOT FOUND OR a.account IS DISTINCT FROM p_event->>'account' OR a.subaccount IS DISTINCT FROM p_event->>'subaccount'
    THEN RAISE EXCEPTION 'Unknown checkout attempt'; END IF;
  owner_id:=a.user_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,11429));
  IF e='NewSaleFailure' THEN
   IF a.status='created' THEN UPDATE public.ccx_membership_checkout_attempts SET status='failed' WHERE id=a.id; END IF;
  ELSIF sid IS NULL OR until_at IS NULL OR event_tx IS NULL OR amount IS DISTINCT FROM a.amount_cents OR p_event->>'currency' IS DISTINCT FROM 'USD'
   OR until_at<=at OR until_at>at+interval '32 days' OR at<a.created_at-interval '5 minutes' OR at>a.expires_at
   OR a.status='completed' OR EXISTS(SELECT 1 FROM public.member_subscriptions s WHERE s.user_id=owner_id AND s.status IN ('active','trial') AND (s.period_end IS NULL OR s.period_end>now())) THEN
   result_status:='reconciliation_required';reason:='Payment requires checkout, amount, time or duplicate-subscription reconciliation';
   IF a.status<>'completed' THEN UPDATE public.ccx_membership_checkout_attempts SET status='reconciliation_required' WHERE id=a.id; END IF;
  ELSE
   INSERT INTO public.ccx_membership_contracts(subscription_id,user_id,attempt_id,plan_code,amount_cents,account,subaccount,period_end,status,latest_transaction_id,last_event_at)
    VALUES(sid,owner_id,a.id,a.plan_code,a.amount_cents,a.account,a.subaccount,until_at,'active',event_tx,at) RETURNING * INTO c;
   UPDATE public.ccx_membership_checkout_attempts SET status='completed' WHERE id=a.id;
  END IF;
 ELSE
  SELECT * INTO c FROM public.ccx_membership_contracts WHERE subscription_id=sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not yet reconciled; retry after the initial sale'; END IF;
  owner_id:=c.user_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,11429));
  IF c.account IS DISTINCT FROM p_event->>'account' OR c.subaccount IS DISTINCT FROM p_event->>'subaccount' THEN RAISE EXCEPTION 'Merchant mismatch'; END IF;
  IF at<c.last_event_at THEN result_status:='ignored';reason:='Older than the last applied subscription event';
  ELSIF e='RenewalSuccess' THEN
   IF c.status IN ('expired','cancelled') OR amount IS DISTINCT FROM c.amount_cents OR p_event->>'currency' IS DISTINCT FROM 'USD' OR
    until_at IS NULL OR until_at<=c.period_end OR until_at>at+interval '32 days' OR event_tx IS NULL THEN
    result_status:='reconciliation_required';reason:='Renewal conflicts with price, paid period or terminal state';
   ELSE c.status:='active';c.period_end:=until_at;c.latest_transaction_id:=event_tx;END IF;
  ELSIF e='Cancellation' THEN c.cancel_at_period_end:=true;
  ELSIF e='RenewalFailure' THEN IF c.period_end<=now() THEN c.status:='past_due';END IF;
  ELSIF e='Expiration' THEN c.status:='expired';c.period_end:=least(c.period_end,at);c.cancel_at_period_end:=true;
  ELSIF e IN ('Refund','Chargeback','Void','Return') THEN
   IF event_tx=c.latest_transaction_id OR e='Chargeback' THEN c.status:='cancelled';c.period_end:=least(c.period_end,at);c.cancel_at_period_end:=true;
   ELSE result_status:='reconciliation_required';reason:='Adjustment relates to an older transaction';END IF;
  END IF;
  IF result_status='applied' THEN c.last_event_at:=at;
   UPDATE public.ccx_membership_contracts SET status=c.status,period_end=c.period_end,cancel_at_period_end=c.cancel_at_period_end,
    last_event_at=at,latest_transaction_id=c.latest_transaction_id,updated_at=now() WHERE subscription_id=sid;
  END IF;
 END IF;
 IF result_status='applied' AND e<>'NewSaleFailure' THEN
  -- A late event for an older subscription may not replace a newer subscription.
  INSERT INTO public.member_subscriptions(user_id,billing_provider,provider_subscription_id,plan_id,status,period_end,updated_at)
   VALUES(owner_id,'ccbill',sid,c.plan_code,c.status,c.period_end,now())
   ON CONFLICT(user_id) DO UPDATE SET billing_provider='ccbill',provider_subscription_id=excluded.provider_subscription_id,
    plan_id=excluded.plan_id,status=excluded.status,period_end=excluded.period_end,updated_at=now()
   WHERE e='NewSaleSuccess' OR member_subscriptions.provider_subscription_id=sid;
  INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES(owner_id,'membership_updated','Your membership billing status was updated',jsonb_build_object('page','Membership'));
 END IF;
 INSERT INTO public.ccx_membership_payment_events(event_id,payload_hash,subscription_id,user_id,event_type,occurred_at,status,reason,normalized)
  VALUES(eid,p_hash,sid,owner_id,e,at,result_status,reason,p_event);
 RETURN jsonb_build_object('ok',true,'status',result_status);
END $$;
REVOKE ALL ON FUNCTION public.ccx_apply_membership_event(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_apply_membership_event(jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
