-- Serialize group conversation membership inserts so a concurrent invite can't overfill a room.
create or replace function ccx_internal.ccx_limit_conversation_group_members()
returns trigger language plpgsql security definer set search_path='' as $$
declare kind text; size_now integer;
begin
 select c.kind into kind from public.conversations c where c.id=new.conversation_id for update;
 if kind='group' then
  select count(*) into size_now from public.conversation_members where conversation_id=new.conversation_id;
  if size_now>=10 then raise exception 'Private group conversations are limited to ten members' using errcode='23514';end if;
 end if;
 return new;
end $$;
drop trigger if exists ccx_limit_group_conversation_members on public.conversation_members;
create trigger ccx_limit_group_conversation_members before insert on public.conversation_members
 for each row execute function ccx_internal.ccx_limit_conversation_group_members();
revoke all on function ccx_internal.ccx_limit_conversation_group_members() from public,anon,authenticated;