-- Connect Feed Phase One: shared moderated community posts, private audiences,
-- owner-attested APPROVED media only and service-role-only access procedures.
-- Does not activate third-party ad pixels or widen public safety intake.
begin;
alter table public.community_posts
 add column if not exists audience text not null default 'verified'
   check (audience in ('verified','friends','only_me')),
 add column if not exists repost_of uuid references public.community_posts(id) on delete restrict,
 add column if not exists allow_repost boolean not null default true,
 add column if not exists hidden_at timestamptz;
create index if not exists ccx_feed_cursor_idx on public.community_posts(status,published_at desc,id desc)
 where hidden_at is null;
create table if not exists public.ccx_feed_post_media(
 post_id uuid not null references public.community_posts(id) on delete cascade,
 media_id uuid not null references public.member_media_assets(id) on delete restrict,
 ordinal smallint not null check(ordinal between 0 and 3),
 primary key(post_id,media_id),unique(post_id,ordinal)
);
create table if not exists public.ccx_feed_flags(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete restrict,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (reason in ('unsafe','rights','privacy','harassment','other')),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(post_id,reporter_id)
);
create index if not exists ccx_feed_flags_queue on public.ccx_feed_flags(status,created_at);
alter table public.ccx_feed_post_media enable row level security;
alter table public.ccx_feed_flags enable row level security;
revoke all on public.ccx_feed_post_media,public.ccx_feed_flags from public,anon,authenticated,service_role;
grant select,insert on public.ccx_feed_post_media to service_role;
grant select,insert,update on public.ccx_feed_flags to service_role;

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
   and (p.author_id=p_actor
     or p.audience='verified'
     or (p.audience='friends' and exists (
        select 1 from public.member_connection_requests c
        where c.status='accepted'
        and ((c.requester_id=p_actor and c.recipient_id=p.author_id)
         or (c.recipient_id=p_actor and c.requester_id=p.author_id)))))
   and (p.repost_of is null or exists(
      select 1 from public.community_posts original
      join public.account_security s on s.user_id=original.author_id
      where original.id=p.repost_of and original.status='published'
       and original.hidden_at is null and original.audience='verified'
       and original.repost_of is null and not s.banned and not s.suspended
       and not exists(select 1 from public.member_blocks b
        where (b.blocker_id=p_actor and b.blocked_id=original.author_id)
           or (b.blocker_id=original.author_id and b.blocked_id=p_actor))
   ))
 );
