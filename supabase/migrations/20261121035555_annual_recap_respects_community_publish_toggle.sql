-- Annual feed posts respect the administrator's active publishing policy.
create or replace function ccx_workspace_private.ccx_annual_recap_share_feed(p_recap uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare
 r public.ccx_annual_recaps%rowtype;
 v_post uuid;
 v_body text;
begin
 select * into r from public.ccx_annual_recaps
  where id=p_recap and user_id=p_actor for update;
 if not found then raise exception 'Recap not found' using errcode='P0002';end if;
 if exists(select 1 from public.account_security a
   where a.user_id=p_actor and (a.banned or a.suspended))
   or not exists(select 1 from public.account_security a where a.user_id=p_actor)
   or not exists(select 1 from public.member_admissions m where m.user_id=p_actor
     and m.admitted_at is not null)
 then raise exception 'Member access unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.product_feature_flags
  where key='community_publish' and enabled is true) then
  raise exception 'Community sharing is disabled' using errcode='42501';
 end if;
 if r.feed_post_id is not null then
  return pg_catalog.jsonb_build_object('id',r.feed_post_id,
    'already_shared',true,'hidden',r.feed_hidden_at is not null);
 end if;
 v_body:='My '||r.report_year||' Content Connect X Year in Review: '||
 (r.metrics->>'collaborations')||' collaborations, '||
 (r.metrics->>'new_friends')||' new friends, '||
 (r.metrics->>'published_posts')||' posts, and '||
 (r.metrics->>'featured_portfolio_items')||' featured portfolio projects. '||
 'Grateful for the people and projects that made this year memorable! #CCXYearInReview';
 insert into public.community_posts(author_id,body,status,published_at,audience,allow_repost)
  values(p_actor,v_body,'published',now(),'verified',false) returning id into v_post;
 update public.ccx_annual_recaps set feed_post_id=v_post,shared_at=now() where id=r.id;
 insert into public.ccx_annual_recap_events(recap_id,actor_id,action,metadata)
  values(r.id,p_actor,'feed_shared',pg_catalog.jsonb_build_object('post_id',v_post));
 return pg_catalog.jsonb_build_object('id',v_post,'already_shared',false,'hidden',false);
end $body$;
