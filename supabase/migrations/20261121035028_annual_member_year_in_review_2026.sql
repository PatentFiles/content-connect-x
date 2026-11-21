-- Annual creator/professional recap: server-calculated snapshots; user-controlled sharing.
-- All accounting uses calendar years in UTC. Jan 1 15:00 UTC is Jan 1 across the US.
create table if not exists public.ccx_annual_recaps(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 report_year integer not null check(report_year between 2026 and 2200),
 role_type text not null check(role_type in('creator','photographer','videographer','video_editor','agent','studio')),
 metrics jsonb not null,
 snapshot_version integer not null default 1,
 generated_at timestamptz not null default now(),
 notified_at timestamptz,
 feed_post_id uuid references public.community_posts(id) on delete set null,
 shared_at timestamptz,
 feed_hidden_at timestamptz,
 unique(user_id,report_year),
 check(jsonb_typeof(metrics)='object')
);
create index if not exists ccx_annual_recaps_user_year_idx on public.ccx_annual_recaps(user_id,report_year desc);
alter table public.ccx_annual_recaps enable row level security;
revoke all on public.ccx_annual_recaps from public,anon,authenticated;
grant select,insert,update on public.ccx_annual_recaps to service_role;

create table if not exists public.ccx_annual_recap_events(
 id bigint generated always as identity primary key,
 recap_id uuid not null references public.ccx_annual_recaps(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in('generated','pdf_exported','feed_shared','feed_hidden')),
 occurred_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists ccx_annual_recap_events_idx on public.ccx_annual_recap_events(recap_id,occurred_at desc);
alter table public.ccx_annual_recap_events enable row level security;
revoke all on public.ccx_annual_recap_events from public,anon,authenticated;
grant select,insert on public.ccx_annual_recap_events to service_role;
grant usage,select on sequence public.ccx_annual_recap_events_id_seq to service_role;

create or replace function ccx_workspace_private.ccx_annual_recap_protect()
returns trigger language plpgsql set search_path='' as $body$
begin
 if (new.id,new.user_id,new.report_year,new.role_type,new.metrics,new.snapshot_version,new.generated_at)
    is distinct from
    (old.id,old.user_id,old.report_year,old.role_type,old.metrics,old.snapshot_version,old.generated_at)
 then raise exception 'Annual recap historical metrics are immutable' using errcode='42501';end if;
 return new;
end $body$;
drop trigger if exists ccx_annual_recap_protect on public.ccx_annual_recaps;
create trigger ccx_annual_recap_protect before update on public.ccx_annual_recaps
for each row execute function ccx_workspace_private.ccx_annual_recap_protect();

create or replace function ccx_workspace_private.ccx_annual_recap_event_immutable()
returns trigger language plpgsql set search_path='' as $body$
begin
 raise exception 'Annual recap activity evidence is append-only' using errcode='42501';
end $body$;
drop trigger if exists ccx_annual_recap_event_immutable on public.ccx_annual_recap_events;
create trigger ccx_annual_recap_event_immutable before update or delete on public.ccx_annual_recap_events
for each row execute function ccx_workspace_private.ccx_annual_recap_event_immutable();
revoke all on function ccx_workspace_private.ccx_annual_recap_protect() from public,anon,authenticated;
revoke all on function ccx_workspace_private.ccx_annual_recap_event_immutable() from public,anon,authenticated;

-- One bounded, transactional, crash-safe batch. No future or partial year is eligible.
create or replace function ccx_workspace_private.ccx_annual_recap_generate_batch(p_batch integer default 500)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare
 v_year integer:=extract(year from timezone('UTC',now()))::integer-1;
 v_begin timestamptz;
 v_end timestamptz;
 v_eligible record;
 v_id uuid;
 v_added integer:=0;
 v_metrics jsonb;
 v_projects integer;
 v_friends integer;
 v_posts integer;
 v_portfolio integer;
 v_media integer;
 v_trips integer;
 v_representations integer;
 v_completed integer;
begin
 if v_year<2026 or now() < pg_catalog.make_timestamptz(v_year+1,1,1,15,0,0,'UTC')
 then return pg_catalog.jsonb_build_object('skipped','year not complete or Jan 1 delivery time not reached');end if;
 if p_batch<1 or p_batch>1000 then raise exception 'Invalid annual recap batch size' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(20260101,v_year)
 then return pg_catalog.jsonb_build_object('busy',true);end if;
 v_begin:=pg_catalog.make_timestamptz(v_year,1,1,0,0,0,'UTC');
 v_end:=pg_catalog.make_timestamptz(v_year+1,1,1,0,0,0,'UTC');
 for v_eligible in
  select p.id,p.role_type
  from public.member_profiles p
  join public.account_security a on a.user_id=p.id
  where p.role_type in('creator','photographer','videographer','video_editor','agent','studio')
   and a.banned is false and a.suspended is false
   and exists(select 1 from public.member_admissions ma where ma.user_id=p.id
     and ma.admitted_at is not null and ma.admitted_at<v_end)
   and not exists(select 1 from public.ccx_annual_recaps r
     where r.user_id=p.id and r.report_year=v_year)
  order by p.id
  limit p_batch
 loop
  select count(*)::integer into v_projects
   from public.collaborations c where c.created_at>=v_begin and c.created_at<v_end
   and c.status not in('draft','cancelled','canceled')
   and (c.creator_id=v_eligible.id or exists(
    select 1 from public.collaboration_members cm
    where cm.collaboration_id=c.id and cm.user_id=v_eligible.id));
  select count(*)::integer into v_completed
   from public.collaborations c where c.created_at>=v_begin and c.created_at<v_end
   and c.status in('completed','closed')
   and (c.creator_id=v_eligible.id or exists(
    select 1 from public.collaboration_members cm
    where cm.collaboration_id=c.id and cm.user_id=v_eligible.id));
  select count(distinct case when f.requester_id=v_eligible.id then f.recipient_id else f.requester_id end)::integer
    into v_friends from public.member_connection_requests f
   where f.status='accepted' and f.responded_at>=v_begin and f.responded_at<v_end
   and (f.requester_id=v_eligible.id or f.recipient_id=v_eligible.id);
  select count(*)::integer into v_posts from public.community_posts cp
   where cp.author_id=v_eligible.id and cp.status='published'
    and cp.hidden_at is null and cp.published_at>=v_begin and cp.published_at<v_end;
  select count(*)::integer into v_portfolio from public.member_portfolio_items i
   where i.user_id=v_eligible.id and i.featured is true
     and i.created_at>=v_begin and i.created_at<v_end;
  select count(*)::integer into v_media from public.member_media_assets a
   where a.owner_id=v_eligible.id and a.status='approved' and a.visibility='verified'
    and a.created_at>=v_begin and a.created_at<v_end;
  select count(*)::integer into v_trips from public.ccx_travel_dates t
   where t.user_id=v_eligible.id and t.visible_to_members is true
    and t.starts_at>=v_begin and t.starts_at<v_end;
  select count(*)::integer into v_representations from public.member_representations mr
   where (mr.creator_id=v_eligible.id or mr.representative_id=v_eligible.id)
    and mr.agreed_by_representative_at is not null and mr.agreed_by_professional_at is not null
    and mr.status='active' and mr.starts_at>=v_begin and mr.starts_at<v_end;
  v_metrics:=pg_catalog.jsonb_build_object(
   'collaborations',v_projects,'completed_projects',v_completed,
   'new_friends',v_friends,'published_posts',v_posts,
   'featured_portfolio_items',v_portfolio,'shared_media',v_media,
   'shared_trips',v_trips,'new_representations',v_representations);
  v_id:=null;
  insert into public.ccx_annual_recaps(user_id,report_year,role_type,metrics)
   values(v_eligible.id,v_year,v_eligible.role_type,v_metrics)
   on conflict(user_id,report_year) do nothing returning id into v_id;
  if v_id is not null then
   insert into public.ccx_annual_recap_events(recap_id,action,metadata)
    values(v_id,'generated',pg_catalog.jsonb_build_object('year',v_year,'snapshot_version',1));
   insert into public.member_notifications(recipient_id,kind,title,details)
    values(v_eligible.id,'annual_recap',
      'Your '||v_year||' Year in Review is ready',
      pg_catalog.jsonb_build_object('year',v_year,'recap_id',v_id,'destination','annual-recap'));
   update public.ccx_annual_recaps set notified_at=now() where id=v_id;
   v_added:=v_added+1;
  end if;
 end loop;
 return pg_catalog.jsonb_build_object('year',v_year,'created',v_added,'batch_max',p_batch);
end $body$;

-- Member explicitly opts into one platform-authored, metadata-only feed post per year.
-- This exception to normal premium posting cannot create arbitrary member text.
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

create or replace function ccx_workspace_private.ccx_annual_recap_hide_feed(p_recap uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare r public.ccx_annual_recaps%rowtype;
begin
 select * into r from public.ccx_annual_recaps where id=p_recap and user_id=p_actor for update;
 if not found then raise exception 'Recap not found' using errcode='P0002';end if;
 if r.feed_post_id is null then raise exception 'No shared recap post' using errcode='22023';end if;
 if r.feed_hidden_at is null then
  update public.community_posts set status='hidden',hidden_at=now()
   where id=r.feed_post_id and author_id=p_actor and status='published';
  update public.ccx_annual_recaps set feed_hidden_at=now() where id=r.id;
  insert into public.ccx_annual_recap_events(recap_id,actor_id,action)
   values(r.id,p_actor,'feed_hidden');
 end if;
 return pg_catalog.jsonb_build_object('hidden',true,'id',r.feed_post_id);
end $body$;
revoke all on function ccx_workspace_private.ccx_annual_recap_generate_batch(integer) from public,anon,authenticated;
revoke all on function ccx_workspace_private.ccx_annual_recap_share_feed(uuid,uuid) from public,anon,authenticated;
revoke all on function ccx_workspace_private.ccx_annual_recap_hide_feed(uuid,uuid) from public,anon,authenticated;
grant usage on schema ccx_workspace_private to service_role;
grant execute on function ccx_workspace_private.ccx_annual_recap_generate_batch(integer) to service_role;
grant execute on function ccx_workspace_private.ccx_annual_recap_share_feed(uuid,uuid) to service_role;
grant execute on function ccx_workspace_private.ccx_annual_recap_hide_feed(uuid,uuid) to service_role;

-- Periodic January catch-up. The function itself refuses to run before Jan 1 15:00 UTC.
-- Unique member/year and an advisory transaction lock prevent duplicate deliveries.
select cron.schedule('ccx-annual-recap-january','*/5 * 1-7 1 *',
 $$select ccx_workspace_private.ccx_annual_recap_generate_batch(500);$$);