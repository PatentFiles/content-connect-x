-- A court-reviewed, finite preservation hold for restricted IDV evidence.
-- Ordinary record deletion proceeds unless a scoped active hold requires retention.
-- Restore pre-existing legal_hold state when the LAST CCX case hold ends.
create table if not exists public.ccx_law_idv_baseline(
 session_id uuid primary key references public.ccx_idv_sessions(id) on delete cascade,
 originally_held boolean not null,
 recorded_at timestamptz not null default now()
);
alter table public.ccx_law_idv_baseline enable row level security;
revoke all on public.ccx_law_idv_baseline from PUBLIC,anon,authenticated;

create or replace function public.ccx_law_apply_hold(
 p_case_id uuid,p_admin uuid,p_days integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare c public.ccx_law_cases%rowtype;until timestamptz;changed integer;
begin
 if p_days<1 or p_days>90 or length(btrim(coalesce(p_reason,'')))<25
 then raise exception 'Bounded preservation period and reviewed reason required' using errcode='22023';end if;
 select * into c from public.ccx_law_cases where id=p_case_id for update;
 if not found or c.status<>'approved' or c.expires_at<=now()
  or c.legal_process_type not in('preservation_request','court_order','warrant','subpoena')
 then raise exception 'Active legal-process approval required' using errcode='42501';end if;
 if not exists(select 1 from public.account_security where user_id=p_admin and admin and not banned and not suspended)
 then raise exception 'Authorized administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.subject_user_id::text,0));
 if exists(select 1 from public.ccx_law_holds where case_id=c.id)
 then raise exception 'Case already has a hold' using errcode='23505';end if;
 until:=now()+make_interval(days=>p_days);
 insert into public.ccx_law_idv_baseline(session_id,originally_held)
 select s.id,s.legal_hold from public.ccx_idv_sessions s
 where s.user_id=c.subject_user_id
 on conflict(session_id) do nothing;
 update public.ccx_idv_sessions set legal_hold=true where user_id=c.subject_user_id;
 get diagnostics changed=row_count;
 insert into public.ccx_law_holds(case_id,subject_user_id,expires_at,authorized_by,reason)
 values(c.id,c.subject_user_id,until,p_admin,btrim(p_reason));
 update public.ccx_law_cases set preservation_hold=true where id=c.id;
 insert into public.ccx_law_disclosure_audit(officer_id,case_id,action,subject_user_id,details)
 values(c.officer_id,c.id,'preservation_added',c.subject_user_id,
  jsonb_build_object('authorized_by',p_admin,'expires_at',until,'sessions_held',changed));
 return jsonb_build_object('held',true,'expires_at',until,'sessions_held',changed);
end $body$;
revoke all on function public.ccx_law_apply_hold(uuid,uuid,integer,text) from PUBLIC,anon,authenticated;
grant execute on function public.ccx_law_apply_hold(uuid,uuid,integer,text) to service_role;

create or replace function public.ccx_law_release_hold(p_case_id uuid,p_admin uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare c public.ccx_law_cases%rowtype;h public.ccx_law_holds%rowtype;released integer:=0;
begin
 if length(btrim(coalesce(p_reason,'')))<15 then raise exception 'Release reason is required' using errcode='22023';end if;
 select * into c from public.ccx_law_cases where id=p_case_id for update;
 select * into h from public.ccx_law_holds where case_id=p_case_id and released_at is null for update;
 if not found then return jsonb_build_object('released',false);end if;
 if not exists(select 1 from public.account_security where user_id=p_admin and admin and not banned and not suspended)
 then raise exception 'Authorized administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.subject_user_id::text,0));
 update public.ccx_law_holds set released_at=now() where id=h.id;
 update public.ccx_law_cases set preservation_hold=false where id=c.id;
 if not exists(select 1 from public.ccx_law_holds
   where subject_user_id=c.subject_user_id and released_at is null and expires_at>now())
 then
  update public.ccx_idv_sessions s set legal_hold=b.originally_held
  from public.ccx_law_idv_baseline b
  where b.session_id=s.id and s.user_id=c.subject_user_id;
  get diagnostics released=row_count;
  delete from public.ccx_law_idv_baseline b using public.ccx_idv_sessions s
  where b.session_id=s.id and s.user_id=c.subject_user_id;
 end if;
 insert into public.ccx_law_disclosure_audit(officer_id,case_id,action,subject_user_id,details)
 values(c.officer_id,c.id,'preservation_released',c.subject_user_id,
 jsonb_build_object('authorized_by',p_admin,'reason',left(p_reason,250),'sessions_reconciled',released));
 return jsonb_build_object('released',true,'sessions_reconciled',released);
end $body$;
revoke all on function public.ccx_law_release_hold(uuid,uuid,text) from PUBLIC,anon,authenticated;
grant execute on function public.ccx_law_release_hold(uuid,uuid,text) to service_role;
