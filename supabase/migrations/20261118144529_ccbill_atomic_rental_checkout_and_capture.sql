ALTER TABLE public.booking_payment_events ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'received';
ALTER TABLE public.booking_payment_events ADD COLUMN IF NOT EXISTS reconciliation_note text;
CREATE OR REPLACE FUNCTION public.ccx_start_rental_checkout(p_actor uuid,p_booking uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.property_booking_requests; q public.booking_policy_snapshots; i public.booking_payment_intents; a public.hosting_payment_attempts;
BEGIN
 SELECT * INTO b FROM public.property_booking_requests WHERE id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.requester_id<>p_actor OR b.status<>'accepted' OR b.legal_status<>'signed' OR b.payment_status NOT IN ('not_started','pending','failed')
 THEN RAISE EXCEPTION 'Signed, accepted unpaid booking required'; END IF;
 SELECT * INTO q FROM public.booking_policy_snapshots WHERE booking_id=b.id;
 IF NOT FOUND OR q.rental_cents<300 OR q.deposit_cents<>0 THEN RAISE EXCEPTION 'Approved rental price required; refundable deposits are not supported by this checkout'; END IF;
 SELECT * INTO i FROM public.booking_payment_intents WHERE booking_id=b.id AND kind='rental' FOR UPDATE;
 IF FOUND THEN
  IF i.amount_cents<>q.rental_cents OR i.provider NOT IN ('unconfigured','ccbill') OR i.status NOT IN ('not_started','pending','failed')
   THEN RAISE EXCEPTION 'Payment intent conflicts with the approved booking'; END IF;
  UPDATE public.booking_payment_intents SET provider='ccbill',status='pending',updated_at=now() WHERE id=i.id;
 ELSE
  INSERT INTO public.booking_payment_intents(booking_id,provider,kind,amount_cents,currency,status)
   VALUES(b.id,'ccbill','rental',q.rental_cents,'USD','pending') RETURNING * INTO i;
 END IF;
 SELECT * INTO a FROM public.hosting_payment_attempts WHERE booking_id=b.id AND intent_id=i.id AND status='created' AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN
  INSERT INTO public.hosting_payment_attempts(booking_id,intent_id,provider,status) VALUES(b.id,i.id,'ccbill','created') RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('checkout_nonce',a.checkout_nonce,'expires_at',a.expires_at,'amount_cents',q.rental_cents,'deposit_cents',q.deposit_cents);
END $$;
REVOKE ALL ON FUNCTION public.ccx_start_rental_checkout(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_start_rental_checkout(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_capture_rental_event(p_nonce uuid,p_transaction text,p_event_id text,p_amount bigint,p_hash text,p_occurred timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.hosting_payment_attempts; b public.property_booking_requests; i public.booking_payment_intents; q public.booking_policy_snapshots; prior public.booking_payment_events;
BEGIN
 IF p_transaction !~ '^[a-zA-Z0-9-]{1,80}$' OR p_hash !~ '^[0-9a-f]{64}$' OR p_occurred IS NULL OR p_occurred>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid callback'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id,44813));
 SELECT * INTO prior FROM public.booking_payment_events WHERE provider='ccbill' AND provider_event_id=p_event_id;
 IF FOUND THEN
  IF prior.payload_sha256<>p_hash THEN RAISE EXCEPTION 'Conflicting duplicate event'; END IF;
  IF prior.processed_at IS NOT NULL OR prior.processing_status='reconciliation_required' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',prior.processing_status); END IF;
 END IF;
 SELECT * INTO a FROM public.hosting_payment_attempts WHERE checkout_nonce=p_nonce FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown checkout attempt'; END IF;
 SELECT * INTO b FROM public.property_booking_requests WHERE id=a.booking_id FOR UPDATE;
 SELECT * INTO i FROM public.booking_payment_intents WHERE id=a.intent_id FOR UPDATE;
 SELECT * INTO q FROM public.booking_policy_snapshots WHERE booking_id=a.booking_id;
 IF prior.id IS NULL THEN
  INSERT INTO public.booking_payment_events(provider,provider_event_id,event_type,payload_sha256,booking_id)
  VALUES('ccbill',p_event_id,'NewSaleSuccess',p_hash,a.booking_id) RETURNING * INTO prior;
 END IF;
 IF a.status<>'created' OR p_occurred>a.expires_at OR p_occurred<a.created_at-interval '5 minutes' OR b.id IS NULL OR i.id IS NULL OR q.booking_id IS NULL
  OR b.status<>'accepted' OR b.legal_status<>'signed' OR i.provider<>'ccbill' OR i.status<>'pending'
  OR p_amount IS DISTINCT FROM i.amount_cents OR p_amount IS DISTINCT FROM q.rental_cents OR q.deposit_cents<>0 THEN
  UPDATE public.booking_payment_events SET processing_status='reconciliation_required',reconciliation_note='Checkout, amount, time or booking state conflict' WHERE id=prior.id;
  RETURN jsonb_build_object('ok',true,'status','reconciliation_required');
 END IF;
 UPDATE public.booking_payment_intents SET status='captured',provider_intent_id=p_transaction,updated_at=now() WHERE id=i.id;
 UPDATE public.property_booking_requests SET payment_status='captured',operational_status='ready' WHERE id=b.id;
 -- No fake transfer. Host disbursements remain held until a separately approved payout arrangement exists.
 INSERT INTO public.booking_payouts(booking_id,host_id,payout_cents,currency,status) VALUES(b.id,b.owner_id,p_amount,'USD','held') ON CONFLICT(booking_id) DO NOTHING;
 UPDATE public.hosting_payment_attempts SET status='completed' WHERE id=a.id;
 UPDATE public.booking_payment_events SET processed_at=now(),processing_status='processed' WHERE id=prior.id;
 INSERT INTO public.member_notifications(recipient_id,kind,title,details)
 SELECT member,'hosting_paid','Booking payment recorded',jsonb_build_object('booking_id',b.id) FROM unnest(ARRAY[b.owner_id,b.requester_id]) member;
 RETURN jsonb_build_object('ok',true,'status','processed');
END $$;
REVOKE ALL ON FUNCTION public.ccx_capture_rental_event(uuid,text,text,bigint,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_capture_rental_event(uuid,text,text,bigint,text,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
