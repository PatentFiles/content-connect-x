-- Mirror the existing member-workflows administrator MFA requirement in access metadata.
-- This changes explanations only, not the authoritative action permissions.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_member_feature_flags()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); a public.account_security; r text; v public.age_verification_requests; verified boolean:=false; tier text:='free'; f record; flags jsonb:='{}'; access_map jsonb:='{}'; reason text; available boolean; h bigint; ch text; aal text:=coalesce(auth.jwt()->>'aal','aal1');
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
  reason:=CASE WHEN a.banned OR a.suspended THEN 'restricted' WHEN NOT f.enabled THEN 'disabled' WHEN NOT available THEN 'rollout_excluded' WHEN NOT verified THEN 'verification_required' WHEN a.admin AND aal<>'aal2' AND f.key IN('messages','connections','collaborations','contracts') THEN 'mfa_required' WHEN f.key='portfolio' AND r NOT IN('photographer','videographer','video_editor') THEN 'role_required' WHEN f.key='roster' AND r NOT IN('creator','agent','studio') THEN 'role_required' WHEN NOT tier=ANY(f.allowed_tiers) THEN 'membership_required' ELSE 'ready' END;
  flags:=flags||jsonb_build_object(f.key,available);
  access_map:=access_map||jsonb_build_object(f.key,jsonb_build_object('reason',reason,'eligible',reason='ready','enabled',f.enabled));
 END LOOP;
 RETURN jsonb_build_object('flags',flags,'access',access_map,'account',jsonb_build_object('role',r,'admin',a.admin,'age_verified',verified,'verification_status',coalesce(v.status,'not_started'),'tier',tier,'restricted',a.banned OR a.suspended,'mfa_level',aal),'checked_at',now());
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_member_feature_flags() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_member_feature_flags() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
