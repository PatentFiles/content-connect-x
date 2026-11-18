-- Durable onboarding drives dashboard access; verification badges remain factual.
DO $repair$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('ccx_workspace_private.ccx_dashboard_action(text,jsonb,integer)'::regprocedure) INTO source;
 source:=replace(source,'WHEN NOT coalesce((account->>''age_verified'')::boolean,false) THEN ''verification_required''','WHEN NOT coalesce((account->>''onboarding_complete'')::boolean,false) THEN ''onboarding_required''');
 source:=replace(source,'THEN ''Verified'' ELSE ''Verification required'' END','THEN ''Verified'' WHEN coalesce((account->>''onboarding_complete'')::boolean,false) THEN ''Active'' ELSE ''Signup incomplete'' END');
 EXECUTE source;
END $repair$;

CREATE TABLE IF NOT EXISTS public.host_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=100),
 legal_name text NOT NULL DEFAULT '' CHECK(length(legal_name)<=150),
 company_name text NOT NULL DEFAULT '' CHECK(length(company_name)<=150),
 contact_email text NOT NULL DEFAULT '' CHECK(length(contact_email)<=254),
 phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40),
 city text NOT NULL DEFAULT '' CHECK(length(city)<=100),
 region text NOT NULL DEFAULT '' CHECK(length(region)<=100),
 country text NOT NULL DEFAULT '' CHECK(length(country)<=100),
 postal_address text NOT NULL DEFAULT '' CHECK(length(postal_address)<=400),
 postal_code text NOT NULL DEFAULT '' CHECK(length(postal_code)<=24),
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=1500),
 languages text[] NOT NULL DEFAULT '{}' CHECK(cardinality(languages)<=20),
 timezone text NOT NULL DEFAULT 'America/Phoenix' CHECK(length(timezone)<=100),
 emergency_contact_name text NOT NULL DEFAULT '' CHECK(length(emergency_contact_name)<=100),
 emergency_contact_phone text NOT NULL DEFAULT '' CHECK(length(emergency_contact_phone)<=40),
 avatar_path text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(avatar_path IS NULL OR (avatar_path LIKE user_id::text||'/%' AND avatar_path NOT LIKE '%..%'))
);
ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.host_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.host_profiles TO authenticated;
CREATE POLICY host_profiles_self_read ON public.host_profiles FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY host_profiles_self_insert ON public.host_profiles FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.account_security a WHERE a.user_id=(SELECT auth.uid()) AND NOT a.banned AND NOT a.suspended));
CREATE POLICY host_profiles_self_update ON public.host_profiles FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.account_security a WHERE a.user_id=(SELECT auth.uid()) AND NOT a.banned AND NOT a.suspended));

