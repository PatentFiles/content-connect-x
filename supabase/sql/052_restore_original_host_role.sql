-- Restore original host profile role while preserving all existing professions.
-- This is an additive enum-style constraint expansion, never a table reset.
ALTER TABLE public.member_profiles
 DROP CONSTRAINT IF EXISTS member_profiles_role_type_check;
ALTER TABLE public.member_profiles
 ADD CONSTRAINT member_profiles_role_type_check
 CHECK (role_type IN (
  'creator','photographer','videographer','video_editor','agent','studio','host'
 ));
