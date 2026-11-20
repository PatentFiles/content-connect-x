-- Align SQL authorization with all six professional dashboards. All admitted, active,
-- unbanned members who have a current Premium subscription may publish.
-- Verified platform admins retain their existing Premium-equivalent entitlement
-- across the admin role-preview switcher; a post always belongs to the signed-in user.
-- Preserve audience/media, moderation, rate-limit and server-auth actor checks.
CREATE OR REPLACE FUNCTION public.ccx_feed_create(p_actor uuid, p_body text, p_audience text DEFAULT 'verified'::text, p_media uuid[] DEFAULT '{}'::uuid[], p_repost uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare post_id uuid;media_id uuid;found_id uuid;normalized text:=btrim(coalesce(p_body,''));
begin
 if p_actor is null or p_audience not in ('verified','friends','only_me')
   or length(normalized) not between 5 and 3000
   or coalesce(array_length(p_media,1),0)>4 then
   raise exception 'FEED_INVALID_POST' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('feed-create:'||p_actor::text,831));
 if not exists(select 1 from public.member_admissions where user_id=p_actor and admitted_at is not null)
    or not exists(select 1 from public.account_security where user_id=p_actor and not banned and not suspended)
    or (not exists(select 1 from public.account_security
    where user_id=p_actor and admin=true and not banned and not suspended)
    and not exists(select 1 from public.member_subscriptions
      where user_id=p_actor and status in ('active','trial') and (period_end is null or period_end>now())))
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
end $function$;

CREATE OR REPLACE FUNCTION public.ccx_feed_create_group(p_actor uuid, p_group uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare group_post_id uuid;clean text:=btrim(coalesce(p_body,''));
begin
 if p_actor is null or p_group is null or length(clean) not between 5 and 3000
 then raise exception 'GROUP_INVALID_POST' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('feed-create:'||p_actor::text,831));
 if not exists(select 1 from public.member_admissions
   where user_id=p_actor and admitted_at is not null)
   or not exists(select 1 from public.account_security
   where user_id=p_actor and not banned and not suspended)
   or (not exists(select 1 from public.account_security
    where user_id=p_actor and admin=true and not banned and not suspended)
    and not exists(select 1 from public.member_subscriptions
   where user_id=p_actor and status in ('active','trial') and (period_end is null or period_end>now())))
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
end $function$;

-- The browser cannot pass an arbitrary actor into these privileged functions.
REVOKE ALL ON FUNCTION public.ccx_feed_create(uuid,text,text,uuid[],uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ccx_feed_create_group(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_feed_create(uuid,text,text,uuid[],uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ccx_feed_create_group(uuid,uuid,text) TO service_role;
