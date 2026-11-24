-- Retire two unused professional roles. Do not erase any historical customer
-- or payment records: abort if a removed role is referenced.
DO $retire$
BEGIN
 IF EXISTS(SELECT 1 FROM public.member_profiles WHERE role_type IN ('chef','spa_provider'))
 OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE plan_id IN ('chef_pro','spa_provider_pro'))
 OR EXISTS(SELECT 1 FROM public.ccx_membership_checkout_attempts WHERE plan_code IN ('chef_pro','spa_provider_pro'))
 OR EXISTS(SELECT 1 FROM public.ccx_membership_contracts WHERE plan_code IN ('chef_pro','spa_provider_pro'))
 THEN RAISE EXCEPTION 'Retired role has existing records; require reviewed migration'; END IF;
END $retire$;
DELETE FROM public.membership_plan_catalog WHERE role_type IN ('chef','spa_provider');
ALTER TABLE public.member_profiles DROP CONSTRAINT member_profiles_role_type_check,
 ADD CONSTRAINT member_profiles_role_type_check CHECK(role_type IN ('creator','photographer','videographer','video_editor','agent','studio','host','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental'));
ALTER TABLE public.membership_plan_catalog DROP CONSTRAINT membership_plan_catalog_role_type_check,
 ADD CONSTRAINT membership_plan_catalog_role_type_check CHECK(role_type IN ('creator','photographer','videographer','video_editor','agent','studio','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental'));
