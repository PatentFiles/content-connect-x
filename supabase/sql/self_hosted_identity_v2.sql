-- Additive, disabled-by-default rollout. Never imports biometric data into public profiles.
-- Apply on Content Connect's established Supabase project only. No synthetic approvals.
begin;
create table public.ccx_idv_config (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false,
 worker_origin text,
 policy_version text not null default 'ccx-idv-v2' check (policy_version='ccx-idv-v2'),
 security_approved_at timestamptz,
 privacy_approved_at timestamptz,
 notice_version text,
 notice_text text,
 retention_days integer check (retention_days between 1 and 3650),
 rejected_retention_days integer not null default 1 check (rejected_retention_days between 1 and 30),
 supported_countries text[] not null default array['US'],
 check (not enabled or (worker_origin is not null and worker_origin ~ '^https://[a-z0-9.-]+[.]up[.]railway[.]app$'
    and security_approved_at is not null and privacy_approved_at is not null
    and notice_version is not null and length(notice_version)>0 and notice_text is not null and length(notice_text)>80 and retention_days is not null))
);
insert into public.ccx_idv_config(singleton) values(true);
create table public.ccx_idv_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 legal_name text,
 verified_name text,
 verified_at timestamptz,
 eligible_on date,
 updated_at timestamptz not null default now()
);
create table public.ccx_idv_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 status text not null default 'collecting' check (status in ('collecting','processing','retryable_error','review_required','name_mismatch','age_restricted','approved','cancelled','expired')),
 reason text not null default 'collecting',
 document_type text not null check(document_type in ('passport','drivers_license','national_id')),
 issuing_country text not null check(issuing_country ~ '^[A-Z]{2}$'),
 legal_name text not null check(length(legal_name) between 1 and 160),
 extracted_name text,
 dob date,
 eligible_on date,
 document_fingerprint text,
 checks_passed boolean not null default false,
 document_expiry date,
 evidence jsonb not null default '{}' check(jsonb_typeof(evidence)='object'),
 challenge_id uuid not null default gen_random_uuid(),
 directions text[] not null check(array_length(directions,1)=2 and directions <@ array['left','right']),
 consent_version text not null,
 consent_hash text not null check(consent_hash ~ '^[a-f0-9]{64}$'),
 consent_at timestamptz not null default now(),
 policy_version text not null default 'ccx-idv-v2',
 engine_revision text not null default '3c6f17f1aba84bc980dc759f6be42f69b576f439',
 report_hash text check(report_hash ~ '^[a-f0-9]{64}$'),
 model_manifest jsonb,
 job_hash text,
 job_expires_at timestamptz,
 claimed_at timestamptz,
 process_attempts integer not null default 0,
 review_requested_at timestamptz,
 legal_hold boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '20 minutes'),
 purge_after timestamptz not null default (now()+interval '1 day'),
 purged_at timestamptz
);
create index ccx_idv_sessions_user_time on public.ccx_idv_sessions(user_id,created_at desc);
create index ccx_idv_sessions_purge on public.ccx_idv_sessions(purge_after) where purged_at is null and not legal_hold;
create table public.ccx_idv_document_blocks (
 fingerprint text primary key check(fingerprint ~ '^[a-f0-9]{64}$'),
 eligible_on date not null,
 source_session uuid not null,
 created_at timestamptz not null default now()
);
create table public.ccx_idv_events (
 id uuid primary key default gen_random_uuid(),
 session_id uuid,
 actor_id uuid,
 action text not null,
 reason text,
 created_at timestamptz not null default now()
);
create index ccx_idv_events_session_time on public.ccx_idv_events(session_id,created_at);
-- Random keyed hashes resist offline enumeration of low-entropy document numbers.
create table ccx_internal.idv_keys(singleton boolean primary key default true check(singleton), key bytea not null);
insert into ccx_internal.idv_keys(singleton,key) values(true,extensions.gen_random_bytes(32));
alter table ccx_internal.idv_keys enable row level security;
revoke all on ccx_internal.idv_keys from public,anon,authenticated,service_role;
grant usage on schema ccx_internal to service_role;
grant select on ccx_internal.idv_keys to service_role;

