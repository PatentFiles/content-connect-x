-- Verified adult creator self-posting without routine photo pre-approval.
-- Only solo, rights-attested, non-sex-act images qualify. This is NOT
-- evidence for other performers' ages/consent and does NOT bypass recordkeeping.
begin;
alter table public.member_media_assets
 add column if not exists approval_origin text not null default 'human_review'
   check(approval_origin in('human_review','verified_self_attestation')),
 add column if not exists content_label text not null default 'professional'
   check(content_label in('professional','adult_nudity')),
 add column if not exists self_only_attested boolean not null default false;

-- Trusted publishing preserves the existing verified Premium age, block,
-- consent/rights, media-audience and daily-rate guards in ccx_feed_create.
-- We record that publication bypassed PRE-review; post-report quarantine remains.
create function public.ccx_feed_create_trusted(
 p_actor uuid,p_body text,p_audience text default 'verified',
 p_media uuid[] default '{}',p_repost uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $trusted$
declare receipt jsonb;pid uuid;count_updated integer;
begin
  receipt:=public.ccx_feed_create(p_actor,p_body,p_audience,p_media,p_repost);
  pid:=(receipt->>'id')::uuid;
  if pid is null then raise exception 'FEED_INVALID_POST' using errcode='22023';end if;
  -- Check pending receipt under the same transaction, so a stale moderation
  -- outcome cannot be silently overwritten by a second browser request.
  update public.community_posts set status='published',published_at=now()
    where id=pid and author_id=p_actor and status='pending'
    returning 1 into count_updated;
  if coalesce(count_updated,0)<>1 then
    raise exception 'FEED_PUBLISH_CONFLICT' using errcode='40001';
  end if;
  update public.content_moderation_queue
   set status='approved',reason='verified_premium_self_publish',reviewed_at=now()
   where content_type='post' and content_id=pid and status='pending';
  return jsonb_build_object('id',pid,'status','published',
    'audience',p_audience,'publication_basis','verified_premium');
end $trusted$;
revoke all on function public.ccx_feed_create_trusted(uuid,text,text,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.ccx_feed_create_trusted(uuid,text,text,uuid[],uuid) to service_role;

-- A report is an allegation, not proof of misconduct. Serious safety, rights
-- and privacy reports temporarily quarantine the post without banning anyone.
-- This still requires qualified human review for any account sanctions.
create or replace function public.ccx_feed_report(p_actor uuid,p_post uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $report$
declare flag_id uuid;quarantined boolean:=false;
begin
 if p_actor is null or not public.ccx_feed_can_view(p_actor,p_post)
    or p_reason not in ('unsafe','rights','privacy','harassment','other') then
   raise exception 'FEED_INVALID_REPORT' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('feed-report:'||p_post::text,952));
 insert into public.ccx_feed_flags(post_id,reporter_id,reason)
 values(p_post,p_actor,p_reason)
 on conflict(post_id,reporter_id) do nothing;
 select id into flag_id from public.ccx_feed_flags where post_id=p_post and reporter_id=p_actor;
 if p_reason in ('unsafe','rights','privacy') or
  (select count(*) from public.ccx_feed_flags where post_id=p_post and status='open')>=2
 then
  update public.community_posts set status='hidden',hidden_at=now()
   where id=p_post and status='published';
  quarantined:=true;
 end if;
 return jsonb_build_object('received',true,'reference',flag_id,'quarantined',quarantined);
end $report$;
revoke all on function public.ccx_feed_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ccx_feed_report(uuid,uuid,text) to service_role;

comment on column public.member_media_assets.self_only_attested is
 'Verified-adult uploader attestations are not verified third-party performer releases. Reposts and other persons require separate authorization.';
comment on function public.ccx_feed_create_trusted(uuid,text,text,uuid[],uuid) is
 'Service-only: verified Premium fast publish. Not permission to share nonconsensual media or waive adult recordkeeping.';
-- Surface only the photo-content label, never owner evidence, private metadata or EXIF.
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
    (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.storage_path,'caption',m.caption,'mime_type',m.mime_type,'content_label',m.content_label)
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
