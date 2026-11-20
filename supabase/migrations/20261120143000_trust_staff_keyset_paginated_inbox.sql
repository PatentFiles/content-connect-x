-- Cursor-paginated confidential admin queue. No case content or reporter code in list results.
create index if not exists ccx_trust_requests_created_cursor_idx
 on public.ccx_trust_requests(created_at desc,id desc);
create index if not exists ccx_trust_requests_status_created_idx
 on public.ccx_trust_requests(status,created_at desc,id desc);
create or replace function ccx_workspace_private.ccx_trust_inbox_page(
 p_filter text default 'open',
 p_before_created timestamptz default null,
 p_before_id uuid default null,
 p_limit integer default 50
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); lim integer:=least(100,greatest(1,coalesce(p_limit,50)));
 f text:=coalesce(p_filter,'open'); raw jsonb:='[]'::jsonb;
 total integer:=0; has_more boolean:=false;
 last_item jsonb; counts jsonb; case_items jsonb;
begin
 if u is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from public.account_security s where s.user_id=u and s.admin and not s.banned and not s.suspended) then
  raise exception 'Verified staff and two-factor authentication required' using errcode='42501';
 end if;
 if f not in('open','urgent','unassigned','mine','resolved','all') then
  raise exception 'Invalid queue filter' using errcode='22023';
 end if;
 if (p_before_created is null) is distinct from (p_before_id is null) then
  raise exception 'Incomplete cursor' using errcode='22023';
 end if;
 insert into public.ccx_trust_request_events(actor_id,action) values(u,'paginated_queue_viewed');
 select jsonb_build_object(
  'unresolved',count(*) filter(where status<>'resolved'),
  'mine',count(*) filter(where status<>'resolved' and assigned_reviewer_id=u),
  'urgent',count(*) filter(where status<>'resolved' and
    (priority in('high','critical') or (due_at is not null and due_at<now()))))
 into counts from public.ccx_trust_requests;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
 into raw from (
  select id,kind,status,priority,created_at,due_at,assigned_reviewer_id,assigned_at,
   (status<>'resolved' and due_at is not null and due_at<now()) as overdue
  from public.ccx_trust_requests
  where (p_before_created is null or (created_at,id)<(p_before_created,p_before_id))
  and (f='all' or
   (f='open' and status<>'resolved') or
   (f='resolved' and status='resolved') or
   (f='mine' and status<>'resolved' and assigned_reviewer_id=u) or
   (f='unassigned' and status<>'resolved' and assigned_reviewer_id is null) or
   (f='urgent' and status<>'resolved' and
    (priority in ('high','critical') or (due_at is not null and due_at<now()))))
  order by created_at desc,id desc
  limit lim+1
 ) q;
 total:=jsonb_array_length(raw);
 has_more:=total>lim;
 if has_more then
  select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into case_items
  from jsonb_array_elements(raw) with ordinality as item(value,ordinal) where ordinal<=lim;
 else case_items:=raw;end if;
 if jsonb_array_length(case_items)>0 then last_item:=case_items->(jsonb_array_length(case_items)-1);end if;
 return jsonb_build_object(
  'items',case_items,
  'counts',counts,
  'reviewer_id',u,
  'has_more',has_more,
  'next_cursor',case when has_more and last_item is not null
    then jsonb_build_object('created_at',last_item->>'created_at','id',last_item->>'id')
    else null end
 );
end $$;
create or replace function public.ccx_trust_inbox_page(
 p_filter text default 'open',
 p_before_created timestamptz default null,
 p_before_id uuid default null,
 p_limit integer default 50
)
returns jsonb language sql set search_path='' as $$
 select ccx_workspace_private.ccx_trust_inbox_page(p_filter,p_before_created,p_before_id,p_limit);
$$;
revoke all on function ccx_workspace_private.ccx_trust_inbox_page(text,timestamptz,uuid,integer) from public,anon;
grant execute on function ccx_workspace_private.ccx_trust_inbox_page(text,timestamptz,uuid,integer) to authenticated,service_role;
revoke all on function public.ccx_trust_inbox_page(text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.ccx_trust_inbox_page(text,timestamptz,uuid,integer) to authenticated,service_role;