alter table public.ccx_idv_config enable row level security;
alter table public.ccx_idv_accounts enable row level security;
alter table public.ccx_idv_sessions enable row level security;
alter table public.ccx_idv_document_blocks enable row level security;
alter table public.ccx_idv_events enable row level security;
-- No browser table access. Authenticated Edge Functions return carefully selected fields.
revoke all on public.ccx_idv_config,public.ccx_idv_accounts,public.ccx_idv_sessions,public.ccx_idv_document_blocks,public.ccx_idv_events from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.ccx_idv_accounts,public.ccx_idv_sessions,public.ccx_idv_document_blocks to service_role;
grant select on public.ccx_idv_config to service_role;
grant select,insert on public.ccx_idv_events to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ccx-identity-evidence','ccx-identity-evidence',false,8388608,array['image/jpeg','image/png','application/json']);
-- Restrictive policies also neutralize accidental broad policies elsewhere on storage.objects.
create policy ccx_idv_no_browser_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'ccx-identity-evidence');
create policy ccx_idv_no_browser_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'ccx-identity-evidence');
create policy ccx_idv_no_browser_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'ccx-identity-evidence') with check(bucket_id<>'ccx-identity-evidence');
create policy ccx_idv_no_browser_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'ccx-identity-evidence');

create function public.ccx_idv_eligible_on(birth date) returns date language sql immutable strict set search_path='' as $$
 select make_date(extract(year from birth)::integer+18,extract(month from birth)::integer,1)+(extract(day from birth)::integer-1)+1
$$;
revoke all on function public.ccx_idv_eligible_on(date) from public,anon,authenticated;
grant execute on function public.ccx_idv_eligible_on(date) to service_role;

