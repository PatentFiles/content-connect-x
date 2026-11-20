
create table if not exists public.ccx_trust_messages(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.ccx_trust_requests(id) on delete cascade,
 author text not null check (author in ('reporter','staff')),
 body text not null check (char_length(btrim(body)) between 2 and 4000),
 staff_id uuid references auth.users(id),
 idempotency_key uuid not null unique,
 created_at timestamptz not null default now(),
 constraint ccx_trust_messages_staff_consistency check
 ((author='reporter' and staff_id is null) or (author='staff' and staff_id is not null))
);
create index if not exists ccx_trust_messages_case_time on public.ccx_trust_messages(request_id,created_at,id);
alter table public.ccx_trust_messages enable row level security;
revoke all on table public.ccx_trust_messages from public,anon,authenticated;
create or replace function ccx_workspace_private.ccx_trust_message_notify()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.author='reporter' then
  insert into public.member_notifications(recipient_id,kind,title,details)
  select s.user_id,'trust_case_followup','New message on a confidential request',
  jsonb_build_object('case_id',new.request_id,'message_id',new.id)
  from public.account_security s where s.admin and not s.banned and not s.suspended;
 end if;
 return new;
end $$;
drop trigger if exists ccx_trust_reporter_message_notify on public.ccx_trust_messages;
create trigger ccx_trust_reporter_message_notify after insert on public.ccx_trust_messages
for each row execute function ccx_workspace_private.ccx_trust_message_notify();
revoke all on function ccx_workspace_private.ccx_trust_message_notify() from public,anon,authenticated;

-- Staff cases are available to any verified administrator with AAL2, replies require a case claim.
create or replace function ccx_workspace_private.ccx_trust_staff_thread(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); messages jsonb;
begin
 if u is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from public.account_security where user_id=u and admin and not banned and not suspended) then
  raise exception 'Verified administrator with two-factor authentication required' using errcode='42501';
 end if;
 if not exists(select 1 from public.ccx_trust_requests where id=p_id) then
  raise exception 'Case not found' using errcode='42501';
 end if;
 insert into public.ccx_trust_request_events(request_id,actor_id,action) values(p_id,u,'case_messages_viewed');
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into messages from
 (select id,author,body,created_at from public.ccx_trust_messages
  where request_id=p_id order by created_at asc,id asc limit 100) m;
 return jsonb_build_object('items',messages);
end $$;
create or replace function public.ccx_trust_staff_thread(p_id uuid)
returns jsonb language sql set search_path='' as $$
select ccx_workspace_private.ccx_trust_staff_thread(p_id);
$$;
revoke all on function ccx_workspace_private.ccx_trust_staff_thread(uuid) from public,anon;
grant execute on function ccx_workspace_private.ccx_trust_staff_thread(uuid) to authenticated,service_role;
revoke all on function public.ccx_trust_staff_thread(uuid) from public,anon;
grant execute on function public.ccx_trust_staff_thread(uuid) to authenticated,service_role;

create or replace function ccx_workspace_private.ccx_trust_staff_reply(p_id uuid,p_message text,p_idempotency uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); assigned uuid; msg_id uuid; body text:=btrim(coalesce(p_message,''));
begin
 if u is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from public.account_security where user_id=u and admin and not banned and not suspended) then
  raise exception 'Verified administrator with two-factor authentication required' using errcode='42501';
 end if;
 if p_id is null or p_idempotency is null or char_length(body) not between 2 and 4000 then
  raise exception 'Valid reply required' using errcode='22023';
 end if;
 select assigned_reviewer_id into assigned from public.ccx_trust_requests where id=p_id for update;
 if not found or assigned is distinct from u then
  raise exception 'Claim the case before replying' using errcode='42501';
 end if;
 insert into public.ccx_trust_messages(request_id,author,body,staff_id,idempotency_key)
 values(p_id,'staff',body,u,p_idempotency)
 on conflict(idempotency_key) do nothing returning id into msg_id;
 if msg_id is null then
  select id into msg_id from public.ccx_trust_messages
  where request_id=p_id and idempotency_key=p_idempotency and staff_id=u and author='staff';
  if msg_id is null then raise exception 'Duplicate reference for another case' using errcode='23505';end if;
 else
  insert into public.ccx_trust_request_events(request_id,actor_id,action) values(p_id,u,'reporter_reply_sent');
 end if;
 return jsonb_build_object('sent',true,'id',msg_id);
