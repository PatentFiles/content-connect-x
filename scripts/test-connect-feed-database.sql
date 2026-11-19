-- Isolated CI fixture. NEVER run against a real Supabase database.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'ccx_feed_test' THEN RAISE EXCEPTION 'Disposable test only'; END IF; END $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table public.member_admissions(user_id uuid primary key references auth.users(id),admitted_at timestamptz);
create table public.account_security(user_id uuid primary key references auth.users(id),banned boolean default false,suspended boolean default false);
create table public.member_subscriptions(user_id uuid primary key references auth.users(id),status text,period_end timestamptz);
create table public.product_feature_flags(key text primary key,enabled boolean);
create table public.member_profiles(id uuid primary key references auth.users(id),display_name text,role_type text);
create table public.member_blocks(blocker_id uuid,blocked_id uuid);
create table public.member_connection_requests(requester_id uuid,recipient_id uuid,status text);
create table public.member_follows(follower_id uuid,followed_id uuid);
create table public.community_posts(
 id uuid primary key default gen_random_uuid(),author_id uuid references auth.users(id),
 body text not null,status text not null default 'pending',created_at timestamptz not null default now(),published_at timestamptz
);
create table public.community_comments(
 id uuid primary key default gen_random_uuid(),post_id uuid references public.community_posts(id),
 author_id uuid references auth.users(id),body text,status text not null default 'pending',created_at timestamptz default now()
);
create table public.community_reactions(
 post_id uuid references public.community_posts(id),user_id uuid references auth.users(id),
 primary key(post_id,user_id)
);
create table public.member_saved_posts(
 user_id uuid references auth.users(id),post_id uuid references public.community_posts(id),primary key(user_id,post_id)
);
create table public.member_media_assets(
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),
 storage_path text,caption text,mime_type text,status text,visibility text,uploader_rights_attested boolean
);
create table public.content_moderation_queue(
 id uuid primary key default gen_random_uuid(),content_type text,content_id uuid,
 submitter_id uuid,status text default 'pending',reason text,reviewed_at timestamptz
);
grant usage on schema public to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
\i supabase/migrations/20261119235000_connect_feed_private_audiences.sql

