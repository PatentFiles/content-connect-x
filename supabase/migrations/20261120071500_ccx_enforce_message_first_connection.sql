
-- Every connection route, including the legacy RPC, observes recipient policy.
create or replace function public.ccx_enforce_message_first_friendship()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare setting text; inbound boolean; outbound boolean;
begin
 if new.status <> 'pending' then return new; end if;
 select request_policy into setting from public.ccx_friend_settings where user_id=new.recipient_id;
 setting:=coalesce(setting,'message_first');
 if setting='no_one' then raise exception 'This member is not accepting friend requests' using errcode='P0001'; end if;
 if setting='message_first' then
  select exists(select 1 from public.ccx_intro_messages where sender_id=new.requester_id and recipient_id=new.recipient_id)
    into outbound;
  select exists(select 1 from public.ccx_intro_messages where sender_id=new.recipient_id and recipient_id=new.requester_id)
    into inbound;
  if not (outbound and inbound) then
    raise exception 'Exchange messages before requesting friendship' using errcode='P0001';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists ccx_message_first_friendship on public.member_connection_requests;
create trigger ccx_message_first_friendship before insert or update of status on public.member_connection_requests
 for each row execute function public.ccx_enforce_message_first_friendship();
revoke all on function public.ccx_enforce_message_first_friendship() from public, anon, authenticated;
