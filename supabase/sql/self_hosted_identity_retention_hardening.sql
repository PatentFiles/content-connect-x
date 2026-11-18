-- Apply after self_hosted_identity_v2.sql. Never grants membership or enables IDV.
-- A deletion-start marker is permanent: failed storage deletions are retried, not
-- silently reset. A hold that wins the row lock prevents deletion. A hold arriving
-- after deletion starts is explicitly rejected rather than falsely claiming that
-- already-deleted bytes were preserved. Backups require their separate policy.
begin;
alter table public.ccx_idv_sessions add column purge_started_at timestamptz;

create function ccx_internal.guard_idv_retention() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if OLD.purge_started_at is not null then
  if NEW.purge_started_at is distinct from OLD.purge_started_at then
   raise exception 'DELETION_ALREADY_STARTED';
  end if;
  if NEW.legal_hold and not OLD.legal_hold then
   raise exception 'DELETION_ALREADY_STARTED';
  end if;
  if NEW.job_hash is not null or NEW.job_expires_at is not null
   or (NEW.evidence is distinct from OLD.evidence and NEW.evidence<>'{}'::jsonb) then
   raise exception 'DELETION_ALREADY_STARTED';
  end if;
 end if;
 if NEW.purge_started_at is not null and NEW.legal_hold then
  raise exception 'EVIDENCE_ON_LEGAL_HOLD';
 end if;
 return NEW;
end $$;
revoke all on function ccx_internal.guard_idv_retention() from public,anon,authenticated;
create trigger ccx_guard_idv_retention before update on public.ccx_idv_sessions
 for each row execute function ccx_internal.guard_idv_retention();

create or replace function public.ccx_idv_purge_candidates()
returns table(path text,session_id uuid)
language plpgsql security invoker set search_path='' as $$
declare ids uuid[];
begin
 -- Lock sessions before marking them. This shares the row lock used by hold
 -- changes and identity transitions. Only expired/deleted sessions are collected;
 -- abandoned uploads are retained until their session's configured deadline.
 select array_agg(candidate.id) into ids from (
  select s.id from public.ccx_idv_sessions s
  where not s.legal_hold and s.purged_at is null
   and (s.user_id is null or s.purge_after<=now())
   and exists(select 1 from public.ccx_idv_uploads u where u.session_id=s.id)
  order by s.purge_after,s.id limit 10 for update of s skip locked
 ) candidate;
 if ids is null then return; end if;
 with marked as (
  update public.ccx_idv_sessions s
  set purge_started_at=now(),job_hash=null,job_expires_at=null,
      status=case when s.status in ('collecting','processing','retryable_error','name_mismatch') then 'expired' else s.status end
  where s.id=any(ids) and s.purge_started_at is null
  returning s.id
 ) insert into public.ccx_idv_events(session_id,action,reason)
 select id,'retention_deletion_started','Retention deadline reached or account deleted' from marked;
 return query select u.path,u.session_id from public.ccx_idv_uploads u
  where u.session_id=any(ids) order by u.created_at,u.path limit 100;
end $$;
revoke all on function public.ccx_idv_purge_candidates() from public,anon,authenticated;
grant execute on function public.ccx_idv_purge_candidates() to service_role;

create or replace function public.ccx_idv_finish_purge() returns void
language plpgsql security invoker set search_path='' as $$
declare s record;
begin
 for s in select x.id from public.ccx_idv_sessions x
  where not x.legal_hold and x.purged_at is null
   and (x.user_id is null or x.purge_after<=now())
   and not exists(select 1 from public.ccx_idv_uploads u where u.session_id=x.id)
  order by x.purge_after,x.id limit 100 for update of x skip locked
 loop
  update public.ccx_idv_sessions x set
   purge_started_at=coalesce(x.purge_started_at,now()),evidence='{}',
   extracted_name=null,dob=null,legal_name='[deleted]',document_fingerprint=null,
   model_manifest=null,job_hash=null,job_expires_at=null,purged_at=now(),
   status=case when x.status in ('collecting','processing','retryable_error','name_mismatch') then 'expired' else x.status end
  where x.id=s.id;
  update public.age_verification_requests set id_document_path=null,selfie_document_path=null
   where id=s.id and provider='idswyft_self_hosted';
  insert into public.ccx_idv_events(session_id,action,reason)
   values(s.id,'retention_deletion_finished','Blob deletion ledger empty; sensitive session fields minimized');
 end loop;
 delete from public.ccx_idv_document_blocks where eligible_on<(now() at time zone 'UTC')::date;
end $$;
revoke all on function public.ccx_idv_finish_purge() from public,anon,authenticated;
grant execute on function public.ccx_idv_finish_purge() to service_role;
commit;
