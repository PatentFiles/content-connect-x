-- Run only after scripts/test-connect-feed-database.sql and the real group
-- migration in isolated ccx_feed_test. All accounts and media here are synthetic.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'ccx_feed_test' THEN RAISE EXCEPTION 'Disposable only';END IF;END $$;
UPDATE public.account_security SET admin=true
 WHERE user_id='20000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.ccx_social_groups','SELECT')
  or has_table_privilege('authenticated','public.ccx_social_group_members','SELECT')
  or has_function_privilege('authenticated','public.ccx_group_action(uuid,text,uuid,uuid,text,text,text,text,text)','EXECUTE')
  or has_function_privilege('anon','public.ccx_feed_create_group(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: sensitive group membership exposed to client roles'; END IF;
END $$;
set role service_role;
DO $test$
declare
 a uuid:='10000000-0000-4000-8000-000000000001';
 b uuid:='20000000-0000-4000-8000-000000000002';
 c uuid:='30000000-0000-4000-8000-000000000003';
 d uuid:='40000000-0000-4000-8000-000000000004';
 v_public uuid;v_private uuid;v_post uuid;out jsonb;
begin
 out:=public.ccx_group_action(a,'create',null,null,'Public Industry Group',
   'A moderated professional interest community','Be respectful and use consent','public',null);
 v_public:=(out->>'id')::uuid;
 if out->>'state'<>'pending_platform' then raise exception 'FAIL: unreviewed public group active';end if;
 out:=public.ccx_group_action(c,'discover');
 if out::text like '%Public Industry Group%' then raise exception 'FAIL: public group leaked before platform approval';end if;
 begin
  perform public.ccx_group_action(c,'detail',v_public);
  raise exception 'FAIL: unapproved group visible to outsider';
 exception when others then if sqlerrm<>'GROUP_NOT_FOUND' then raise;end if;end;
 update public.account_security set admin=true where user_id=a;
 begin
  perform public.ccx_group_action(a,'moderate',v_public,null,null,null,'approve');
  raise exception 'FAIL: owner self-approved platform group';
 exception when others then if sqlerrm<>'GROUP_INVALID_REVIEW' then raise;end if;end;
 update public.account_security set admin=false where user_id=a;
 out:=public.ccx_group_action(b,'admin_queue');
 if out::text not like '%Public Industry Group%' then raise exception 'FAIL: moderator missing group';end if;
 out:=public.ccx_group_action(b,'moderate',v_public,null,null,null,'approve');
 if out->>'state'<>'active' then raise exception 'FAIL: approved public group not activated';end if;
 out:=public.ccx_group_action(c,'discover',null,null,null,null,null,null,'industry');
 if out::text not like '%Public Industry Group%' then raise exception 'FAIL: public group not discoverable';end if;
 begin
  perform public.ccx_group_action(d,'discover');
  raise exception 'FAIL: unverified person browsed public groups';
 exception when others then if sqlerrm<>'GROUP_NOT_VERIFIED' then raise;end if;end;
 out:=public.ccx_group_action(b,'apply',v_public);
 if out->>'status'<>'requested' then raise exception 'FAIL: public join auto-approved';end if;
 begin
  perform public.ccx_group_action(c,'approve',v_public,b);
  raise exception 'FAIL: nonadmin approved membership';
 exception when others then if sqlerrm<>'GROUP_ADMIN_REQUIRED' then raise;end if;end;
 out:=public.ccx_group_action(a,'requests',v_public);
 if out::text not like '%Free Friend%' then raise exception 'FAIL: group admin missing application';end if;
 out:=public.ccx_group_action(a,'approve',v_public,b);
 if out->>'status'<>'active' then raise exception 'FAIL: join request not approved';end if;
 out:=public.ccx_group_action(c,'apply',v_public);
 if out->>'status'<>'requested' then raise exception 'FAIL: second member did not apply';end if;
 out:=public.ccx_group_action(a,'deny',v_public,c);
 if out->>'status'<>'declined' then raise exception 'FAIL: group application denial';end if;
 out:=public.ccx_feed_create_group(a,v_public,'Professional discussion about production quality');
 v_post:=(out->>'id')::uuid;
 if out->>'status'<>'pending' then raise exception 'FAIL: group post skipped moderation';end if;
 if public.ccx_feed_can_view(b,v_post) then raise exception 'FAIL: pending group post leaked';end if;
 update public.community_posts set status='published',published_at=now() where id=v_post;
 if not public.ccx_feed_can_view(b,v_post) or public.ccx_feed_can_view(c,v_post) then
  raise exception 'FAIL: active members only group post visibility';end if;
 out:=public.ccx_feed_page(b,'group',v_public,null,null,16);
 if out::text not like '%production quality%' then raise exception 'FAIL: public member group timeline empty';end if;
 begin
  perform public.ccx_feed_page(c,'group',v_public,null,null,16);
  raise exception 'FAIL: rejected applicant read restricted posts';
 exception when others then if sqlerrm<>'GROUP_NOT_MEMBER' then raise;end if;end;
 begin
  perform public.ccx_feed_create_group(b,v_public,'Free member publishing is not permitted');
  raise exception 'FAIL: Free group member published';
 exception when others then if sqlerrm<>'FEED_PREMIUM_REQUIRED' then raise;end if;end;
 out:=public.ccx_feed_interact(b,v_post,'comment','A respectful comment from Free member');
 if out->>'status'<>'pending' then raise exception 'FAIL: Free member group comment';end if;

 out:=public.ccx_group_action(a,'create',null,null,'Private Adult Community',
  'Private invitation-only member circle','Privacy and consent rules','private',null);
 v_private:=(out->>'id')::uuid;
 if out->>'state'<>'active' then raise exception 'FAIL: private group creation';end if;
 out:=public.ccx_group_action(c,'discover');
 if out::text like '%Private Adult Community%' then raise exception 'FAIL: private group public search leakage';end if;
 begin
  perform public.ccx_group_action(c,'detail',v_private);
  raise exception 'FAIL: private group metadata leaked without invitation';
 exception when others then if sqlerrm<>'GROUP_NOT_FOUND' then raise;end if;end;
 begin
  perform public.ccx_group_action(c,'apply',v_private);
  raise exception 'FAIL: private group allowed self-application';
 exception when others then if sqlerrm<>'GROUP_INVITE_ONLY' then raise;end if;end;
 out:=public.ccx_group_action(a,'invite',v_private,b);
 if out->>'status'<>'invited' then raise exception 'FAIL: invitation not generated';end if;
 out:=public.ccx_group_action(b,'mine');
 if out::text not like '%Private Adult Community%' then raise exception 'FAIL: invitee missing private invitation';end if;
 begin
  perform public.ccx_group_action(c,'accept',v_private);
  raise exception 'FAIL: another account accepted invitation';
 exception when others then if sqlerrm<>'GROUP_NO_INVITATION' then raise;end if;end;
 out:=public.ccx_group_action(b,'accept',v_private);
 if out->>'status'<>'active' then raise exception 'FAIL: invitee not active';end if;
 out:=public.ccx_group_action(a,'promote',v_private,b);
 if out->>'status'<>'active' or
   (select role from public.ccx_social_group_members where group_id=v_private and user_id=b)<>'admin'
 then raise exception 'FAIL: group admin promotion';end if;
 out:=public.ccx_group_action(b,'invite',v_private,c);
 if out->>'status'<>'invited' then raise exception 'FAIL: group admin cannot invite';end if;
 out:=public.ccx_group_action(c,'accept',v_private);
 out:=public.ccx_group_action(c,'leave',v_private);
 if out->>'status'<>'left' then raise exception 'FAIL: member cannot leave';end if;
 begin
  perform public.ccx_group_action(b,'remove',v_private,a);
  raise exception 'FAIL: group admin removed owner';
 exception when others then if sqlerrm<>'GROUP_CANNOT_REMOVE' then raise;end if;end;
 out:=public.ccx_group_action(a,'remove',v_private,b);
 if out->>'status'<>'removed' then raise exception 'FAIL: owner cannot revoke admin membership';end if;
 begin
  perform public.ccx_group_action(b,'members',v_private);
  raise exception 'FAIL: removed admin retained member-list access';
 exception when others then if sqlerrm<>'GROUP_ADMIN_REQUIRED' then raise;end if;end;
 begin
  perform public.ccx_group_action(a,'leave',v_private);
  raise exception 'FAIL: owner abandoned ownership silently';
 exception when others then if sqlerrm<>'GROUP_OWNER_TRANSFER_REQUIRED' then raise;end if;end;
 if (select count(*) from public.ccx_social_group_events where group_id=v_private)<6
 then raise exception 'FAIL: group membership audit incomplete';end if;
end $test$;
reset role;
select 'PASS: group platform approval, public requests, private invites, admin controls, group-only posts, no sensitive discovery leak' as result;
