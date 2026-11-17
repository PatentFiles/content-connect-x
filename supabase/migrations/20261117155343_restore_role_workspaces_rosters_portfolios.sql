-- Additive role restoration. Existing verification, payment and hosting records are untouched.
CREATE OR REPLACE FUNCTION public.ccx_workspace_allowed(p_feature text DEFAULT NULL,p_roles text[] DEFAULT '{}'::text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); a record; v record; f record; r text; tier text:='free'; h bigint:=0; ch text;
BEGIN
 IF u IS NULL THEN RETURN false; END IF;
 SELECT admin,banned,suspended INTO a FROM public.account_security WHERE user_id=u;
 IF NOT FOUND OR a.banned OR a.suspended THEN RETURN false; END IF;
 SELECT status,expires_at INTO v FROM public.age_verification_requests WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR v.status<>'approved' OR (v.expires_at IS NOT NULL AND v.expires_at<=now()) THEN RETURN false; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u;
 IF r IS NULL THEN RETURN false; END IF;
 IF cardinality(p_roles)>0 AND NOT(r=ANY(p_roles)) THEN RETURN false; END IF;
 IF p_feature IS NULL THEN RETURN true; END IF;
 IF a.admin OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=u AND status IN('active','trial') AND (period_end IS NULL OR period_end>now())) THEN tier:='premium'; END IF;
 SELECT enabled,allowed_tiers,rollout_percent INTO f FROM public.product_feature_flags WHERE key=p_feature;
 IF NOT FOUND OR NOT f.enabled OR NOT(tier=ANY(f.allowed_tiers)) THEN RETURN false; END IF;
 FOREACH ch IN ARRAY regexp_split_to_array(u::text||p_feature,'') LOOP h:=mod(h*31+ascii(ch),4294967296); END LOOP;
 RETURN mod(h,100)<f.rollout_percent;
