-- Availability metadata never grants data access or invents age approval.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_member_feature_flags()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); a public.account_security; r text; v public.age_verification_requests; verified boolean:=false; tier text:='free'; f record; flags jsonb:='{}'; access_map jsonb:='{}'; reason text; available boolean; h bigint; ch text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.account_security WHERE user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account security record is unavailable' USING ERRCODE='42501'; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u;
 SELECT * INTO v FROM public.age_verification_requests WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1;
 verified:=coalesce(v.status='approved' AND(v.expires_at IS NULL OR v.expires_at>now()),false);
 IF a.admin OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=u AND status IN('active','trial') AND(period_end IS NULL OR period_end>now())) THEN tier:='premium'; END IF;
 FOR f IN SELECT key,enabled,allowed_tiers,rollout_percent FROM public.product_feature_flags LOOP
  h:=0;FOR ch IN SELECT regexp_split_to_table(u::text||f.key,'') LOOP h:=mod(h*31+ascii(ch),4294967296);END LOOP;
  available:=f.enabled AND mod(h,100)<f.rollout_percent;
  reason:=CASE WHEN a.banned OR a.suspended THEN 'restricted' WHEN NOT f.enabled THEN 'disabled' WHEN NOT available THEN 'rollout_excluded' WHEN NOT verified THEN 'verification_required' WHEN f.key='portfolio' AND r NOT IN('photographer','videographer','video_editor') THEN 'role_required' WHEN f.key='roster' AND r NOT IN('creator','agent','studio') THEN 'role_required' WHEN NOT tier=ANY(f.allowed_tiers) THEN 'membership_required' ELSE 'ready' END;
  flags:=flags||jsonb_build_object(f.key,available);
  access_map:=access_map||jsonb_build_object(f.key,jsonb_build_object('reason',reason,'eligible',reason='ready','enabled',f.enabled));
 END LOOP;
 RETURN jsonb_build_object('flags',flags,'access',access_map,'account',jsonb_build_object('role',r,'admin',a.admin,'age_verified',verified,'verification_status',coalesce(v.status,'not_started'),'tier',tier,'restricted',a.banned OR a.suspended),'checked_at',now());
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_member_feature_flags() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_member_feature_flags() TO authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.member_dashboard_preferences(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role_type text NOT NULL CHECK(role_type IN('creator','agent','studio','photographer','videographer','video_editor','host')),
 layout jsonb NOT NULL CHECK(jsonb_typeof(layout)='array' AND jsonb_array_length(layout)<=15),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,role_type)
);
ALTER TABLE public.member_dashboard_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_owner_read ON public.member_dashboard_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.member_dashboard_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.member_dashboard_preferences TO authenticated;
GRANT ALL ON public.member_dashboard_preferences TO service_role;
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_dashboard_action(p_action text DEFAULT 'load',p_layout jsonb DEFAULT NULL,p_revision integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); context jsonb; account jsonb; access_map jsonb; r text; pref public.member_dashboard_preferences; row_exists boolean; entry jsonb; widget text; width text; seen text[]:='{}'; metrics jsonb:='{}'; value bigint; extra bigint; subtext text; items jsonb; feature text; reason text; allowed text[]:=ARRAY['profile_views','connections','connection_requests','favorites','unread_messages','collaborations','invitations','contracts','properties','testing','roster','portfolio','upcoming','recent_activity','account'];
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 context:=public.ccx_member_feature_flags();account:=context->'account';access_map:=context->'access';r:=account->>'role';
 IF coalesce((account->>'restricted')::boolean,true) OR r IS NULL THEN RAISE EXCEPTION 'Account access restricted' USING ERRCODE='42501'; END IF;
 IF p_action='save' THEN
  IF p_layout IS NULL OR jsonb_typeof(p_layout)<>'array' THEN RAISE EXCEPTION 'Dashboard layout must be an array'; END IF;
  IF jsonb_array_length(p_layout)>15 THEN RAISE EXCEPTION 'Too many dashboard widgets'; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(p_layout) LOOP
   IF jsonb_typeof(entry)<>'object' THEN RAISE EXCEPTION 'Invalid dashboard widget'; END IF;
   widget:=entry->>'id';width:=entry->>'width';
   IF widget IS NULL OR NOT widget=ANY(allowed) OR widget=ANY(seen) OR width IS NULL OR width NOT IN('normal','wide') OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) AS k WHERE k NOT IN('id','width')) THEN RAISE EXCEPTION 'Invalid or duplicate dashboard widget'; END IF;
   IF(widget='roster' AND r NOT IN('agent','studio')) OR(widget='portfolio' AND r NOT IN('photographer','videographer','video_editor')) THEN RAISE EXCEPTION 'Widget does not belong to your professional role' USING ERRCODE='42501'; END IF;
   seen:=array_append(seen,widget);
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':dashboard:'||r,0));
  SELECT * INTO pref FROM public.member_dashboard_preferences WHERE user_id=u AND role_type=r FOR UPDATE;
  row_exists:=FOUND;
  IF p_revision IS NULL OR p_revision<>(CASE WHEN row_exists THEN pref.revision ELSE 0 END) THEN RAISE EXCEPTION 'Dashboard changed on another device. Cancel your edits and refresh before saving again.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.member_dashboard_preferences(user_id,role_type,layout,revision) VALUES(u,r,p_layout,1)
   ON CONFLICT(user_id,role_type) DO UPDATE SET layout=excluded.layout,revision=member_dashboard_preferences.revision+1,updated_at=now() RETURNING * INTO pref;
  RETURN jsonb_build_object('layout',pref.layout,'revision',pref.revision,'role',r);
 ELSIF p_action IS DISTINCT FROM 'load' THEN RAISE EXCEPTION 'Unknown dashboard action'; END IF;
 SELECT * INTO pref FROM public.member_dashboard_preferences WHERE user_id=u AND role_type=r;
 FOREACH widget IN ARRAY allowed LOOP
  feature:=CASE widget WHEN 'profile_views' THEN NULL WHEN 'connections' THEN 'connections' WHEN 'connection_requests' THEN 'connections' WHEN 'favorites' THEN 'favorites' WHEN 'unread_messages' THEN 'messages' WHEN 'collaborations' THEN 'collaborations' WHEN 'invitations' THEN 'collaborations' WHEN 'contracts' THEN 'contracts' WHEN 'properties' THEN 'hosting_marketplace' WHEN 'testing' THEN 'testing' WHEN 'roster' THEN 'roster' WHEN 'portfolio' THEN 'portfolio' WHEN 'upcoming' THEN 'availability' ELSE NULL END;
  reason:=CASE WHEN widget='account' THEN 'ready' WHEN NOT coalesce((account->>'age_verified')::boolean,false) THEN 'verification_required' WHEN(widget='roster' AND r NOT IN('agent','studio')) OR(widget='portfolio' AND r NOT IN('photographer','videographer','video_editor')) THEN 'role_required' WHEN feature IS NULL THEN 'ready' ELSE coalesce(access_map->feature->>'reason','unavailable') END;
  IF reason<>'ready' THEN metrics:=metrics||jsonb_build_object(widget,jsonb_build_object('status',reason));CONTINUE;END IF;
  value:=0;extra:=0;subtext:='';items:=NULL;
  CASE widget
   WHEN 'profile_views' THEN SELECT count(*),count(DISTINCT viewer_id) INTO value,extra FROM public.member_profile_view_events WHERE profile_owner_id=u AND viewed_day>=current_date-29;subtext:=extra||' unique visitors in the last 30 days';
   WHEN 'connections' THEN SELECT count(*) INTO value FROM public.member_connection_requests c WHERE c.status='accepted' AND(c.requester_id=u OR c.recipient_id=u) AND NOT EXISTS(SELECT 1 FROM public.member_blocks b WHERE(b.blocker_id=u AND b.blocked_id=CASE WHEN c.requester_id=u THEN c.recipient_id ELSE c.requester_id END) OR(b.blocked_id=u AND b.blocker_id=CASE WHEN c.requester_id=u THEN c.recipient_id ELSE c.requester_id END));subtext:='Accepted professional connections';
   WHEN 'connection_requests' THEN SELECT count(*) INTO value FROM public.member_connection_requests c WHERE c.recipient_id=u AND c.status='pending' AND NOT EXISTS(SELECT 1 FROM public.member_blocks b WHERE(b.blocker_id=u AND b.blocked_id=c.requester_id) OR(b.blocked_id=u AND b.blocker_id=c.requester_id));subtext:='Incoming requests awaiting your response';
   WHEN 'favorites' THEN SELECT count(*) INTO value FROM public.creator_favorites WHERE user_id=u;subtext:='Profiles saved to your private Favorites list';
   WHEN 'unread_messages' THEN
    SELECT count(*) INTO value FROM public.messages m JOIN public.conversation_members own ON own.conversation_id=m.conversation_id AND own.user_id=u JOIN public.conversations c ON c.id=m.conversation_id
    WHERE m.sender_id<>u AND m.deleted_at IS NULL AND m.created_at>coalesce(own.last_read_at,'-infinity'::timestamptz) AND(c.kind<>'group' OR account->>'tier'='premium') AND NOT EXISTS(SELECT 1 FROM public.conversation_members other JOIN public.member_blocks b ON(b.blocker_id=u AND b.blocked_id=other.user_id) OR(b.blocked_id=u AND b.blocker_id=other.user_id) WHERE other.conversation_id=m.conversation_id);
    subtext:='Unread messages in your accessible conversations';
   WHEN 'collaborations' THEN SELECT count(*) INTO value FROM public.collaborations c WHERE(c.creator_id=u OR EXISTS(SELECT 1 FROM public.collaboration_members cm WHERE cm.collaboration_id=c.id AND cm.user_id=u)) AND c.status NOT IN('completed','cancelled','archived','closed');subtext:='Projects that are not completed or closed';
   WHEN 'invitations' THEN SELECT count(*) INTO value FROM public.collaboration_invitations WHERE invitee_id=u AND status='pending';subtext:='Invitations awaiting your response';
   WHEN 'contracts' THEN SELECT count(*) INTO value FROM public.contracts c WHERE(c.created_by=u OR EXISTS(SELECT 1 FROM public.collaboration_members cm WHERE cm.collaboration_id=c.collaboration_id AND cm.user_id=u)) AND c.status NOT IN('signed','void','voided','cancelled','completed');subtext:='Draft and pending agreements; not proof of a signature';
   WHEN 'properties' THEN SELECT count(*) INTO value FROM public.property_booking_requests WHERE(requester_id=u OR owner_id=u) AND ends_at>now() AND status IN('requested','accepted');subtext:='Requested or accepted bookings; payment and signing status are separate';
   WHEN 'testing' THEN SELECT count(*) INTO value FROM public.ccx_clearance_document_submissions WHERE user_id=u AND status IN('pending','under_review');subtext:='Your private submissions awaiting review; not a medical clearance';
   WHEN 'roster' THEN SELECT count(*) FILTER(WHERE status='active' AND relationship_type='roster'),count(*) FILTER(WHERE status='pending') INTO value,extra FROM public.member_representations WHERE representative_id=u;subtext:=extra||' pending representation invitations';
   WHEN 'portfolio' THEN SELECT count(*),count(*) FILTER(WHERE featured) INTO value,extra FROM public.member_portfolio_items WHERE user_id=u;subtext:=extra||' featured items in your private portfolio';
   WHEN 'upcoming' THEN
    SELECT count(*) INTO value FROM public.member_availability WHERE user_id=u AND ends_at>now() AND starts_at<now()+interval '30 days';
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',initcap(x.kind)||' · '||x.city,'at',x.starts_at) ORDER BY x.starts_at),'[]'::jsonb) INTO items FROM(SELECT id,kind,city,starts_at FROM public.member_availability WHERE user_id=u AND ends_at>now() AND starts_at<now()+interval '30 days' ORDER BY starts_at LIMIT 5)x;
    subtext:='Your availability and travel entries in the next 30 days';
   WHEN 'recent_activity' THEN
    SELECT count(*) INTO value FROM public.member_notifications WHERE recipient_id=u AND read_at IS NULL;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'at',x.created_at) ORDER BY x.created_at DESC),'[]'::jsonb) INTO items FROM(SELECT id,title,created_at FROM public.member_notifications WHERE recipient_id=u ORDER BY created_at DESC LIMIT 5)x;
    subtext:='Unread notifications, with your latest five updates';
   WHEN 'account' THEN
    metrics:=metrics||jsonb_build_object(widget,jsonb_build_object('status','ready','value',CASE WHEN(account->>'age_verified')::boolean THEN 'Verified' ELSE 'Verification required' END,'subtitle',CASE WHEN(account->>'admin')::boolean THEN 'Administrator workspace · age status is checked independently' WHEN account->>'tier'='premium' THEN 'Premium membership' ELSE 'Free membership' END));CONTINUE;
  END CASE;
  metrics:=metrics||jsonb_build_object(widget,jsonb_build_object('status','ready','value',value,'subtitle',subtext,'items',items));
 END LOOP;
 RETURN jsonb_build_object('schema_version',1,'role',r,'layout',pref.layout,'revision',coalesce(pref.revision,0),'account',account,'metrics',metrics,'module_access',access_map,'checked_at',now());
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_dashboard_action(text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_dashboard_action(text,jsonb,integer) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ccx_dashboard_action(p_action text DEFAULT 'load',p_layout jsonb DEFAULT NULL,p_revision integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_dashboard_action(p_action,p_layout,p_revision); $$;
REVOKE ALL ON FUNCTION public.ccx_dashboard_action(text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_dashboard_action(text,jsonb,integer) TO authenticated,service_role;
ALTER TABLE public.ccx_clearance_events ADD COLUMN IF NOT EXISTS provider_reference text;
NOTIFY pgrst,'reload schema';