-- One transactional state machine. Every call is service-only; the Edge authenticates
-- the user and supplies user_id, or supplies a one-time hashed worker capability.
create function public.ccx_idv_transition(p_user uuid,p_session uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 s public.ccx_idv_sessions%rowtype; cfg public.ccx_idv_config%rowtype;
 today date := (now() at time zone 'UTC')::date; eligible date; blocked date;
 k text; v jsonb; doc_fingerprint text; final_status text; final_reason text; actor uuid := p_user;
begin
 select * into strict cfg from public.ccx_idv_config where singleton;
 if p_user is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,7211));
  if not exists(select 1 from public.account_security where user_id=p_user and not banned and not suspended)
   then raise exception 'ACCOUNT_RESTRICTED'; end if;
 end if;
 if p_action='start' then
  if not cfg.enabled then raise exception 'VERIFICATION_UNAVAILABLE'; end if;
  -- This RPC is service-only. The Edge authenticates getUser and checks verified email
  -- and anonymous status; service_role intentionally has no auth.users SELECT grant.
  if p_user is null then raise exception 'CONFIRM_EMAIL'; end if;
  select eligible_on into blocked from public.ccx_idv_accounts where user_id=p_user;
  if blocked>today then return jsonb_build_object('status','age_restricted','reason','under_18','eligible_on',blocked); end if;
  select * into s from public.ccx_idv_sessions where user_id=p_user and status in ('collecting','processing','name_mismatch') and expires_at>now() order by created_at desc limit 1;
  if found then return to_jsonb(s); end if;
  if (select count(*) from public.ccx_idv_sessions where user_id=p_user and created_at>now()-interval '24 hours')>=3 then raise exception 'DAILY_ATTEMPT_LIMIT'; end if;
  if p_data->>'consent_version' is distinct from cfg.notice_version or p_data->>'consent_hash' is distinct from encode(extensions.digest(cfg.notice_text,'sha256'),'hex') then raise exception 'NOTICE_CHANGED'; end if;
  if not ((p_data->>'issuing_country')=any(cfg.supported_countries)) then raise exception 'COUNTRY_UNSUPPORTED'; end if;
  insert into public.ccx_idv_accounts(user_id,legal_name) values(p_user,p_data->>'legal_name')
   on conflict(user_id) do update set legal_name=excluded.legal_name,updated_at=now() where ccx_idv_accounts.verified_at is null;
  insert into public.ccx_idv_sessions(id,user_id,document_type,issuing_country,legal_name,directions,consent_version,consent_hash,purge_after)
   values(p_session,p_user,p_data->>'document_type',p_data->>'issuing_country',p_data->>'legal_name',
    array[case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end,case when get_byte(extensions.gen_random_bytes(1),0)%2=0 then 'left' else 'right' end],
    cfg.notice_version,p_data->>'consent_hash',now()+make_interval(days=>cfg.rejected_retention_days)) returning * into s;
 else
  select * into s from public.ccx_idv_sessions where id=p_session for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_action<>'claim' and (p_user is null or s.user_id is distinct from p_user) then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_action in ('upload','begin','confirm_name') and (not cfg.enabled or s.expires_at<=now() or s.purged_at is not null) then raise exception 'SESSION_EXPIRED_OR_DISABLED'; end if;
  if p_action='upload' then
   if s.status<>'collecting' or jsonb_typeof(p_data->'parts') is distinct from 'object' then raise exception 'SESSION_LOCKED'; end if;
   for k,v in select key,value from jsonb_each(p_data->'parts') loop
    if jsonb_typeof(v) is distinct from 'object' or k not in ('front','back','selfie','capture') or coalesce(v->>'path','') not like s.user_id::text||'/'||s.id::text||'/%'
     or v->>'path' ~ '\.\.' or coalesce(v->>'sha256','') !~ '^[a-f0-9]{64}$' or not (v ? 'path' and v ? 'sha256') then raise exception 'INVALID_EVIDENCE'; end if;
    if s.evidence ? k and (s.evidence->k->>'sha256') is distinct from (v->>'sha256') then raise exception 'EVIDENCE_IMMUTABLE'; end if;
   end loop;
   update public.ccx_idv_sessions set evidence=evidence||(p_data->'parts'),updated_at=now() where id=s.id returning * into s;
  elsif p_action='begin' then
   if s.status not in ('collecting','retryable_error','processing') or (s.status='processing' and s.job_expires_at>now()) then raise exception 'SESSION_LOCKED'; end if;
   if s.process_attempts>=3 then raise exception 'ATTEMPT_LIMIT'; end if;
   if not (s.evidence ?& array['front','selfie','capture']) or (s.document_type<>'passport' and not (s.evidence ? 'back')) then raise exception 'EVIDENCE_INCOMPLETE'; end if;
   if coalesce(p_data->>'job_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CAPABILITY'; end if;
   update public.ccx_idv_sessions set status='processing',reason='processing',job_hash=p_data->>'job_hash',job_expires_at=now()+interval '3 minutes',claimed_at=null,process_attempts=process_attempts+1,updated_at=now() where id=s.id returning * into s;
  elsif p_action='claim' then
   if not cfg.enabled or s.status<>'processing' or s.claimed_at is not null or s.job_expires_at<=now() or s.job_hash is null or s.job_hash is distinct from (p_data->>'job_hash') then raise exception 'INVALID_CAPABILITY'; end if;
   update public.ccx_idv_sessions set claimed_at=now() where id=s.id returning * into s;
   insert into public.ccx_idv_events(session_id,action,reason) values(s.id,'worker_claim','capability_consumed');
   return to_jsonb(s);
  elsif p_action in ('finish','confirm_name') then
   if not cfg.enabled or s.purged_at is not null then raise exception 'VERIFICATION_UNAVAILABLE'; end if;
   if p_action='finish' then
    if s.status<>'processing' or s.claimed_at is null or s.job_expires_at<=now() or s.job_hash is distinct from (p_data->>'job_hash') then raise exception 'INVALID_CAPABILITY'; end if;
    if coalesce(p_data->>'report_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REPORT'; end if;
    if p_data->>'checks_passed'='true' then
     if coalesce(p_data->>'extracted_name','')='' or length(p_data->>'extracted_name')>160 or length(coalesce(p_data->>'document_number',''))<3 then raise exception 'INVALID_REPORT'; end if;
     if p_data->>'dob' is null or p_data->>'document_expiry' is null or (p_data->>'dob')::date>today or (p_data->>'dob')::date<today-interval '120 years' or (p_data->>'document_expiry')::date<today then raise exception 'INVALID_REPORT'; end if;
     select encode(extensions.hmac(s.issuing_country||':'||s.document_type||':'||upper(p_data->>'document_number'),encode(key,'hex'),'sha256'),'hex') into doc_fingerprint from ccx_internal.idv_keys where singleton;
     update public.ccx_idv_sessions set checks_passed=true,extracted_name=p_data->>'extracted_name',dob=(p_data->>'dob')::date,document_expiry=(p_data->>'document_expiry')::date,document_fingerprint=doc_fingerprint,report_hash=p_data->>'report_hash',model_manifest=p_data->'model_manifest' where id=s.id returning * into s;
    else
     update public.ccx_idv_sessions set checks_passed=false,report_hash=p_data->>'report_hash',status='review_required',reason=left(coalesce(p_data->>'reason','checks_incomplete'),100),job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
    end if;
   else
    if s.status<>'name_mismatch' or not s.checks_passed or s.report_hash is null or lower(p_data->>'legal_name') is distinct from lower(s.extracted_name) then raise exception 'NAME_DOES_NOT_MATCH'; end if;
    update public.ccx_idv_sessions set legal_name=s.extracted_name where id=s.id returning * into s;
   end if;
   if s.checks_passed then
    eligible:=public.ccx_idv_eligible_on(s.dob);
    select max(d) into blocked from (
     select eligible_on as d from public.ccx_idv_accounts where user_id=s.user_id
     union all select eligible_on from public.ccx_idv_document_blocks where ccx_idv_document_blocks.fingerprint=s.document_fingerprint
    ) b;
    if greatest(eligible,blocked)>today then
     eligible:=greatest(eligible,blocked); final_status:='age_restricted'; final_reason:=case when today=eligible-1 then 'birthday_wait' else 'under_18' end;
     insert into public.ccx_idv_accounts(user_id,eligible_on) values(s.user_id,eligible)
      on conflict(user_id) do update set eligible_on=greatest(ccx_idv_accounts.eligible_on,excluded.eligible_on),updated_at=now();
     insert into public.ccx_idv_document_blocks(fingerprint,eligible_on,source_session) values(s.document_fingerprint,eligible,s.id)
      on conflict(fingerprint) do update set eligible_on=greatest(ccx_idv_document_blocks.eligible_on,excluded.eligible_on);
    elsif lower(s.legal_name) is distinct from lower(s.extracted_name) then final_status:='name_mismatch';final_reason:='legal_name_mismatch';
    else final_status:='approved';final_reason:='checks_passed'; end if;
    update public.ccx_idv_sessions set status=final_status,reason=final_reason,eligible_on=eligible,job_hash=null,job_expires_at=null,updated_at=now(),
     purge_after=now()+make_interval(days=>case when final_status='approved' then cfg.retention_days else cfg.rejected_retention_days end) where id=s.id returning * into s;
    if final_status='approved' then
     insert into public.ccx_idv_accounts(user_id,legal_name,verified_name,verified_at,eligible_on) values(s.user_id,s.extracted_name,s.extracted_name,now(),eligible)
      on conflict(user_id) do update set legal_name=excluded.legal_name,verified_name=excluded.verified_name,verified_at=excluded.verified_at,eligible_on=excluded.eligible_on,updated_at=now();
     update public.member_profiles set real_name=s.extracted_name where id=s.user_id;
     insert into public.age_verification_requests(id,user_id,status,provider,provider_session_id,verification_method,evidence_reference,id_document_path,selfie_document_path,verified_at,expires_at)
      values(s.id,s.user_id,'approved','idswyft_self_hosted',s.id::text,'DOCUMENT_SELFIE',s.report_hash,s.evidence->'front'->>'path',s.evidence->'selfie'->>'path',now(),(s.document_expiry+1)::timestamp at time zone 'UTC');
     -- Existing record_age_admission trigger creates the single durable admission.
    end if;
   end if;
  elsif p_action='fail' then
   if s.status='processing' and s.job_hash is not distinct from (p_data->>'job_hash') then
    update public.ccx_idv_sessions set status='retryable_error',reason='worker_unavailable',job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
   end if;
  elsif p_action='request_review' then
   if s.status not in ('age_restricted','name_mismatch','review_required','retryable_error') then raise exception 'REVIEW_UNAVAILABLE'; end if;
   update public.ccx_idv_sessions set review_requested_at=coalesce(review_requested_at,now()),updated_at=now() where id=s.id returning * into s;
  elsif p_action='cancel' then
   if s.status not in ('collecting','retryable_error','name_mismatch','review_required') then raise exception 'SESSION_LOCKED'; end if;
   update public.ccx_idv_sessions set status='cancelled',job_hash=null,job_expires_at=null,updated_at=now() where id=s.id returning * into s;
  else raise exception 'INVALID_ACTION'; end if;
 end if;
 insert into public.ccx_idv_events(session_id,actor_id,action,reason) values(s.id,actor,p_action,s.reason);
 return to_jsonb(s);
end $$;
revoke all on function public.ccx_idv_transition(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ccx_idv_transition(uuid,uuid,text,jsonb) to service_role;

-- Preserve the old provider guard while disabled. After activation, new approvals
-- must be bound to this pipeline; a Yoti callback cannot bypass name/DOB restrictions.
create or replace function ccx_internal.require_yoti_new_approval() returns trigger
language plpgsql security invoker set search_path='' as $$
declare cfg public.ccx_idv_config%rowtype; s public.ccx_idv_sessions%rowtype;
begin
 if NEW.status='approved' and (TG_OP='INSERT' or OLD.status is distinct from 'approved') then
  if exists(select 1 from public.ccx_idv_accounts where user_id=NEW.user_id and eligible_on>(now() at time zone 'UTC')::date) then raise exception 'Age restriction is active'; end if;
  select * into cfg from public.ccx_idv_config where singleton;
  if NEW.provider='idswyft_self_hosted' then
   select * into s from public.ccx_idv_sessions where id=NEW.id and user_id=NEW.user_id;
   if cfg.singleton is distinct from true or not cfg.enabled or s.id is null or s.status<>'approved' or not s.checks_passed or s.policy_version<>'ccx-idv-v2'
    or s.eligible_on is null or s.dob is null or s.report_hash is null or s.eligible_on>(now() at time zone 'UTC')::date or s.report_hash is distinct from NEW.evidence_reference
    or NEW.provider_session_id is distinct from s.id::text or NEW.verification_method is distinct from 'DOCUMENT_SELFIE'
    or NEW.verified_at is null or not (s.evidence ?& array['front','selfie','capture']) then raise exception 'Bound identity evidence required'; end if;
  else
   if cfg.singleton is distinct from true or cfg.enabled or NEW.provider is distinct from 'yoti' or NEW.verification_method is distinct from 'DOC_SCAN' or NEW.verified_at is null or coalesce(length(NEW.evidence_reference),0)=0
    or not exists(select 1 from public.ccx_age_provider_sessions p where p.user_id=NEW.user_id and p.provider_session_id=NEW.provider_session_id and p.provider='yoti' and p.mode='age_gate' and p.policy_version='document_selfie_v1') then raise exception 'Bound provider evidence required'; end if;
  end if;
 end if;
 return NEW;
end $$;
revoke all on function ccx_internal.require_yoti_new_approval() from public,anon,authenticated;

create function ccx_internal.lock_verified_legal_name() returns trigger language plpgsql security definer set search_path='' as $$
declare verified text;
begin
 if NEW.real_name is distinct from OLD.real_name then
  if auth.uid() is not null and auth.uid() is distinct from NEW.id then raise exception 'Profile ownership required'; end if;
  select verified_name into verified from public.ccx_idv_accounts where user_id=NEW.id;
  if verified is not null and NEW.real_name is distinct from verified then raise exception 'The verified legal name can only change through reverification'; end if;
 end if; return NEW;
end $$;
revoke all on function ccx_internal.lock_verified_legal_name() from public,anon,authenticated;
create trigger ccx_lock_verified_legal_name before update of real_name on public.member_profiles for each row execute function ccx_internal.lock_verified_legal_name();

-- Allocate a deletion ledger BEFORE every storage write, including failed uploads.
create table public.ccx_idv_uploads (
 path text primary key,
 session_id uuid not null references public.ccx_idv_sessions(id),
 created_at timestamptz not null default now()
);
create index ccx_idv_uploads_session on public.ccx_idv_uploads(session_id);
alter table public.ccx_idv_uploads enable row level security;
revoke all on public.ccx_idv_uploads from public,anon,authenticated;
grant select,insert,delete on public.ccx_idv_uploads to service_role;
-- Bound abandoned/racing uploads before any blob is written. A failed transfer may
-- be retried, but cannot allocate unbounded storage while one session is open.
create function ccx_internal.limit_idv_uploads() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.ccx_idv_sessions%rowtype;
begin
 select * into s from public.ccx_idv_sessions where id=NEW.session_id for update;
 if not found or s.status<>'collecting' or s.expires_at<=now() or s.user_id is null or
 NEW.path not like s.user_id::text||'/'||s.id::text||'/%' then raise exception 'SESSION_LOCKED'; end if;
 if (select count(*) from public.ccx_idv_uploads where session_id=s.id)>=12 then raise exception 'ATTEMPT_LIMIT'; end if;
 return NEW;
end $$;
revoke all on function ccx_internal.limit_idv_uploads() from public,anon,authenticated;
create trigger ccx_limit_idv_uploads before insert on public.ccx_idv_uploads for each row execute function ccx_internal.limit_idv_uploads();
create function public.ccx_idv_purge_candidates() returns table(path text,session_id uuid)
language sql security invoker set search_path='' as $$
 select u.path,u.session_id from public.ccx_idv_uploads u join public.ccx_idv_sessions s on s.id=u.session_id
 where not s.legal_hold and (s.user_id is null or s.purge_after<now()
  or (u.created_at<now()-interval '1 hour' and not exists(select 1 from jsonb_each(s.evidence) e where e.value->>'path'=u.path)))
 order by u.created_at limit 100
$$;
create function public.ccx_idv_finish_purge() returns void language sql security invoker set search_path='' as $$
 update public.ccx_idv_sessions s set evidence='{}',extracted_name=null,dob=null,legal_name='[deleted]',document_fingerprint=null,
 model_manifest=null,job_hash=null,job_expires_at=null,purged_at=now(),
 status=case when status in ('collecting','processing','retryable_error','name_mismatch') then 'expired' else status end
 where not s.legal_hold and s.purged_at is null and (s.user_id is null or s.purge_after<now())
 and not exists(select 1 from public.ccx_idv_uploads u where u.session_id=s.id);
 delete from public.ccx_idv_document_blocks where eligible_on < (now() at time zone 'UTC')::date;
$$;
revoke all on function public.ccx_idv_purge_candidates(),public.ccx_idv_finish_purge() from public,anon,authenticated;
grant execute on function public.ccx_idv_purge_candidates(),public.ccx_idv_finish_purge() to service_role;

alter table ccx_internal.idv_keys add column maintenance_hash text;
do $$ declare token text:=encode(extensions.gen_random_bytes(32),'hex'); begin
 update ccx_internal.idv_keys set maintenance_hash=encode(extensions.digest(token,'sha256'),'hex') where singleton;
 perform vault.create_secret(token,'ccx_idv_maintenance_token','Identity evidence retention worker authentication');
end $$;
create function public.ccx_idv_maintenance_authorized(p_hash text) returns boolean language sql security invoker set search_path='' as $$
 select coalesce(p_hash=maintenance_hash,false) from ccx_internal.idv_keys where singleton
$$;
revoke all on function public.ccx_idv_maintenance_authorized(text) from public,anon,authenticated;
grant execute on function public.ccx_idv_maintenance_authorized(text) to service_role;
-- Schedule only after the Edge Function has been deployed; see the installation runbook.
commit;