END $$;
REVOKE ALL ON FUNCTION public.ccx_workspace_allowed(text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_workspace_allowed(text,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.ccx_member_feature_flags()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE flags jsonb;
BEGIN
 IF NOT public.ccx_workspace_allowed() THEN RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_object_agg(key,public.ccx_workspace_allowed(key)),'{}'::jsonb) INTO flags FROM public.product_feature_flags;
 RETURN jsonb_build_object('flags',flags);
END $$;
REVOKE ALL ON FUNCTION public.ccx_member_feature_flags() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_member_feature_flags() TO authenticated;
INSERT INTO public.product_feature_flags(key,enabled,allowed_tiers,rollout_percent,description)
 VALUES('roster',true,ARRAY['free','premium'],100,'Agent and studio creator representation roster'),('portfolio',true,ARRAY['free','premium'],100,'Photographer, videographer and video editor portfolios')
 ON CONFLICT(key) DO UPDATE SET enabled=true,allowed_tiers=EXCLUDED.allowed_tiers,rollout_percent=100,description=EXCLUDED.description,updated_at=now();
CREATE TABLE public.member_professional_details(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 specialties text NOT NULL DEFAULT '' CHECK(length(specialties)<=1000),services text NOT NULL DEFAULT '' CHECK(length(services)<=2000),equipment text NOT NULL DEFAULT '' CHECK(length(equipment)<=2000),software text NOT NULL DEFAULT '' CHECK(length(software)<=1000),
 website text NOT NULL DEFAULT '' CHECK(length(website)<=1000 AND (website='' OR website~'^https://[^[:space:]@]+$')),
 hourly_rate numeric(10,2) CHECK(hourly_rate>=0),day_rate numeric(10,2) CHECK(day_rate>=0),currency text NOT NULL DEFAULT 'USD' CHECK(currency~'^[A-Z]{3}$'),commission_percent numeric(5,2) CHECK(commission_percent BETWEEN 0 AND 100),
 accepting_talent boolean NOT NULL DEFAULT false,available_to_travel boolean NOT NULL DEFAULT false,turnaround_days integer CHECK(turnaround_days BETWEEN 0 AND 365),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_professional_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY professional_owner_read ON public.member_professional_details FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.member_professional_details FROM anon,authenticated;
GRANT SELECT ON public.member_professional_details TO authenticated;
GRANT ALL ON public.member_professional_details TO service_role;
CREATE OR REPLACE FUNCTION public.ccx_save_professional_profile(p_profile jsonb,p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r text; name text;
BEGIN
 IF NOT public.ccx_workspace_allowed(NULL,ARRAY['agent','studio','photographer','videographer','video_editor']) THEN RAISE EXCEPTION 'Verified professional account required' USING ERRCODE='42501'; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u FOR UPDATE;
 name:=trim(coalesce(p_profile->>'display_name',''));
 IF name='' OR length(name)>100 THEN RAISE EXCEPTION 'Display name is required (100 characters maximum)'; END IF;
 IF r='studio' AND (trim(coalesce(p_profile->>'company_name',''))='' OR trim(coalesce(p_profile->>'representative_name',''))='') THEN RAISE EXCEPTION 'Studio name and representative are required'; END IF;
 UPDATE public.member_profiles SET display_name=name,real_name=left(trim(coalesce(p_profile->>'real_name','')),120),company_name=left(trim(coalesce(p_profile->>'company_name','')),120),representative_name=left(trim(coalesce(p_profile->>'representative_name','')),120),bio=left(coalesce(p_profile->>'bio',''),2000),city=left(trim(coalesce(p_profile->>'city','')),100),state=left(trim(coalesce(p_profile->>'state','')),100),country=left(trim(coalesce(p_profile->>'country','')),100),profile_complete=true,updated_at=now() WHERE id=u;
 INSERT INTO public.member_professional_details(user_id,specialties,services,equipment,software,website,hourly_rate,day_rate,currency,commission_percent,accepting_talent,available_to_travel,turnaround_days)
 VALUES(u,left(coalesce(p_details->>'specialties',''),1000),left(coalesce(p_details->>'services',''),2000),left(coalesce(p_details->>'equipment',''),2000),left(coalesce(p_details->>'software',''),1000),left(coalesce(p_details->>'website',''),1000),nullif(p_details->>'hourly_rate','')::numeric,nullif(p_details->>'day_rate','')::numeric,coalesce(nullif(p_details->>'currency',''),'USD'),nullif(p_details->>'commission_percent','')::numeric,coalesce((p_details->>'accepting_talent')::boolean,false),coalesce((p_details->>'available_to_travel')::boolean,false),nullif(p_details->>'turnaround_days','')::integer)
 ON CONFLICT(user_id) DO UPDATE SET specialties=EXCLUDED.specialties,services=EXCLUDED.services,equipment=EXCLUDED.equipment,software=EXCLUDED.software,website=EXCLUDED.website,hourly_rate=EXCLUDED.hourly_rate,day_rate=EXCLUDED.day_rate,currency=EXCLUDED.currency,commission_percent=EXCLUDED.commission_percent,accepting_talent=EXCLUDED.accepting_talent,available_to_travel=EXCLUDED.available_to_travel,turnaround_days=EXCLUDED.turnaround_days,updated_at=now();
 RETURN jsonb_build_object('saved',true,'role_type',r);
END $$;
REVOKE ALL ON FUNCTION public.ccx_save_professional_profile(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_save_professional_profile(jsonb,jsonb) TO authenticated;
CREATE TABLE public.member_representations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),representative_id uuid NOT NULL REFERENCES auth.users(id),creator_id uuid NOT NULL REFERENCES auth.users(id),representative_role text NOT NULL CHECK(representative_role IN('agent','studio')),relationship_type text NOT NULL DEFAULT 'roster' CHECK(relationship_type IN('roster','worked_with')),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','active','declined','ended')),created_at timestamptz NOT NULL DEFAULT now(),responded_at timestamptz,ended_at timestamptz,CHECK(representative_id<>creator_id)
);
CREATE UNIQUE INDEX member_representations_open_pair_idx ON public.member_representations(representative_id,creator_id,relationship_type) WHERE status IN('pending','active');
CREATE INDEX member_representations_creator_idx ON public.member_representations(creator_id,status);
ALTER TABLE public.member_representations ENABLE ROW LEVEL SECURITY;
CREATE POLICY representation_participant_read ON public.member_representations FOR SELECT TO authenticated USING((representative_id=(SELECT auth.uid()) OR creator_id=(SELECT auth.uid())) AND public.ccx_workspace_allowed());
REVOKE ALL ON public.member_representations FROM anon,authenticated;
GRANT SELECT ON public.member_representations TO authenticated;
GRANT ALL ON public.member_representations TO service_role;
CREATE OR REPLACE FUNCTION public.ccx_roster_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r text; t uuid; rel_row public.member_representations; result jsonb; rel text;
BEGIN
 IF NOT public.ccx_workspace_allowed() THEN RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'relationship_type',x.relationship_type,'representative_role',x.representative_role,'created_at',x.created_at,'is_invitee',x.creator_id=u,'member_id',p.id,'display_name',p.display_name,'role_type',p.role_type,'city',p.city,'state',p.state,'country',p.country) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM public.member_representations x JOIN public.member_profiles p ON p.id=CASE WHEN x.creator_id=u THEN x.representative_id ELSE x.creator_id END WHERE x.representative_id=u OR x.creator_id=u;
  RETURN jsonb_build_object('items',result);
 ELSIF p_action='invite' THEN
  IF NOT public.ccx_workspace_allowed('roster',ARRAY['agent','studio']) THEN RAISE EXCEPTION 'Agent or studio roster access required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':roster',0));
  IF(SELECT count(*) FROM public.member_representations WHERE representative_id=u AND created_at>now()-interval '1 day')>=50 THEN RAISE EXCEPTION 'Daily roster invitation limit reached'; END IF;
  t:=(p_data->>'creator_id')::uuid;rel:=coalesce(p_data->>'relationship_type','roster');
  IF t=u OR rel NOT IN('roster','worked_with') THEN RAISE EXCEPTION 'Invalid creator or relationship'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.member_profiles WHERE id=t AND role_type='creator' AND profile_complete) OR NOT EXISTS(SELECT 1 FROM public.age_verification_requests WHERE id=(SELECT id FROM public.age_verification_requests WHERE user_id=t ORDER BY created_at DESC,id DESC LIMIT 1) AND status='approved' AND (expires_at IS NULL OR expires_at>now())) OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=t AND NOT banned AND NOT suspended) OR EXISTS(SELECT 1 FROM public.member_blocks WHERE(blocker_id=u AND blocked_id=t) OR(blocker_id=t AND blocked_id=u)) THEN RAISE EXCEPTION 'Creator unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.member_representations(representative_id,creator_id,representative_role,relationship_type) VALUES(u,t,r,rel) ON CONFLICT(representative_id,creator_id,relationship_type) WHERE status IN('pending','active') DO NOTHING RETURNING * INTO rel_row;
  IF rel_row.id IS NULL THEN RAISE EXCEPTION 'A relationship or invitation already exists'; END IF;
 ELSIF p_action IN('accept','decline','end') THEN
  SELECT * INTO rel_row FROM public.member_representations WHERE id=(p_data->>'id')::uuid AND(creator_id=u OR representative_id=u) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship unavailable' USING ERRCODE='42501'; END IF;
  IF p_action IN('accept','decline') AND(rel_row.creator_id<>u OR rel_row.status<>'pending') THEN RAISE EXCEPTION 'Only the invited creator may respond' USING ERRCODE='42501'; END IF;
  IF p_action='accept' AND NOT public.ccx_workspace_allowed('roster',ARRAY['creator']) THEN RAISE EXCEPTION 'Roster is disabled' USING ERRCODE='42501'; END IF;
  IF p_action='end' AND rel_row.status NOT IN('active','pending') THEN RAISE EXCEPTION 'Relationship already closed'; END IF;
  UPDATE public.member_representations SET status=CASE p_action WHEN 'accept' THEN 'active' WHEN 'decline' THEN 'declined' ELSE 'ended' END,responded_at=CASE WHEN p_action IN('accept','decline') THEN now() ELSE responded_at END,ended_at=CASE WHEN p_action='end' THEN now() ELSE NULL END WHERE id=rel_row.id RETURNING * INTO rel_row;
 ELSE RAISE EXCEPTION 'Unknown roster action'; END IF;
 INSERT INTO public.platform_action_audit(actor_id,action,target_type,target_id) VALUES(u,'roster_'||p_action,'representation',rel_row.id);
 INSERT INTO public.member_notifications(recipient_id,kind,title,details) VALUES(CASE WHEN u=rel_row.representative_id THEN rel_row.creator_id ELSE rel_row.representative_id END,'representation_update',CASE WHEN p_action='invite' THEN 'You received a representation invitation' ELSE 'Your representation relationship was updated' END,jsonb_build_object('representation_id',rel_row.id));
 RETURN jsonb_build_object('item',to_jsonb(rel_row));
