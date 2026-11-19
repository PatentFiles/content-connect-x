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
commit;
