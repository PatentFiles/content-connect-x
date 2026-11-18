CREATE TABLE IF NOT EXISTS public.property_virtual_tours (
 property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
 matterport_url text NOT NULL CHECK(matterport_url ~ '^https://my\.matterport\.com/show/\?m=[A-Za-z0-9]{8,64}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_virtual_tours ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_virtual_tours FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.property_tour_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 storage_path text NOT NULL UNIQUE,
 original_name text NOT NULL CHECK(length(original_name)<=200),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(storage_path LIKE user_id::text||'/'||property_id::text||'/%' AND storage_path NOT LIKE '%..%')
);
ALTER TABLE public.property_tour_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_tour_sources FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.property_tour_sources TO authenticated;
CREATE POLICY tour_sources_self_read ON public.property_tour_sources FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY tour_sources_self_insert ON public.property_tour_sources FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.properties WHERE id=property_id AND owner_id=(SELECT auth.uid())));
CREATE POLICY tour_sources_self_delete ON public.property_tour_sources FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_property_tour(p_property uuid,p_action text DEFAULT 'get',p_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); p public.properties; t public.property_virtual_tours;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=u AND NOT banned AND NOT suspended) THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.properties WHERE id=p_property;
 IF NOT FOUND THEN RAISE EXCEPTION 'Property unavailable' USING ERRCODE='42501'; END IF;
 IF p_action IN('save','remove') THEN
  IF p.owner_id<>u OR NOT EXISTS(SELECT 1 FROM public.onlyhost_accounts WHERE user_id=u AND status='active' AND property_authority_confirmed AND legal_capacity_confirmed AND adult_production_understood) THEN RAISE EXCEPTION 'Property owner access required' USING ERRCODE='42501'; END IF;
  IF p_action='remove' THEN DELETE FROM public.property_virtual_tours WHERE property_id=p.id; RETURN '{}'::jsonb; END IF;
  IF p_url IS NULL OR p_url !~ '^https://my\.matterport\.com/show/\?m=[A-Za-z0-9]{8,64}$' THEN RAISE EXCEPTION 'Valid Matterport Showcase URL required'; END IF;
  INSERT INTO public.property_virtual_tours(property_id,matterport_url) VALUES(p.id,p_url) ON CONFLICT(property_id) DO UPDATE SET matterport_url=excluded.matterport_url,updated_at=now() RETURNING * INTO t;
  UPDATE public.properties SET status=CASE WHEN status='active' THEN 'pending_review' ELSE status END,approved_at=NULL,approved_by=NULL WHERE id=p.id;
  RETURN jsonb_build_object('url',t.matterport_url,'pending_review',true);
 END IF;
 IF p_action<>'get' THEN RAISE EXCEPTION 'Unknown tour action'; END IF;
 SELECT * INTO t FROM public.property_virtual_tours WHERE property_id=p.id;
 IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 IF p.owner_id=u THEN RETURN jsonb_build_object('url',t.matterport_url,'pending_review',p.approved_at IS NULL OR t.updated_at>p.approved_at); END IF;
 IF EXISTS(SELECT 1 FROM public.account_security WHERE user_id=u AND admin) THEN RETURN jsonb_build_object('url',t.matterport_url,'pending_review',p.approved_at IS NULL OR t.updated_at>p.approved_at); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u) OR p.status<>'active' OR p.approved_at IS NULL OR t.updated_at>p.approved_at OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=p.owner_id AND NOT banned AND NOT suspended) OR EXISTS(SELECT 1 FROM public.member_blocks WHERE(blocker_id=u AND blocked_id=p.owner_id)OR(blocker_id=p.owner_id AND blocked_id=u)) OR NOT EXISTS(SELECT 1 FROM public.host_verification_requests WHERE property_id=p.id AND owner_id=p.owner_id AND status='approved' AND(expires_at IS NULL OR expires_at>now())) THEN RETURN '{}'::jsonb; END IF;
 RETURN jsonb_build_object('url',t.matterport_url,'pending_review',false);
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_property_tour(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_property_tour(uuid,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ccx_property_tour(p_property uuid,p_action text DEFAULT 'get',p_url text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_property_tour(p_property,p_action,p_url); $$;
REVOKE ALL ON FUNCTION public.ccx_property_tour(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_property_tour(uuid,text,text) TO authenticated,service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('property-tour-sources','property-tour-sources',false,52428800,ARRAY['application/zip','application/x-zip-compressed','application/octet-stream'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY property_tour_source_self ON storage.objects FOR ALL TO authenticated USING(bucket_id='property-tour-sources' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text) WITH CHECK(bucket_id='property-tour-sources' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id::text=(storage.foldername(name))[2] AND p.owner_id=(SELECT auth.uid())));
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_property_filter_options() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); result jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=u AND NOT banned AND NOT suspended) OR NOT (EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u) OR EXISTS(SELECT 1 FROM public.onlyhost_accounts WHERE user_id=u AND status='active')) THEN RAISE EXCEPTION 'Account access required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('country',country,'state',region,'city',city) ORDER BY country,region,city),'[]'::jsonb) INTO result FROM (SELECT country,region,city FROM public.hosting_public_areas WHERE approved UNION SELECT country,state,city FROM public.properties WHERE status='active' AND approved_at IS NOT NULL LIMIT 5000) a;
 RETURN jsonb_build_object('locations',result);
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_property_filter_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_property_filter_options() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ccx_property_filter_options() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_property_filter_options(); $$;
REVOKE ALL ON FUNCTION public.ccx_property_filter_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_property_filter_options() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
