-- Preserve existing owner-only professional save rules while enabling added verified service roles.
CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_save_professional_profile(p_profile jsonb, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); r text; name text;
BEGIN
 IF NOT public.ccx_workspace_allowed(NULL,ARRAY['agent','studio','photographer','videographer','video_editor','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider']) THEN RAISE EXCEPTION 'Verified professional account required' USING ERRCODE='42501'; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u FOR UPDATE;
 name:=trim(coalesce(p_profile->>'display_name',''));
 IF name='' OR length(name)>100 THEN RAISE EXCEPTION 'Display name is required (100 characters maximum)'; END IF;
 IF r='studio' AND (trim(coalesce(p_profile->>'company_name',''))='' OR trim(coalesce(p_profile->>'representative_name',''))='') THEN RAISE EXCEPTION 'Studio name and representative are required'; END IF;
 UPDATE public.member_profiles SET display_name=name,real_name=left(trim(coalesce(p_profile->>'real_name','')),120),company_name=left(trim(coalesce(p_profile->>'company_name','')),120),representative_name=left(trim(coalesce(p_profile->>'representative_name','')),120),bio=left(coalesce(p_profile->>'bio',''),2000),city=left(trim(coalesce(p_profile->>'city','')),100),state=left(trim(coalesce(p_profile->>'state','')),100),country=left(trim(coalesce(p_profile->>'country','')),100),profile_complete=true,updated_at=now() WHERE id=u;
 INSERT INTO public.member_professional_details(user_id,specialties,services,equipment,software,website,hourly_rate,day_rate,currency,commission_percent,accepting_talent,available_to_travel,turnaround_days)
 VALUES(u,left(coalesce(p_details->>'specialties',''),1000),left(coalesce(p_details->>'services',''),2000),left(coalesce(p_details->>'equipment',''),2000),left(coalesce(p_details->>'software',''),1000),left(coalesce(p_details->>'website',''),1000),nullif(p_details->>'hourly_rate','')::numeric,nullif(p_details->>'day_rate','')::numeric,coalesce(nullif(p_details->>'currency',''),'USD'),nullif(p_details->>'commission_percent','')::numeric,coalesce((p_details->>'accepting_talent')::boolean,false),coalesce((p_details->>'available_to_travel')::boolean,false),nullif(p_details->>'turnaround_days','')::integer)
 ON CONFLICT(user_id) DO UPDATE SET specialties=EXCLUDED.specialties,services=EXCLUDED.services,equipment=EXCLUDED.equipment,software=EXCLUDED.software,website=EXCLUDED.website,hourly_rate=EXCLUDED.hourly_rate,day_rate=EXCLUDED.day_rate,currency=EXCLUDED.currency,commission_percent=EXCLUDED.commission_percent,accepting_talent=EXCLUDED.accepting_talent,available_to_travel=EXCLUDED.available_to_travel,turnaround_days=EXCLUDED.turnaround_days,updated_at=now();
 RETURN jsonb_build_object('saved',true,'role_type',r);
END $function$
;