end $$;
create or replace function public.ccx_trust_staff_reply(p_id uuid,p_message text,p_idempotency uuid)
returns jsonb language sql set search_path='' as $$
select ccx_workspace_private.ccx_trust_staff_reply(p_id,p_message,p_idempotency);
$$;
revoke all on function ccx_workspace_private.ccx_trust_staff_reply(uuid,text,uuid) from public,anon;
grant execute on function ccx_workspace_private.ccx_trust_staff_reply(uuid,text,uuid) to authenticated,service_role;
revoke all on function public.ccx_trust_staff_reply(uuid,text,uuid) from public,anon;
grant execute on function public.ccx_trust_staff_reply(uuid,text,uuid) to authenticated,service_role;

-- Reporter reply requires both random case code and original private access code.
create or replace function ccx_workspace_private.ccx_trust_reporter_reply(
 p_reference uuid,p_access_code uuid,p_rate_key text,p_message text,p_idempotency uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.ccx_trust_requests; n integer; msg_id uuid; body text:=btrim(coalesce(p_message,''));
begin
 if p_reference is null or p_access_code is null or p_idempotency is null
 or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$'
 or char_length(body) not between 2 and 4000 then
  raise exception 'Invalid private reply' using errcode='22023';
 end if;
 insert into public.ccx_trust_rate_limits(bucket_key,window_start,hits)
 values('reply:'||p_rate_key,date_trunc('hour',now()),1)
 on conflict(bucket_key,window_start) do update set hits=public.ccx_trust_rate_limits.hits+1
 returning hits into n;
 if n>12 then raise exception 'Reply limit reached' using errcode='54000';end if;
 select * into item from public.ccx_trust_requests
 where id=p_reference and idempotency_key=p_access_code;
 if not found then return jsonb_build_object('verified',false);end if;
 insert into public.ccx_trust_messages(request_id,author,body,idempotency_key)
 values(item.id,'reporter',body,p_idempotency)
 on conflict(idempotency_key) do nothing returning id into msg_id;
 if msg_id is null then
  select id into msg_id from public.ccx_trust_messages
  where request_id=item.id and idempotency_key=p_idempotency and author='reporter';
  if msg_id is null then raise exception 'Duplicate reference for another case' using errcode='23505';end if;
 else
  insert into public.ccx_trust_request_events(request_id,action) values(item.id,'reporter_followup_received');
 end if;
 return jsonb_build_object('verified',true,'sent',true,'id',msg_id);
end $$;
create or replace function public.ccx_trust_reporter_reply(
 p_reference uuid,p_access_code uuid,p_rate_key text,p_message text,p_idempotency uuid)
returns jsonb language sql set search_path='' as $$
select ccx_workspace_private.ccx_trust_reporter_reply(
 p_reference,p_access_code,p_rate_key,p_message,p_idempotency);
$$;
revoke all on function ccx_workspace_private.ccx_trust_reporter_reply(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.ccx_trust_reporter_reply(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function ccx_workspace_private.ccx_trust_reporter_reply(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.ccx_trust_reporter_reply(uuid,uuid,text,text,uuid) to service_role;

-- Extend existing reporter status with public-safe, capability-protected reply thread.
create or replace function ccx_workspace_private.ccx_trust_reporter_status(
 p_reference uuid,p_access_code uuid,p_rate_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.ccx_trust_requests; n integer; correspondence jsonb;
begin
 if p_reference is null or p_access_code is null or
 p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid private case lookup' using errcode='22023';
 end if;
 insert into public.ccx_trust_rate_limits(bucket_key,window_start,hits)
 values('status:'||p_rate_key,date_trunc('hour',now()),1)
 on conflict(bucket_key,window_start) do update set hits=public.ccx_trust_rate_limits.hits+1
 returning hits into n;
 if n>12 then raise exception 'Status check rate limit reached' using errcode='54000';end if;
 select * into item from public.ccx_trust_requests
 where id=p_reference and idempotency_key=p_access_code;
 if not found then return jsonb_build_object('verified',false);end if;
 insert into public.ccx_trust_request_events(request_id,action)
 values(item.id,'reporter_status_checked');
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into correspondence from
 (select id,author,body,created_at from public.ccx_trust_messages
 where request_id=item.id order by created_at asc,id asc limit 100) m;
 return jsonb_build_object('verified',true,'status',item.status,
  'created_at',item.created_at,'updated_at',coalesce(item.reviewed_at,item.created_at),
  'messages',correspondence,
  'message',case item.status
   when 'pending' then 'Your report is recorded and waiting for review.'
   when 'reviewing' then 'A reviewer is assessing your report.'
   when 'action_required' then 'The case needs further action by the review team.'
   else 'The case was marked resolved. Use the contact channel with your reference if you need clarification or wish to appeal.'
  end);
end $$;
