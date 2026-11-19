-- Private/public adult professional groups and audited, voluntary membership.
-- Service-only procedures enforce every transition. Sensitive memberships are
-- NEVER public profile fields or advertising-targeting metadata.
begin;
create table public.ccx_social_groups(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(length(btrim(name)) between 3 and 100),
 description text not null default '' check(length(description)<=1000),
 rules text not null default '' check(length(rules)<=1500),
 visibility text not null check(visibility in('public','private')),
 state text not null check(state in('pending_platform','active','rejected','suspended')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
create index ccx_social_groups_discover on public.ccx_social_groups(state,visibility,created_at desc);
create table public.ccx_social_group_members(
 group_id uuid not null references public.ccx_social_groups(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in('owner','admin','member')),
 status text not null default 'requested' check(status in('requested','invited','active','declined','removed','left')),
 invited_by uuid references auth.users(id),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(group_id,user_id),
 check(role<>'owner' or status='active')
);
create index ccx_social_group_members_inbox on public.ccx_social_group_members(group_id,status,requested_at);
create index ccx_social_group_members_user on public.ccx_social_group_members(user_id,status);
create table public.ccx_social_group_events(
 id bigint generated always as identity primary key,
 group_id uuid not null references public.ccx_social_groups(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 action text not null check(action in('created','public_approved','public_rejected','applied','invited','accepted','declined','approved','denied','removed','promoted','demoted','left')),
 recorded_at timestamptz not null default now()
);
create index ccx_social_group_events_time on public.ccx_social_group_events(group_id,recorded_at desc);
alter table public.ccx_social_groups enable row level security;
alter table public.ccx_social_group_members enable row level security;
alter table public.ccx_social_group_events enable row level security;
revoke all on public.ccx_social_groups,public.ccx_social_group_members,public.ccx_social_group_events
 from public,anon,authenticated,service_role;
grant select,insert,update on public.ccx_social_groups to service_role;
grant select,insert,update on public.ccx_social_group_members to service_role;
grant select,insert on public.ccx_social_group_events to service_role;
create function public.ccx_group_events_append_only()
returns trigger language plpgsql security invoker set search_path='' as $immutable$
begin raise exception 'Group audit events are append-only';end $immutable$;
revoke all on function public.ccx_group_events_append_only() from public,anon,authenticated;
create trigger ccx_social_group_events_immutable before update or delete
 on public.ccx_social_group_events for each row execute function public.ccx_group_events_append_only();

create function public.ccx_group_action(
 p_actor uuid,p_action text,p_group uuid default null,p_target uuid default null,
 p_name text default null,p_description text default null,p_visibility text default null,
 p_rules text default null,p_query text default null
) returns jsonb language plpgsql security invoker set search_path='' as $groups$
declare
 g public.ccx_social_groups%rowtype;
 actor_member public.ccx_social_group_members%rowtype;
 target_member public.ccx_social_group_members%rowtype;
 list jsonb; group_id uuid;event_action text;response_status text;
 can_admin boolean:=false;can_owner boolean:=false;
begin
 if p_actor is null or not exists(select 1 from public.member_admissions a
   where a.user_id=p_actor and a.admitted_at is not null)
   or not exists(select 1 from public.account_security a
   where a.user_id=p_actor and not a.banned and not a.suspended)
 then raise exception 'GROUP_NOT_VERIFIED' using errcode='42501'; end if;

 if p_action='discover' then
  select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.created_at desc),'[]'::jsonb)
   into list from (
    select g.id,g.name,g.description,g.rules,g.created_at,g.visibility
    from public.ccx_social_groups g where g.visibility='public' and g.state='active'
      and (p_query is null or length(btrim(p_query))=0 or
        g.name ilike '%'||replace(replace(left(btrim(p_query),60),'%','\%'),'_','\_')||'%' escape '\'
        or g.description ilike '%'||replace(replace(left(btrim(p_query),60),'%','\%'),'_','\_')||'%' escape '\')
    order by g.created_at desc limit 50
   ) row_item;
  return jsonb_build_object('items',list);
 end if;
 if p_action='mine' then
  select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.created_at desc),'[]'::jsonb)
   into list from (
    select g.id,g.name,g.description,g.visibility,g.state,g.created_at,
      m.status as membership_status,m.role as membership_role
    from public.ccx_social_group_members m join public.ccx_social_groups g on g.id=m.group_id
    where m.user_id=p_actor and m.status in ('active','requested','invited')
    order by g.created_at desc limit 100
   ) row_item;
  return jsonb_build_object('items',list);
 end if;
 if p_action='create' then
  if p_visibility not in ('public','private') or p_name is null
   or length(btrim(p_name)) not between 3 and 100
   or length(coalesce(p_description,''))>1000 or length(coalesce(p_rules,''))>1500
  then raise exception 'GROUP_INVALID_FIELDS' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('group-create:'||p_actor::text,941));
  if not exists(select 1 from public.member_subscriptions
    where user_id=p_actor and status in ('active','trial')
      and (period_end is null or period_end>now()))
   then raise exception 'GROUP_PREMIUM_REQUIRED' using errcode='42501'; end if;
  if (select count(*) from public.ccx_social_groups where owner_id=p_actor)>=5
   then raise exception 'GROUP_CREATE_LIMIT' using errcode='54000'; end if;
  insert into public.ccx_social_groups(owner_id,name,description,rules,visibility,state)
   values(p_actor,btrim(p_name),btrim(coalesce(p_description,'')),btrim(coalesce(p_rules,'')),
    p_visibility,case when p_visibility='public' then 'pending_platform' else 'active' end)
   returning id into group_id;
  insert into public.ccx_social_group_members(group_id,user_id,role,status)
   values(group_id,p_actor,'owner','active');
  insert into public.ccx_social_group_events(group_id,actor_id,action)
   values(group_id,p_actor,'created');
  return jsonb_build_object('id',group_id,'state',
   case when p_visibility='public' then 'pending_platform' else 'active' end);
 end if;

 if p_action='admin_queue' then
  if not exists(select 1 from public.account_security
    where user_id=p_actor and admin and not banned and not suspended)
   then raise exception 'GROUP_ADMIN_REQUIRED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.created_at),'[]'::jsonb)
   into list from (
    select id,name,description,rules,owner_id,created_at,visibility
      from public.ccx_social_groups
      where state='pending_platform' and visibility='public'
      order by created_at limit 70
   ) row_item;
  return jsonb_build_object('items',list);
 end if;
 if p_group is null then raise exception 'GROUP_NOT_FOUND' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('group:'||p_group::text,941));
 select * into g from public.ccx_social_groups where id=p_group for update;
 if not found then raise exception 'GROUP_NOT_FOUND' using errcode='42501'; end if;
 select * into actor_member from public.ccx_social_group_members
  where group_id=p_group and user_id=p_actor for update;
 can_owner:=(actor_member.status='active' and actor_member.role='owner');
 can_admin:=(actor_member.status='active' and actor_member.role in('owner','admin'));

 if p_action='moderate' then
  if not exists(select 1 from public.account_security
   where user_id=p_actor and admin and not banned and not suspended)
   then raise exception 'GROUP_ADMIN_REQUIRED' using errcode='42501'; end if;
  if g.visibility<>'public' or g.state<>'pending_platform'
    or p_visibility not in('approve','reject')
   then raise exception 'GROUP_INVALID_REVIEW' using errcode='22023'; end if;
  update public.ccx_social_groups
   set state=case when p_visibility='approve' then 'active' else 'rejected' end,
       reviewed_by=p_actor,reviewed_at=now(),updated_at=now() where id=p_group;
  insert into public.ccx_social_group_events(group_id,actor_id,action)
   values(p_group,p_actor,case when p_visibility='approve' then 'public_approved' else 'public_rejected' end);
  return jsonb_build_object('id',p_group,'state',
   case when p_visibility='approve' then 'active' else 'rejected' end);
 end if;

 if p_action='detail' then
  if g.visibility='private' and actor_member.status not in('active','invited')
    then raise exception 'GROUP_NOT_FOUND' using errcode='42501'; end if;
  if g.visibility='public' and g.state<>'active' and actor_member.status<>'active'
    then raise exception 'GROUP_NOT_FOUND' using errcode='42501'; end if;
  return jsonb_build_object('group',jsonb_build_object(
   'id',g.id,'name',g.name,'description',g.description,'rules',g.rules,
   'visibility',g.visibility,'state',g.state,'owner_id',g.owner_id,
   'member_status',actor_member.status,'member_role',actor_member.role,
   'members', (select count(*) from public.ccx_social_group_members
       where group_id=g.id and status='active')));
 end if;

 if p_action in('requests','members') then
  if not can_admin then raise exception 'GROUP_ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_action='requests' then
   select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.requested_at),'[]'::jsonb)
    into list from (
    select m.user_id,m.requested_at,p.display_name
     from public.ccx_social_group_members m
     left join public.member_profiles p on p.id=m.user_id
     where m.group_id=p_group and m.status='requested'
     order by m.requested_at limit 100
    ) row_item;
  else
   select coalesce(jsonb_agg(to_jsonb(row_item) order by row_item.updated_at),'[]'::jsonb)
    into list from (
     select m.user_id,m.role,m.status,m.updated_at,p.display_name
     from public.ccx_social_group_members m
     left join public.member_profiles p on p.id=m.user_id
     where m.group_id=p_group and m.status in('active','invited')
     order by m.updated_at limit 150
    ) row_item;
  end if;
  return jsonb_build_object('items',list);
 end if;
 if g.state<>'active' then raise exception 'GROUP_UNAVAILABLE' using errcode='42501'; end if;

 if p_action='apply' then
  if g.visibility<>'public' then raise exception 'GROUP_INVITE_ONLY' using errcode='42501'; end if;
  if actor_member.status='active' then return jsonb_build_object('status','active'); end if;
  if actor_member.status in ('removed','left')
   then raise exception 'GROUP_REJOIN_REQUIRES_INVITE' using errcode='42501'; end if;
  if actor_member.status='invited' then return jsonb_build_object('status','invited'); end if;
  insert into public.ccx_social_group_members(group_id,user_id,status)
  values(p_group,p_actor,'requested')
  on conflict(group_id,user_id) do update set status='requested',requested_at=now(),updated_at=now()
   where ccx_social_group_members.status='declined';
  insert into public.ccx_social_group_events(group_id,actor_id,action)
   values(p_group,p_actor,'applied');
  return jsonb_build_object('status','requested');
 end if;

 if p_action in('invite','approve','deny','remove','promote','demote') then
  if not can_admin then raise exception 'GROUP_ADMIN_REQUIRED' using errcode='42501';end if;
  if p_target is null or p_target=p_actor then
   raise exception 'GROUP_INVALID_TARGET' using errcode='22023'; end if;
  select * into target_member from public.ccx_social_group_members
   where group_id=p_group and user_id=p_target for update;
  if p_action='invite' then
   if not exists(select 1 from public.member_admissions
    where user_id=p_target and admitted_at is not null)
    or not exists(select 1 from public.account_security
    where user_id=p_target and not banned and not suspended)
    or exists(select 1 from public.member_blocks b
     where (b.blocker_id=p_target and b.blocked_id=p_actor)
        or (b.blocker_id=p_actor and b.blocked_id=p_target))
   then raise exception 'GROUP_TARGET_UNAVAILABLE' using errcode='42501';end if;
   if target_member.status in ('active','requested','invited','removed','left')
    then raise exception 'GROUP_MEMBERSHIP_EXISTS' using errcode='42501';end if;
   insert into public.ccx_social_group_members(group_id,user_id,status,invited_by)
   values(p_group,p_target,'invited',p_actor)
   on conflict(group_id,user_id) do update set status='invited',invited_by=p_actor,updated_at=now()
    where ccx_social_group_members.status='declined';
   event_action:='invited';response_status:='invited';
  elsif p_action in('approve','deny') then
   if target_member.status<>'requested' then raise exception 'GROUP_REQUEST_NOT_PENDING' using errcode='42501';end if;
   update public.ccx_social_group_members set
     status=case when p_action='approve' then 'active' else 'declined' end,updated_at=now()
     where group_id=p_group and user_id=p_target;
   event_action:=case when p_action='approve' then 'approved' else 'denied' end;
   response_status:=case when p_action='approve' then 'active' else 'declined' end;
  elsif p_action='remove' then
   if target_member.status not in ('active','invited') or target_member.role='owner'
     or (target_member.role='admin' and not can_owner)
    then raise exception 'GROUP_CANNOT_REMOVE' using errcode='42501';end if;
   update public.ccx_social_group_members set status='removed',role='member',updated_at=now()
     where group_id=p_group and user_id=p_target;
   event_action:='removed';response_status:='removed';
  elsif p_action in('promote','demote') then
   if not can_owner or target_member.status<>'active' or
    target_member.role<>case when p_action='promote' then 'member' else 'admin' end
     then raise exception 'GROUP_OWNER_ONLY' using errcode='42501';end if;
   update public.ccx_social_group_members set role=case when p_action='promote' then 'admin' else 'member' end,updated_at=now()
     where group_id=p_group and user_id=p_target;
   event_action:=case when p_action='promote' then 'promoted' else 'demoted' end;
   response_status:='active';
  end if;
  insert into public.ccx_social_group_events(group_id,actor_id,target_id,action)
   values(p_group,p_actor,p_target,event_action);
  return jsonb_build_object('status',response_status);
 end if;
 if p_action in('accept','decline','leave') then
  if p_action='accept' then
   if actor_member.status<>'invited' then raise exception 'GROUP_NO_INVITATION' using errcode='42501';end if;
   update public.ccx_social_group_members set status='active',updated_at=now()
    where group_id=p_group and user_id=p_actor;
   response_status:='active';event_action:='accepted';
  elsif p_action='decline' then
   if actor_member.status not in('invited','requested') then raise exception 'GROUP_NO_REQUEST' using errcode='42501';end if;
   update public.ccx_social_group_members set status='declined',updated_at=now()
    where group_id=p_group and user_id=p_actor;
   response_status:='declined';event_action:='declined';
  else
   if actor_member.status<>'active' or actor_member.role='owner' then
    raise exception 'GROUP_OWNER_TRANSFER_REQUIRED' using errcode='42501'; end if;
   update public.ccx_social_group_members set status='left',role='member',updated_at=now()
    where group_id=p_group and user_id=p_actor;
   response_status:='left';event_action:='left';
  end if;
  insert into public.ccx_social_group_events(group_id,actor_id,action)
   values(p_group,p_actor,event_action);
  return jsonb_build_object('status',response_status);
 end if;
 raise exception 'GROUP_INVALID_ACTION' using errcode='22023';
