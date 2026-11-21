-- Member-only explicit opt-in; no PII in queue messages.
CREATE EXTENSION IF NOT EXISTS pgmq;
SELECT pgmq.create('ccx_member_email');
ALTER TABLE public.member_notification_preferences ADD COLUMN IF NOT EXISTS transactional_email boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.ccx_email_delivery(
 notification_id uuid PRIMARY KEY REFERENCES public.member_notifications(id) ON DELETE CASCADE,
 queue_msg_id bigint NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retry','sent','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 30),
 remote_message_id text,last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ccx_email_delivery_status_created_idx ON public.ccx_email_delivery(status,created_at DESC);
ALTER TABLE public.ccx_email_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_email_delivery FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_queue_member_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare job_id bigint;
begin
 if exists(
  select 1 from public.member_notification_preferences p
  where p.user_id=new.recipient_id and p.transactional_email
 ) then
  -- The durable message contains only a pointer. Details/identity/medical
  -- information never enter the queue or outbound email content.
  select pgmq.send('ccx_member_email',jsonb_build_object('notification_id',new.id::text))
   into job_id;
  insert into public.ccx_email_delivery(notification_id,queue_msg_id)
  values(new.id,job_id) on conflict(notification_id) do nothing;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ccx_email_claim(p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object(
  'msg_id',m.msg_id,'read_ct',m.read_ct,'notification_id',m.message->>'notification_id'
 )),'[]'::jsonb)
 from pgmq.read('ccx_member_email',180,least(8,greatest(1,coalesce(p_limit,8)))) m;
$function$;

CREATE OR REPLACE FUNCTION public.ccx_email_finish(p_notification_id uuid, p_msg_id bigint, p_outcome text, p_remote_id text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_retry_seconds integer DEFAULT 300)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.ccx_email_delivery%rowtype;
declare attempts_after integer;
declare final_status text;
begin
 if p_outcome not in ('sent','skipped','failed','retry') then
  raise exception 'Invalid delivery outcome' using errcode='22023';
 end if;
 select * into item from public.ccx_email_delivery
 where notification_id=p_notification_id and queue_msg_id=p_msg_id for update;
 if not found then raise exception 'Unknown queued delivery' using errcode='42501'; end if;
 if item.status in('sent','skipped','failed') then
  perform pgmq.archive('ccx_member_email',p_msg_id);
  return jsonb_build_object('status',item.status,'attempts',item.attempts);
 end if;
 attempts_after:=item.attempts+1;
 final_status:=case when p_outcome='retry' and attempts_after>=8 then 'failed'
  when p_outcome='retry' then 'retry' else p_outcome end;
 update public.ccx_email_delivery
 set status=final_status,attempts=attempts_after,
     remote_message_id=case when final_status='sent' then left(coalesce(p_remote_id,''),120) else remote_message_id end,
     last_error=case when final_status in ('failed','retry') then left(coalesce(p_reason,'Delivery unavailable'),180) else null end,
     completed_at=case when final_status='retry' then null else now() end
 where notification_id=p_notification_id;
 if final_status='retry' then
  perform pgmq.set_vt('ccx_member_email',p_msg_id,
    least(21600,greatest(60,coalesce(p_retry_seconds,300))));
 else
  perform pgmq.archive('ccx_member_email',p_msg_id);
 end if;
 return jsonb_build_object('status',final_status,'attempts',attempts_after);
end $function$;

CREATE OR REPLACE FUNCTION public.ccx_email_delivery_summary()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
  'pending',count(*) filter(where status in('pending','retry')),
  'sent',count(*) filter(where status='sent'),
  'failed',count(*) filter(where status='failed'),
  'skipped',count(*) filter(where status='skipped'),
  'last_completed_at',max(completed_at)
 ) from public.ccx_email_delivery;
$function$;

DROP TRIGGER IF EXISTS ccx_member_notification_email_enqueue ON public.member_notifications;
CREATE TRIGGER ccx_member_notification_email_enqueue AFTER INSERT ON public.member_notifications
FOR EACH ROW EXECUTE FUNCTION ccx_workspace_private.ccx_queue_member_email();
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_queue_member_email() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ccx_email_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_email_claim(integer) TO service_role;
REVOKE ALL ON FUNCTION public.ccx_email_finish(uuid,bigint,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_email_finish(uuid,bigint,text,text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ccx_email_delivery_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_email_delivery_summary() TO service_role;
