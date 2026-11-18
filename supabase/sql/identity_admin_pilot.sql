-- Private, time-bounded owner testing. NEVER grants membership or certifies privacy/security.
begin;
create table public.ccx_idv_pilot_config (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 expires_at timestamptz not null default now()+interval '7 days',
 worker_origin text not null check(worker_origin ~ '^https://[a-z0-9.-]+[.]up[.]railway[.]app$'),
 last_cleanup_at timestamptz, last_probe_at timestamptz
);
insert into public.ccx_idv_pilot_config(singleton,worker_origin) values(true,'https://ccx-identity-worker-staging.up.railway.app');
create table public.ccx_idv_pilot_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 legal_name text not null check(length(legal_name) between 1 and 160),
 document_type text not null check(document_type in ('passport','drivers_license','national_id')),
 issuing_country text not null check(issuing_country='US'),
 status text not null default 'collecting' check(status in ('collecting','processing','retryable_error','review_required','name_mismatch','age_restricted','approved','cancelled','expired')),
 reason text not null default 'collecting', expected_name text, eligible_on date,
 diagnostics jsonb not null default '{}', evidence jsonb not null default '{}',
 challenge_id uuid not null default gen_random_uuid(),
 directions text[] not null check(array_length(directions,1)=2 and directions <@ array['left','right']),
 consent_version text not null, consent_hash text not null check(consent_hash ~ '^[a-f0-9]{64}$'), consent_notice text not null,
 job_hash text, job_expires_at timestamptz, claimed_at timestamptz, attempts integer not null default 0,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes',
 purge_after timestamptz not null default now()+interval '24 hours', deletion_started_at timestamptz, purged_at timestamptz
);
create index ccx_idv_pilot_owner_time on public.ccx_idv_pilot_sessions(user_id,created_at desc);
create index ccx_idv_pilot_purge_time on public.ccx_idv_pilot_sessions(purge_after) where purged_at is null;
create table public.ccx_idv_pilot_uploads (
 path text primary key, session_id uuid references public.ccx_idv_pilot_sessions(id),
 kind text not null check(kind in ('front','back','capture','selfie','probe')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), bytes integer not null check(bytes between 1 and 8388608),
 content_type text not null check(content_type in ('image/jpeg','image/png','application/json')),
 reserved_at timestamptz not null default now(), saved_at timestamptz, unique(session_id,kind),
 check((session_id is null and kind='probe' and path ~ '^system-probes/[a-f0-9-]+[.]png$') or (session_id is not null and kind<>'probe'))
);
alter table public.ccx_idv_pilot_config enable row level security;
alter table public.ccx_idv_pilot_sessions enable row level security;
alter table public.ccx_idv_pilot_uploads enable row level security;
revoke all on public.ccx_idv_pilot_config,public.ccx_idv_pilot_sessions,public.ccx_idv_pilot_uploads from public,anon,authenticated,service_role;
grant select,update on public.ccx_idv_pilot_config to service_role;
grant select,insert,update,delete on public.ccx_idv_pilot_sessions,public.ccx_idv_pilot_uploads to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ccx-identity-pilot-evidence','ccx-identity-pilot-evidence',false,8388608,array['image/jpeg','image/png','application/json']);
create policy ccx_pilot_no_browser_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'ccx-identity-pilot-evidence');
create policy ccx_pilot_no_browser_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'ccx-identity-pilot-evidence');
create policy ccx_pilot_no_browser_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'ccx-identity-pilot-evidence') with check(bucket_id<>'ccx-identity-pilot-evidence');
create policy ccx_pilot_no_browser_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'ccx-identity-pilot-evidence');

