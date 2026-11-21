-- Newly captured identity sessions inherit an active, scoped preservation hold.
create or replace function ccx_workspace_private.ccx_law_preserve_new_idv_session()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if exists(select 1 from public.ccx_law_holds h
    where h.subject_user_id=new.user_id and h.released_at is null and h.expires_at>now()) then
  insert into public.ccx_law_idv_baseline(session_id,originally_held)
  values(new.id,coalesce(new.legal_hold,false)) on conflict(session_id) do nothing;
  update public.ccx_idv_sessions set legal_hold=true where id=new.id;
 end if;
 return new;
end $body$;
drop trigger if exists ccx_law_idv_session_inherit on public.ccx_idv_sessions;
create trigger ccx_law_idv_session_inherit after insert on public.ccx_idv_sessions
for each row execute function ccx_workspace_private.ccx_law_preserve_new_idv_session();
revoke all on function ccx_workspace_private.ccx_law_preserve_new_idv_session() from PUBLIC,anon,authenticated;

-- Enforce finite holds. Expiry never authorizes further disclosures and does not
-- erase the immutable disclosure audit or any previously independent hold.
create or replace function public.ccx_law_expire_holds()
returns integer language plpgsql security definer set search_path='' as $body$
declare hold_row public.ccx_law_holds%rowtype;released_count integer:=0;
begin
 for hold_row in select * from public.ccx_law_holds
  where released_at is null and expires_at<=now()
  order by expires_at,id limit 100 for update skip locked loop
  perform pg_advisory_xact_lock(hashtextextended(hold_row.subject_user_id::text,0));
  update public.ccx_law_holds set released_at=now() where id=hold_row.id;
  update public.ccx_law_cases set preservation_hold=false where id=hold_row.case_id;
  if not exists(select 1 from public.ccx_law_holds h
   where h.subject_user_id=hold_row.subject_user_id and h.released_at is null and h.expires_at>now())
  then
   update public.ccx_idv_sessions s set legal_hold=b.originally_held
    from public.ccx_law_idv_baseline b
    where b.session_id=s.id and s.user_id=hold_row.subject_user_id;
   delete from public.ccx_law_idv_baseline b using public.ccx_idv_sessions s
    where b.session_id=s.id and s.user_id=hold_row.subject_user_id;
  end if;
  insert into public.ccx_law_disclosure_audit(officer_id,case_id,action,subject_user_id,details)
  select c.officer_id,c.id,'preservation_released',hold_row.subject_user_id,
   jsonb_build_object('reason','automatic_expiration','hold_expired_at',hold_row.expires_at)
  from public.ccx_law_cases c where c.id=hold_row.case_id;
  released_count:=released_count+1;
 end loop;
 return released_count;
end $body$;
revoke all on function public.ccx_law_expire_holds() from PUBLIC,anon,authenticated;
grant execute on function public.ccx_law_expire_holds() to service_role;
select cron.schedule('ccx_law_hold_daily_expiry','10 1 * * *',$job$
 select public.ccx_law_expire_holds();
$job$);
