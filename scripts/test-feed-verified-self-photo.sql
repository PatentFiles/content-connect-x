-- Disposable fixture after verified-feed and groups migrations.
DO $test$
DECLARE
 a uuid:='10000000-0000-4000-8000-000000000001';
 b uuid:='20000000-0000-4000-8000-000000000002';
 p uuid;photo uuid;result jsonb;
BEGIN
 IF has_function_privilege('authenticated','public.ccx_feed_create_trusted(uuid,text,text,uuid[],uuid)','EXECUTE')
  OR has_function_privilege('anon','public.ccx_feed_create_trusted(uuid,text,text,uuid[],uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL browser can auto-publish';END IF;
 -- Approved solo photo is an attestation, not proof of another person's consent.
 UPDATE public.member_media_assets SET approval_origin='verified_self_attestation',
    self_only_attested=true,content_label='adult_nudity'
 WHERE owner_id=a and status='approved';
 SELECT id INTO photo FROM public.member_media_assets WHERE owner_id=a AND status='approved' LIMIT 1;
 BEGIN
  PERFORM public.ccx_feed_create_trusted(b,'Free account cannot publish this', 'verified',ARRAY[]::uuid[],null);
  RAISE EXCEPTION 'FAIL Free account published';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'FEED_PREMIUM_REQUIRED' THEN RAISE;END IF;END;
 -- Isolate the new fast-publication cap test from earlier synthetic group posts.
 UPDATE public.community_posts SET created_at=now()-interval '2 days' WHERE author_id=a;
 result:=public.ccx_feed_create_trusted(a,'Solo adult photo for the verified community','verified',ARRAY[photo],null);
 p:=(result->>'id')::uuid;
 IF result->>'status'<>'published' OR NOT public.ccx_feed_can_view(b,p)
 THEN RAISE EXCEPTION 'FAIL verified Premium post not visible immediately';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.community_posts WHERE id=p AND status='published' AND published_at IS NOT NULL)
 THEN RAISE EXCEPTION 'FAIL publication state';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.content_moderation_queue WHERE content_id=p AND status='approved' AND reason='verified_premium_self_publish')
 THEN RAISE EXCEPTION 'FAIL auditable trusted publication';END IF;
 result:=public.ccx_feed_page(b,'discover',null,null,null,20);
 IF result::text NOT LIKE '%adult_nudity%'
 THEN RAISE EXCEPTION 'FAIL adult-nudity display label absent';END IF;
 result:=public.ccx_feed_report(b,p,'rights');
 IF result->>'received'<>'true' OR result->>'quarantined'<>'true'
 THEN RAISE EXCEPTION 'FAIL rights report did not trigger a temporary quarantine';END IF;
 IF public.ccx_feed_can_view(b,p) OR EXISTS(SELECT 1 FROM public.community_posts WHERE id=p AND status='published')
 THEN RAISE EXCEPTION 'FAIL quarantined photo post remained public';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ccx_feed_flags WHERE reporter_id=b AND post_id=p AND reason='rights')
 THEN RAISE EXCEPTION 'FAIL report provenance missing';END IF;
 IF EXISTS(SELECT 1 FROM public.account_security WHERE user_id=a AND (banned OR suspended))
 THEN RAISE EXCEPTION 'FAIL unsupported account punishment from allegation';END IF;
END $test$;
SELECT 'PASS: Premium direct publication, adult content labeling, privacy quarantine, report audit and no automatic punishment' as result;