-- All actions are service-only and recheck the trusted admin role. No Auth metadata authorization.
create function public.ccx_idv_pilot_transition(p_user uuid,p_session uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ccx_idv_pilot_sessions%rowtype; cfg public.ccx_idv_pilot_config%rowtype; u public.ccx_idv_pilot_uploads%rowtype; actor uuid:=p_user; permitted boolean;
begin
 if p_action<>'start' then
  select * into s from public.ccx_idv_pilot_sessions where id=p_session for update;
  if not found then raise exception 'PILOT_SESSION_NOT_FOUND'; end if;
  if p_action='claim' then actor:=s.user_id; elsif actor is null or actor is distinct from s.user_id then raise exception 'PILOT_SESSION_NOT_FOUND'; end if;
 end if;
 if actor is null or not exists(select 1 from public.account_security a join public.member_admissions m on m.user_id=a.user_id where a.user_id=actor and a.admin and not a.banned and not a.suspended) then raise exception 'PILOT_ADMIN_REQUIRED'; end if;
 select * into strict cfg from public.ccx_idv_pilot_config where singleton;
 permitted:=cfg.enabled and cfg.expires_at>now() and cfg.last_cleanup_at>now()-interval '45 minutes' and cfg.last_probe_at is not null;
 if p_action='cancel' then
  update public.ccx_idv_pilot_sessions set status='cancelled',reason='deletion_requested',purge_after=least(purge_after,now()),expires_at=least(expires_at,now()),job_hash=null,job_expires_at=null where id=s.id returning * into s;
 elsif p_action='start' then
  if not coalesce(permitted,false) then raise exception 'PILOT_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,8118));
  select * into s from public.ccx_idv_pilot_sessions where user_id=actor and status in ('collecting','processing','name_mismatch') and expires_at>now() and deletion_started_at is null order by created_at desc limit 1;
  if found then return to_jsonb(s); end if;
  if (select count(*) from public.ccx_idv_pilot_sessions where user_id=actor and created_at>now()-interval '24 hours')>=10 then raise exception 'PILOT_DAILY_LIMIT'; end if;
  if p_data->>'consent_version' is distinct from 'ccx-private-test-2026-11-18-v1' or length(coalesce(p_data->>'consent_notice',''))<200 or coalesce(p_data->>'consent_hash','') !~ '^[a-f0-9]{64}$' or p_data->>'consent_hash' is distinct from encode(extensions.digest(p_data->>'consent_notice','sha256'),'hex') then raise exception 'PILOT_CONSENT_REQUIRED'; end if;
  insert into public.ccx_idv_pilot_sessions(id,user_id,legal_name,document_type,issuing_country,consent_version,consent_hash,consent_notice,directions)
   values(p_session,actor,p_data->>'legal_name',p_data->>'document_type',p_data->>'issuing_country',p_data->>'consent_version',p_data->>'consent_hash',p_data->>'consent_notice',array[case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end,case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end]) returning * into s;
 else
  if not coalesce(permitted,false) or s.expires_at<=now() or s.deletion_started_at is not null or s.purged_at is not null then raise exception 'PILOT_UNAVAILABLE'; end if;
  if p_action='reserve' then
   if s.status<>'collecting' then raise exception 'PILOT_SESSION_LOCKED'; end if;
   if p_data->>'kind' not in ('front','back','selfie','capture') or (s.document_type='passport' and p_data->>'kind'='back') or coalesce(p_data->>'path','') not like actor::text||'/'||s.id::text||'/%' or p_data->>'path' ~ '\.\.' then raise exception 'PILOT_INVALID_UPLOAD'; end if;
   select * into u from public.ccx_idv_pilot_uploads where session_id=s.id and kind=p_data->>'kind';
   if found then if u.sha256 is distinct from p_data->>'sha256' then raise exception 'PILOT_EVIDENCE_IMMUTABLE'; end if; return to_jsonb(u); end if;
   insert into public.ccx_idv_pilot_uploads(path,session_id,kind,sha256,bytes,content_type) values(p_data->>'path',s.id,p_data->>'kind',p_data->>'sha256',(p_data->>'bytes')::integer,p_data->>'content_type') returning * into u;
   return to_jsonb(u);
  elsif p_action='uploaded' then
   if s.status<>'collecting' then raise exception 'PILOT_SESSION_LOCKED'; end if;
   select * into strict u from public.ccx_idv_pilot_uploads where session_id=s.id and path=p_data->>'path';
   update public.ccx_idv_pilot_uploads set saved_at=now() where path=u.path;
   update public.ccx_idv_pilot_sessions set evidence=evidence||jsonb_build_object(u.kind,jsonb_build_object('path',u.path,'sha256',u.sha256)) where id=s.id returning * into s;
  elsif p_action='begin' then
   if s.status not in ('collecting','retryable_error','processing') or (s.status='processing' and s.job_expires_at>now()) then raise exception 'PILOT_SESSION_LOCKED'; end if;
   if s.attempts>=3 then raise exception 'PILOT_ATTEMPT_LIMIT'; end if;
   if not (s.evidence ?& array['front','selfie','capture']) or (s.document_type<>'passport' and not (s.evidence ? 'back')) then raise exception 'PILOT_EVIDENCE_INCOMPLETE'; end if;
   if coalesce(p_data->>'job_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'PILOT_INVALID_CAPABILITY'; end if;
   update public.ccx_idv_pilot_sessions set status='processing',reason='processing',attempts=attempts+1,job_hash=p_data->>'job_hash',job_expires_at=now()+interval '3 minutes',claimed_at=null where id=s.id returning * into s;
  elsif p_action='claim' then
   if s.status<>'processing' or s.claimed_at is not null or s.job_hash is null or s.job_hash is distinct from p_data->>'job_hash' or s.job_expires_at<=now() then raise exception 'PILOT_INVALID_CAPABILITY'; end if;
   update public.ccx_idv_pilot_sessions set claimed_at=now() where id=s.id returning * into s;
  elsif p_action in ('finish','failed') then
   if s.status<>'processing' or s.job_hash is null or s.job_hash is distinct from p_data->>'job_hash' or s.job_expires_at<=now() then raise exception 'PILOT_INVALID_CAPABILITY'; end if;
   if p_action='failed' then
    update public.ccx_idv_pilot_sessions set status='retryable_error',reason='worker_unavailable',job_hash=null,job_expires_at=null where id=s.id returning * into s;
   else
    if s.claimed_at is null or p_data->>'status' not in ('approved','review_required','name_mismatch','age_restricted') or jsonb_typeof(p_data->'diagnostics') is distinct from 'object' then raise exception 'PILOT_INVALID_RESULT'; end if;
    update public.ccx_idv_pilot_sessions set status=p_data->>'status',reason=left(p_data->>'reason',100),expected_name=case when p_data->>'status'='name_mismatch' then p_data->>'expected_name' else null end,eligible_on=(p_data->>'eligible_on')::date,diagnostics=p_data->'diagnostics',job_hash=null,job_expires_at=null where id=s.id returning * into s;
   end if;
  elsif p_action='confirm_name' then
   if s.status<>'name_mismatch' or s.expected_name is null or lower(p_data->>'legal_name') is distinct from lower(s.expected_name) or s.eligible_on is null or s.eligible_on>(now() at time zone 'UTC')::date then raise exception 'PILOT_NAME_MISMATCH'; end if;
   update public.ccx_idv_pilot_sessions set legal_name=s.expected_name,status='approved',reason='test_checks_passed',diagnostics=jsonb_set(diagnostics,'{name_matches}','true'::jsonb) where id=s.id returning * into s;
  else raise exception 'PILOT_INVALID_ACTION'; end if;
 end if;
 insert into public.ccx_idv_events(session_id,actor_id,action,reason) values(s.id,actor,'pilot_'||p_action,s.reason);
 return to_jsonb(s);
end $$;
revoke all on function public.ccx_idv_pilot_transition(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ccx_idv_pilot_transition(uuid,uuid,text,jsonb) to service_role;

-- Ten-minute upload grace prevents late uploads from recreating an already-purged blob.
create function public.ccx_idv_pilot_purge_candidates() returns table(path text)
language plpgsql security invoker set search_path='' as $$
begin
 update public.ccx_idv_pilot_sessions set deletion_started_at=coalesce(deletion_started_at,now()) where (purge_after<=now() or user_id is null) and purged_at is null;
 return query select u.path from public.ccx_idv_pilot_uploads u left join public.ccx_idv_pilot_sessions s on s.id=u.session_id where u.reserved_at<now()-interval '10 minutes' and (u.session_id is null or s.deletion_started_at is not null) order by u.reserved_at limit 100;
end $$;
create function public.ccx_idv_pilot_finish_purge() returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.ccx_idv_pilot_sessions s set legal_name='[deleted]',expected_name=null,eligible_on=null,diagnostics='{}',evidence='{}',job_hash=null,job_expires_at=null,purged_at=now(),status='expired',reason='test_evidence_deleted' where s.deletion_started_at is not null and s.purged_at is null and not exists(select 1 from public.ccx_idv_pilot_uploads u where u.session_id=s.id);
 delete from public.ccx_idv_pilot_sessions where purged_at<now()-interval '7 days';
 update public.ccx_idv_pilot_config set last_cleanup_at=now() where singleton;
end $$;
revoke all on function public.ccx_idv_pilot_purge_candidates(),public.ccx_idv_pilot_finish_purge() from public,anon,authenticated;
grant execute on function public.ccx_idv_pilot_purge_candidates(),public.ccx_idv_pilot_finish_purge() to service_role;
commit;