$can$;
revoke all on function public.ccx_feed_can_view(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ccx_feed_can_view(uuid,uuid) to service_role;

create function public.ccx_feed_page(p_actor uuid,p_mode text default 'friends',
 p_author uuid default null,p_before timestamptz default null,
 p_before_id uuid default null,p_limit integer default 16)
returns jsonb language plpgsql stable security invoker set search_path='' as $page$
declare output jsonb;
begin
 if p_actor is null or p_mode not in ('friends','following','discover','profile')
   or p_limit not between 1 and 30 then
  raise exception 'FEED_INVALID_QUERY' using errcode='22023';
 end if;
 if not exists(select 1 from public.member_admissions where user_id=p_actor and admitted_at is not null)
 then raise exception 'FEED_NOT_VERIFIED' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.published_at desc,q.id desc),'[]'::jsonb) into output
 from (
  select p.id,p.author_id,p.body,p.audience,p.repost_of,p.allow_repost,
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
revoke all on function public.ccx_feed_page(uuid,text,uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.ccx_feed_page(uuid,text,uuid,timestamptz,uuid,integer) to service_role;

create function public.ccx_feed_create(p_actor uuid,p_body text,
 p_audience text default 'verified',p_media uuid[] default '{}',p_repost uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $create$
declare post_id uuid;media_id uuid;found_id uuid;normalized text:=btrim(coalesce(p_body,''));
begin
 if p_actor is null or p_audience not in ('verified','friends','only_me')
   or length(normalized) not between 5 and 3000
   or coalesce(array_length(p_media,1),0)>4 then
   raise exception 'FEED_INVALID_POST' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('feed-create:'||p_actor::text,831));
 if not exists(select 1 from public.member_admissions where user_id=p_actor and admitted_at is not null)
    or not exists(select 1 from public.account_security where user_id=p_actor and not banned and not suspended)
    or not exists(select 1 from public.member_subscriptions
      where user_id=p_actor and status in ('active','trial') and (period_end is null or period_end>now()))
    or not exists(select 1 from public.product_feature_flags
      where key='community_publish' and enabled)
 then raise exception 'FEED_PREMIUM_REQUIRED' using errcode='42501'; end if;
 if (select count(*) from public.community_posts
      where author_id=p_actor and created_at>now()-interval '24 hours')>=5
 then raise exception 'FEED_RATE_LIMIT' using errcode='54000'; end if;
 if p_repost is not null then
   if p_media<>'{}'::uuid[] or not exists(
      select 1 from public.community_posts source
      where source.id=p_repost and source.audience='verified' and source.status='published'
        and source.hidden_at is null and source.allow_repost and source.repost_of is null
        and public.ccx_feed_can_view(p_actor,source.id))
   then raise exception 'FEED_REPOST_UNAVAILABLE' using errcode='42501'; end if;
 end if;
 for media_id in select unnest(coalesce(p_media,'{}'::uuid[])) loop
   if not exists(select 1 from public.member_media_assets m where
        m.id=media_id and m.owner_id=p_actor and m.status='approved'
        and m.uploader_rights_attested and m.mime_type in('image/jpeg','image/png','image/webp')
        and m.visibility<>'private'
        and (p_audience<>'verified' or m.visibility='verified')) then
       raise exception 'FEED_MEDIA_NOT_APPROVED' using errcode='42501'; end if;
 end loop;
 if (select count(distinct x) from unnest(coalesce(p_media,'{}'::uuid[])) x)
      <>coalesce(array_length(p_media,1),0)
 then raise exception 'FEED_DUPLICATE_MEDIA' using errcode='22023'; end if;
 insert into public.community_posts(author_id,body,status,audience,repost_of)
 values(p_actor,normalized,'pending',p_audience,p_repost) returning id into post_id;
 insert into public.ccx_feed_post_media(post_id,media_id,ordinal)
 select post_id,x,i-1 from unnest(coalesce(p_media,'{}'::uuid[])) with ordinality m(x,i);
 insert into public.content_moderation_queue(content_type,content_id,submitter_id,status)
 values('post',post_id,p_actor,'pending');
 return jsonb_build_object('id',post_id,'status','pending');
end $create$;
revoke all on function public.ccx_feed_create(uuid,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.ccx_feed_create(uuid,text,text,uuid[],uuid) to service_role;

create function public.ccx_feed_interact(p_actor uuid,p_post uuid,p_action text,p_text text default null)
returns jsonb language plpgsql security invoker set search_path='' as $interact$
declare id uuid;prior boolean;clean text:=btrim(coalesce(p_text,''));
begin
 if p_actor is null or not public.ccx_feed_can_view(p_actor,p_post) then
  raise exception 'FEED_POST_UNAVAILABLE' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_post::text,932));
 if p_action='like' then
  insert into public.community_reactions(post_id,user_id) values(p_post,p_actor)
    on conflict do nothing;
  return jsonb_build_object('liked',true);
 elsif p_action='unlike' then
  delete from public.community_reactions where post_id=p_post and user_id=p_actor;
  return jsonb_build_object('liked',false);
 elsif p_action='save' then
  insert into public.member_saved_posts(user_id,post_id) values(p_actor,p_post)
    on conflict do nothing;
  return jsonb_build_object('saved',true);
 elsif p_action='unsave' then
  delete from public.member_saved_posts where user_id=p_actor and post_id=p_post;
  return jsonb_build_object('saved',false);
 elsif p_action='comment' then
  if length(clean) not between 2 and 2000 then raise exception 'FEED_INVALID_COMMENT' using errcode='22023'; end if;
  if (select count(*) from public.community_comments
     where author_id=p_actor and created_at>now()-interval '24 hours')>=30
  then raise exception 'FEED_RATE_LIMIT' using errcode='54000'; end if;
  insert into public.community_comments(post_id,author_id,body,status)
  values(p_post,p_actor,clean,'pending') returning id into id;
  insert into public.content_moderation_queue(content_type,content_id,submitter_id,status)
  values('comment',id,p_actor,'pending');
  return jsonb_build_object('status','pending');
 end if;
 raise exception 'FEED_INVALID_ACTION' using errcode='22023';
end $interact$;
revoke all on function public.ccx_feed_interact(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ccx_feed_interact(uuid,uuid,text,text) to service_role;

create function public.ccx_feed_report(p_actor uuid,p_post uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $report$
declare flag_id uuid;
begin
 if p_actor is null or not public.ccx_feed_can_view(p_actor,p_post)
    or p_reason not in ('unsafe','rights','privacy','harassment','other') then
   raise exception 'FEED_INVALID_REPORT' using errcode='42501'; end if;
 insert into public.ccx_feed_flags(post_id,reporter_id,reason)
 values(p_post,p_actor,p_reason)
 on conflict(post_id,reporter_id) do nothing;
 select id into flag_id from public.ccx_feed_flags where post_id=p_post and reporter_id=p_actor;
 return jsonb_build_object('received',true,'reference',flag_id);
end $report$;
revoke all on function public.ccx_feed_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ccx_feed_report(uuid,uuid,text) to service_role;

create function public.ccx_feed_hide(p_actor uuid,p_post uuid)
returns boolean language plpgsql security invoker set search_path='' as $hide$
declare changed integer;
begin
 update public.community_posts set status='hidden',hidden_at=now()
 where id=p_post and author_id=p_actor and hidden_at is null;
 get diagnostics changed=row_count;
 return changed=1;
end $hide$;
revoke all on function public.ccx_feed_hide(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ccx_feed_hide(uuid,uuid) to service_role;

comment on function public.ccx_feed_page(uuid,text,uuid,timestamptz,uuid,integer) is
 'Service-only policy filtered age-gated timeline. No direct browser SELECT on private audiences.';
commit;