CREATE TABLE IF NOT EXISTS public.property_amenity_catalog (
 key text PRIMARY KEY CHECK(key ~ '^[a-z0-9_]{2,80}$'),
 label text NOT NULL CHECK(length(label) BETWEEN 2 AND 70),
 category text NOT NULL DEFAULT 'custom',
 active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS property_amenity_label_unique ON public.property_amenity_catalog(lower(label));
ALTER TABLE public.property_amenity_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_amenity_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.property_amenity_catalog TO authenticated;
CREATE POLICY property_amenity_read ON public.property_amenity_catalog FOR SELECT TO authenticated USING(active);
INSERT INTO public.property_amenity_catalog(key,label,category) VALUES
 ('wifi','Wi-Fi','connectivity'),('parking','Parking','access'),('private_entrance','Private entrance','privacy'),
 ('makeup_room','Makeup room','production'),('dressing_room','Dressing room','privacy'),('shower','Shower','hygiene'),
 ('kitchen','Kitchen','comfort'),('restroom','Restroom','hygiene'),('soundproof','Soundproofing','production'),
 ('lighting','Studio lighting','production'),('green_screen','Green screen','production'),('power_220v','220V power','production'),
 ('accessible','Accessibility','access'),('outdoor','Outdoor space','space'),('security','Security','safety'),
 ('air_conditioning','A/C','comfort'),('load_in','Load-in access','access'),('bedroom','Bedroom','space'),('pool','Pool','space'),
 ('blackout_curtains','Blackout curtains','privacy'),('privacy_screens','Privacy screens','privacy'),('private_changing','Private changing area','privacy'),
 ('closed_set','Closed-set access control','privacy'),('discreet_arrival','Discreet arrival / departure','privacy'),
 ('fresh_linens','Fresh linens and towels','hygiene'),('washable_surfaces','Easy-clean surfaces','hygiene'),
 ('laundry','Washer and dryer','hygiene'),('hot_water','Reliable hot water','hygiene'),('sanitation_station','Sanitation station','hygiene'),
 ('waterproof_area','Water-resistant production area','production'),('dimmable_lights','Dimmable lights','production'),
 ('sound_treatment','Acoustic treatment','production'),('backup_power','Backup power','production'),('equipment_storage','Secure equipment storage','production'),
 ('ventilation','Ventilation','comfort'),('climate_control','Climate control','comfort'),('first_aid','First-aid supplies','safety'),
 ('fire_extinguisher','Fire extinguisher','safety'),('accessible_shower','Accessible shower','access'),('step_free','Step-free access','access'),
 ('crew_lounge','Crew lounge','comfort'),('outdoor_privacy','Private screened outdoor area','privacy')
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_add_property_amenity(p_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); name text; result public.property_amenity_catalog; generated text;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=u AND NOT banned AND NOT suspended) OR NOT EXISTS(SELECT 1 FROM public.onlyhost_accounts WHERE user_id=u AND status='active' AND property_authority_confirmed AND legal_capacity_confirmed AND adult_production_understood) THEN RAISE EXCEPTION 'Active property-host account required' USING ERRCODE='42501'; END IF;
 name:=regexp_replace(trim(p_label),'\s+',' ','g');
 IF name IS NULL OR length(name)<2 OR length(name)>70 OR name ~ '[<>\x00-\x1f]' THEN RAISE EXCEPTION 'Enter an amenity name of 2–70 characters without markup'; END IF;
 SELECT * INTO result FROM public.property_amenity_catalog WHERE lower(label)=lower(name);
 IF FOUND THEN IF NOT result.active THEN RAISE EXCEPTION 'This amenity is unavailable'; END IF; RETURN jsonb_build_object('key',result.key,'label',result.label,'category',result.category); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':amenity',0));
 IF (SELECT count(*) FROM public.property_amenity_catalog WHERE created_by=u AND created_at>now()-interval '24 hours')>=10 THEN RAISE EXCEPTION 'Daily custom amenity limit reached'; END IF;
 generated:='custom_'||substr(md5(lower(name)),1,24);
 INSERT INTO public.property_amenity_catalog(key,label,created_by) VALUES(generated,name,u) ON CONFLICT DO NOTHING;
 SELECT * INTO result FROM public.property_amenity_catalog WHERE lower(label)=lower(name);
 IF result.key IS NULL OR NOT result.active THEN RAISE EXCEPTION 'Could not save amenity'; END IF;
 RETURN jsonb_build_object('key',result.key,'label',result.label,'category',result.category);
END $$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_add_property_amenity(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ccx_workspace_private.ccx_add_property_amenity(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ccx_add_property_amenity(p_label text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT ccx_workspace_private.ccx_add_property_amenity(p_label); $$;
REVOKE ALL ON FUNCTION public.ccx_add_property_amenity(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ccx_add_property_amenity(text) TO authenticated,service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('host-profile-photos','host-profile-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY host_profile_photo_self ON storage.objects FOR ALL TO authenticated USING(bucket_id='host-profile-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text) WITH CHECK(bucket_id='host-profile-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
NOTIFY pgrst,'reload schema';