END $$;
REVOKE ALL ON FUNCTION public.ccx_roster_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_roster_action(text,jsonb) TO authenticated;
CREATE TABLE public.member_portfolio_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN('photo','link')),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 140),description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),storage_path text UNIQUE,external_url text,featured boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),CHECK((kind='photo' AND storage_path IS NOT NULL AND external_url IS NULL) OR(kind='link' AND storage_path IS NULL AND external_url~'^https://[^[:space:]@]+$'))
);
CREATE INDEX portfolio_owner_idx ON public.member_portfolio_items(user_id,created_at DESC);
ALTER TABLE public.member_portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY portfolio_owner_read ON public.member_portfolio_items FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.member_portfolio_items FROM anon,authenticated;
GRANT SELECT ON public.member_portfolio_items TO authenticated;
GRANT ALL ON public.member_portfolio_items TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('ccx-professional-portfolios','ccx-professional-portfolios',false,10485760,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY portfolio_upload_own ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='ccx-professional-portfolios' AND(storage.foldername(name))[1]=(SELECT auth.uid())::text AND public.ccx_workspace_allowed('portfolio',ARRAY['photographer','videographer','video_editor']));
CREATE POLICY portfolio_read_own ON storage.objects FOR SELECT TO authenticated USING(bucket_id='ccx-professional-portfolios' AND(storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY portfolio_delete_own ON storage.objects FOR DELETE TO authenticated USING(bucket_id='ccx-professional-portfolios' AND(storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE OR REPLACE FUNCTION public.ccx_portfolio_action(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); item public.member_portfolio_items; path text; link text; kind text;
BEGIN
 IF NOT public.ccx_workspace_allowed(NULL,ARRAY['photographer','videographer','video_editor']) THEN RAISE EXCEPTION 'Verified portfolio owner required' USING ERRCODE='42501'; END IF;
 IF p_action='save' THEN
  IF NOT public.ccx_workspace_allowed('portfolio') THEN RAISE EXCEPTION 'Portfolio is disabled' USING ERRCODE='42501'; END IF;
  kind:=p_data->>'kind';path:=nullif(p_data->>'storage_path','');link:=nullif(trim(p_data->>'external_url'),'');
  IF kind='photo' THEN
   IF path IS NULL OR split_part(path,'/',1)<>u::text OR path LIKE '%..%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ccx-professional-portfolios' AND name=path) THEN RAISE EXCEPTION 'Upload your photo first'; END IF;link:=NULL;
  ELSIF kind='link' THEN
   IF link IS NULL OR length(link)>2000 OR link!~'^https://[^[:space:]@]+$' THEN RAISE EXCEPTION 'Use a valid HTTPS work link'; END IF;path:=NULL;
  ELSE RAISE EXCEPTION 'Choose a photo or work link'; END IF;
  INSERT INTO public.member_portfolio_items(user_id,kind,title,description,storage_path,external_url) VALUES(u,kind,trim(p_data->>'title'),left(coalesce(p_data->>'description',''),2000),path,link) RETURNING * INTO item;
 ELSIF p_action='feature' THEN
  UPDATE public.member_portfolio_items SET featured=coalesce((p_data->>'featured')::boolean,false) WHERE id=(p_data->>'id')::uuid AND user_id=u RETURNING * INTO item;
 ELSIF p_action='delete' THEN
  DELETE FROM public.member_portfolio_items WHERE id=(p_data->>'id')::uuid AND user_id=u RETURNING * INTO item;
 ELSE RAISE EXCEPTION 'Unknown portfolio action'; END IF;
 IF item.id IS NULL THEN RAISE EXCEPTION 'Portfolio item unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('item',to_jsonb(item));
END $$;
REVOKE ALL ON FUNCTION public.ccx_portfolio_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_portfolio_action(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