DO $$ BEGIN
 IF has_table_privilege('authenticated','public.ccx_feed_post_media','SELECT')
  or has_table_privilege('authenticated','public.ccx_feed_flags','SELECT')
  or has_function_privilege('authenticated','public.ccx_feed_page(uuid,text,uuid,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('anon','public.ccx_feed_create(uuid,text,text,uuid[],uuid)','EXECUTE')
 THEN raise exception 'FAIL: browser can bypass protected feed'; END IF;
END $$;

insert into auth.users values
 ('10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000003'),
 ('40000000-0000-4000-8000-000000000004');
insert into public.member_admissions values
 ('10000000-0000-4000-8000-000000000001',now()),
 ('20000000-0000-4000-8000-000000000002',now()),
 ('30000000-0000-4000-8000-000000000003',now());
insert into public.account_security(user_id) select id from auth.users;
insert into public.member_subscriptions values
 ('10000000-0000-4000-8000-000000000001','active',now()+interval '30 days'),
 ('20000000-0000-4000-8000-000000000002','cancelled',null);
insert into public.product_feature_flags values('community_publish',true);
insert into public.member_profiles values
 ('10000000-0000-4000-8000-000000000001','Premium Creator','creator'),
 ('20000000-0000-4000-8000-000000000002','Free Friend','photographer'),
 ('30000000-0000-4000-8000-000000000003','Other Member','studio');
insert into public.member_connection_requests values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','accepted');
insert into public.member_follows values
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
insert into public.member_media_assets(owner_id,storage_path,caption,mime_type,status,visibility,uploader_rights_attested)
 values('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/media/approved.jpg','approved fixture','image/jpeg','approved','verified',true),
 ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/media/unapproved.jpg','pending fixture','image/jpeg','pending','verified',true);
set role service_role;
DO $test$
declare
 a uuid:='10000000-0000-4000-8000-000000000001';
 b uuid:='20000000-0000-4000-8000-000000000002';
 c uuid:='30000000-0000-4000-8000-000000000003';
 d uuid:='40000000-0000-4000-8000-000000000004';
 media uuid;badmedia uuid;created_post uuid;friend_id uuid;recreated_post uuid;out jsonb;items jsonb;cursor timestamptz;
begin
 select id into media from public.member_media_assets where status='approved';
 select id into badmedia from public.member_media_assets where status='pending';
 begin
  perform public.ccx_feed_create(b,'Free member tries to publish','verified',array[]::uuid[],null);
  raise exception 'FAIL: Free member published';
 exception when others then if sqlerrm<>'FEED_PREMIUM_REQUIRED' then raise; end if; end;
 begin
  perform public.ccx_feed_create(d,'Unadmitted member tries to publish','verified',array[]::uuid[],null);
  raise exception 'FAIL: unadmitted member published';
 exception when others then if sqlerrm<>'FEED_PREMIUM_REQUIRED' then raise; end if; end;
 begin
  perform public.ccx_feed_create(a,'An unapproved photo cannot appear','verified',array[badmedia],null);
  raise exception 'FAIL: pending media accepted';
 exception when others then if sqlerrm<>'FEED_MEDIA_NOT_APPROVED' then raise; end if; end;
 out:=public.ccx_feed_create(a,'Project update with one approved photo','verified',array[media],null);
 created_post:=(out->>'id')::uuid;
 if out->>'status'<>'pending' then raise exception 'FAIL: post published before moderation'; end if;
 if (select count(*) from public.content_moderation_queue where content_id=created_post)<>1 then raise exception 'FAIL: missing moderation queue'; end if;
 if public.ccx_feed_can_view(b,created_post) then raise exception 'FAIL: pending post visible'; end if;
 update public.community_posts set status='published',published_at=now() where id=created_post;
 if not public.ccx_feed_can_view(b,created_post) or public.ccx_feed_can_view(d,created_post) then
  raise exception 'FAIL: verified audience'; end if;
 out:=public.ccx_feed_interact(b,created_post,'like');
 if out->>'liked'<>'true' then raise exception 'FAIL: verified Free member cannot react'; end if;
 out:=public.ccx_feed_interact(b,created_post,'comment','Great professional photos');
 if out->>'status'<>'pending' or
  (select count(*) from public.content_moderation_queue where content_type='comment')<>1 then
  raise exception 'FAIL: Free member moderated comment'; end if;
 out:=public.ccx_feed_report(b,created_post,'privacy');
 if out->>'received'<>'true' then raise exception 'FAIL: member report not stored'; end if;
 out:=public.ccx_feed_page(b,'following',null,null,null,16);
 items:=out->'items';
 if jsonb_array_length(items)<>1 or (items->0->>'likes')::integer<>1 then
  raise exception 'FAIL: followed feed or reaction count'; end if;
 if (items->0->'media'->0->>'id')::uuid<>media then
  raise exception 'FAIL: approved photo metadata missing'; end if;
 out:=public.ccx_feed_create(a,'Friends only professional update','friends',array[]::uuid[],null);
 friend_id:=(out->>'id')::uuid;
 update public.community_posts set status='published',published_at=now()+interval '1 second' where id=friend_id;
 if not public.ccx_feed_can_view(b,friend_id) or public.ccx_feed_can_view(c,friend_id) then
   raise exception 'FAIL: friendship visibility'; end if;
 out:=public.ccx_feed_page(c,'discover',null,null,null,16);
 if (out->'items')::text like '%Friends only professional update%' then
   raise exception 'FAIL: private post leaked to discovery'; end if;
 begin
  perform public.ccx_feed_create(a,'Attempt repost of friends-only','verified',array[]::uuid[],friend_id);
  raise exception 'FAIL: friends-only post reposted'; 
 exception when others then if sqlerrm<>'FEED_REPOST_UNAVAILABLE' then raise; end if; end;
 out:=public.ccx_feed_create(a,'Sharing an approved professional update','verified',array[]::uuid[],created_post);
 recreated_post:=(out->>'id')::uuid;
 update public.community_posts set status='published',published_at=now()+interval '2 seconds' where id=recreated_post;
 if not public.ccx_feed_can_view(b,recreated_post) then raise exception 'FAIL: approved repost hidden'; end if;
 update public.community_posts set status='hidden',hidden_at=now() where id=created_post;
 if public.ccx_feed_can_view(b,recreated_post) then raise exception 'FAIL: deleted original still exposed in repost'; end if;
 out:=public.ccx_feed_page(b,'friends',null,null,null,16);
 if (out->'items')::text like '%Project update with one approved photo%' then
  raise exception 'FAIL: original still visible after removal'; end if;
 if (select count(*) from public.ccx_feed_flags where post_id=created_post and reporter_id=b)<>1
 then raise exception 'FAIL: report event missing'; end if;
end $test$;
reset role;
select 'PASS: moderated Premium publishing, verified Free interactions, friends privacy, approved photos, safe reposts, reporting' as result;