end $groups$;
revoke all on function public.ccx_group_action(uuid,text,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ccx_group_action(uuid,text,uuid,uuid,text,text,text,text,text) to service_role;

alter table public.community_posts
 add column group_id uuid references public.ccx_social_groups(id) on delete restrict;
alter table public.community_posts drop constraint if exists community_posts_audience_check;
alter table public.community_posts add constraint community_posts_audience_check
 check ((group_id is null and audience in ('verified','friends','only_me')) or
        (group_id is not null and audience='group'));

create or replace function public.ccx_feed_can_view(p_actor uuid,p_post uuid)
returns boolean language sql stable security invoker set search_path='' as $can$
 select p_actor is not null and exists(
  select 1 from public.community_posts p
  join public.account_security a on a.user_id=p.author_id
  where p.id=p_post and p.status='published' and p.hidden_at is null
   and not a.banned and not a.suspended
   and exists(select 1 from public.member_admissions ad where ad.user_id=p_actor and ad.admitted_at is not null)
   and exists(select 1 from public.account_security me where me.user_id=p_actor and not me.banned and not me.suspended)
   and not exists(select 1 from public.member_blocks b
      where (b.blocker_id=p_actor and b.blocked_id=p.author_id)
         or (b.blocker_id=p.author_id and b.blocked_id=p_actor))
   and ((p.group_id is not null and p.audience='group' and exists(
        select 1 from public.ccx_social_groups g
         join public.ccx_social_group_members m on m.group_id=g.id
         where g.id=p.group_id and g.state='active'
           and m.user_id=p_actor and m.status='active'))
    or (p.group_id is null and (p.author_id=p_actor
     or p.audience='verified'
     or (p.audience='friends' and exists (
        select 1 from public.member_connection_requests c
        where c.status='accepted'
        and ((c.requester_id=p_actor and c.recipient_id=p.author_id)
         or (c.recipient_id=p_actor and c.requester_id=p.author_id))))))
   and (p.repost_of is null or exists(
      select 1 from public.community_posts original
      join public.account_security s on s.user_id=original.author_id
      where original.id=p.repost_of and original.status='published'
       and original.hidden_at is null and original.audience='verified'
       and original.group_id is null and original.repost_of is null
       and not s.banned and not s.suspended
       and not exists(select 1 from public.member_blocks b
        where (b.blocker_id=p_actor and b.blocked_id=original.author_id)
           or (b.blocker_id=original.author_id and b.blocked_id=p_actor))
   ))
 );
$can$;

-- The existing cursor query remains the shared source, but the explicit
-- group mode returns posts only to verified active group members.
create or replace function public.ccx_feed_page(p_actor uuid,p_mode text default 'friends',
 p_author uuid default null,p_before timestamptz default null,
 p_before_id uuid default null,p_limit integer default 16)
returns jsonb language plpgsql stable security invoker set search_path='' as $page$
declare output jsonb;
begin
 if p_actor is null or p_mode not in ('friends','following','discover','profile','group')
   or p_limit not between 1 and 30 then
  raise exception 'FEED_INVALID_QUERY' using errcode='22023';
 end if;
 if not exists(select 1 from public.member_admissions where user_id=p_actor and admitted_at is not null)
 then raise exception 'FEED_NOT_VERIFIED' using errcode='42501'; end if;
 if p_mode='group' and (p_author is null or not exists(
   select 1 from public.ccx_social_group_members m join public.ccx_social_groups g on g.id=m.group_id
    where m.group_id=p_author and m.user_id=p_actor and m.status='active' and g.state='active'))
 then raise exception 'GROUP_NOT_MEMBER' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.published_at desc,q.id desc),'[]'::jsonb) into output
 from (
  select p.id,p.author_id,p.body,p.audience,p.group_id,p.repost_of,p.allow_repost,
    p.created_at,coalesce(p.published_at,p.created_at) as published_at,
    mp.display_name,mp.role_type,
    (select count(*) from public.community_reactions r where r.post_id=p.id) as likes,
    exists(select 1 from public.community_reactions r where r.post_id=p.id and r.user_id=p_actor) as liked,
    (select count(*) from public.community_comments c where c.post_id=p.id and c.status='published') as comments,
    exists(select 1 from public.member_saved_posts b where b.user_id=p_actor and b.post_id=p.id) as saved,
    (select count(*) from public.community_posts r where r.repost_of=p.id and r.status='published' and r.hidden_at is null) as reposts,
    (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.storage_path,'caption',m.caption,'mime_type',m.mime_type)
      order by pm.ordinal),'[]'::jsonb)
      from public.ccx_feed_post_media pm join public.member_media_assets m on m.id=pm.media_id
      where pm.post_id=p.id and m.status='approved' and m.uploader_rights_attested) as media,
    (case when p.repost_of is not null then
      (select jsonb_build_object('id',o.id,'body',o.body,'author_id',o.author_id,
         'author_name',om.display_name,'created_at',o.published_at)
       from public.community_posts o left join public.member_profiles om on om.id=o.author_id
       where o.id=p.repost_of and public.ccx_feed_can_view(p_actor,o.id))
     else null end) as original
  from public.community_posts p
  left join public.member_profiles mp on mp.id=p.author_id
  where p.status='published' and p.hidden_at is null
    and public.ccx_feed_can_view(p_actor,p.id)
    and ((p_mode='group' and p.group_id=p_author) or (p_mode<>'group' and p.group_id is null))
    and (p_before is null or
      (coalesce(p.published_at,p.created_at),p.id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-4fff-bfff-ffffffffffff'::uuid)))
    and (p_mode<>'profile' or p.author_id=p_author)
    and (p_mode<>'discover' or p.audience='verified')
    and (p_mode<>'following' or p.author_id=p_actor or exists (
      select 1 from public.member_follows f where f.follower_id=p_actor and f.followed_id=p.author_id))
    and (p_mode<>'friends' or p.author_id=p_actor or exists (
      select 1 from public.member_connection_requests c where c.status='accepted'
       and ((c.requester_id=p_actor and c.recipient_id=p.author_id)
          or (c.recipient_id=p_actor and c.requester_id=p.author_id))))
  order by coalesce(p.published_at,p.created_at) desc,p.id desc
  limit p_limit
 ) q;
 return jsonb_build_object('items',output);
end $page$;

create function public.ccx_feed_create_group(p_actor uuid,p_group uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path='' as $post$
declare group_post_id uuid;clean text:=btrim(coalesce(p_body,''));
begin
 if p_actor is null or p_group is null or length(clean) not between 5 and 3000
 then raise exception 'GROUP_INVALID_POST' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('feed-create:'||p_actor::text,831));
 if not exists(select 1 from public.member_admissions
   where user_id=p_actor and admitted_at is not null)
   or not exists(select 1 from public.account_security
   where user_id=p_actor and not banned and not suspended)
   or not exists(select 1 from public.member_subscriptions
   where user_id=p_actor and status in ('active','trial') and (period_end is null or period_end>now()))
 then raise exception 'FEED_PREMIUM_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.ccx_social_groups g
   join public.ccx_social_group_members m on m.group_id=g.id
   where g.id=p_group and g.state='active' and m.user_id=p_actor and m.status='active')
 then raise exception 'GROUP_NOT_MEMBER' using errcode='42501';end if;
 if (select count(*) from public.community_posts
    where author_id=p_actor and created_at>now()-interval '24 hours')>=5
 then raise exception 'FEED_RATE_LIMIT' using errcode='54000';end if;
 insert into public.community_posts(author_id,body,status,audience,group_id,allow_repost)
 values(p_actor,clean,'pending','group',p_group,false) returning id into group_post_id;
 insert into public.content_moderation_queue(content_type,content_id,submitter_id,status)
 values('post',group_post_id,p_actor,'pending');
 return jsonb_build_object('id',group_post_id,'status','pending');
end $post$;
revoke all on function public.ccx_feed_create_group(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ccx_feed_create_group(uuid,uuid,text) to service_role;
comment on table public.ccx_social_group_members is
 'Sensitive group memberships private by design. Never use as ad targeting features.';
commit;