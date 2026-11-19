-- Authenticated shared links resolve one precise post only through the existing
-- group/friend/privacy rules. A URL never bypasses membership, blocking or review.
begin;
create or replace function public.ccx_feed_page(p_actor uuid,p_mode text default 'friends',
 p_author uuid default null,p_before timestamptz default null,
 p_before_id uuid default null,p_limit integer default 16)
returns jsonb language plpgsql stable security invoker set search_path='' as $page$
declare output jsonb;
begin
 if p_actor is null or p_mode not in ('friends','following','discover','profile','group','single')
   or p_limit not between 1 and 30 then
  raise exception 'FEED_INVALID_QUERY' using errcode='22023';
 end if;
 if not exists(select 1 from public.member_admissions where user_id=p_actor and admitted_at is not null)
 then raise exception 'FEED_NOT_VERIFIED' using errcode='42501'; end if;
 if p_mode='single' and p_author is null then
   raise exception 'FEED_INVALID_QUERY' using errcode='22023'; end if;
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
    and ((p_mode='group' and p.group_id=p_author)
      or (p_mode='single' and p.id=p_author)
      or (p_mode not in('group','single') and p.group_id is null))
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
commit;
