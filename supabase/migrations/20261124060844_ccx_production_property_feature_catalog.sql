-- Compatibility catalog for older CCX property tools. The current shared
-- marketplace is authoritative in the Host Connect X project.
-- Keep inactive historical keys rather than deleting catalog references.
UPDATE public.property_amenity_catalog SET active=false WHERE active;
-- The legacy case-insensitive unique label index also covers inactive rows.
-- Preserve those keys with explicitly retired labels.
UPDATE public.property_amenity_catalog SET label=CASE key
 WHEN 'outdoor' THEN 'Retired outdoor space (legacy)'
 WHEN 'soundproof' THEN 'Retired soundproofing (legacy)' END
 WHERE key IN ('outdoor','soundproof');
INSERT INTO public.property_amenity_catalog(key,label,category,active) VALUES
('wifi','Wi-Fi','Space Essentials',true),
('air_conditioning','Air conditioning','Space Essentials',true),
('heating','Heating','Space Essentials',true),
('off_street_parking','Off Street Parking','Space Essentials',true),
('private_entrance','Private entrance','Space Essentials',true),
('free_parking','Free parking','Space Essentials',true),
('multiple_rooms','Multiple rooms','Space Essentials',true),
('bedroom','Bedroom','Space Essentials',true),
('bathroom','Bathroom','Space Essentials',true),
('kitchen','Kitchen','Space Essentials',true),
('outdoor_space','Outdoor space','Space Essentials',true),
('natural_light','Natural light','Space Essentials',true),
('entire_place','Entire Place','Space Essentials',true),
('lighting_equipment','Professional lighting','Production Features',true),
('camera_equipment','Camera equipment','Production Features',true),
('microphones','Microphones','Production Features',true),
('multiple_camera_angles','Multiple camera angles','Production Features',true),
('monitor','Monitors','Production Features',true),
('tripods_stands','Tripods / stands','Production Features',true),
('soundproofing','Soundproofing','Production Features',true),
('makeup_station','Makeup station','Production Features',true),
('wardrobe','Wardrobe','Production Features',true),
('backdrops','Backdrops','Production Features',true),
('props','Props','Production Features',true),
('on_site_staff','On-site crew','Production Features',true),
('pool','Swimming pool','Outdoor & Main Attractions',true),
('hot_tub','Hot tub','Outdoor & Main Attractions',true),
('private_yard','Private yard','Outdoor & Main Attractions',true),
('patio','Patio','Outdoor & Main Attractions',true),
('balcony','Balcony','Outdoor & Main Attractions',true),
('rooftop','Rooftop','Outdoor & Main Attractions',true),
('garden','Garden','Outdoor & Main Attractions',true),
('beach_access','Beach access','Outdoor & Main Attractions',true),
('scenic_views','Scenic views','Outdoor & Main Attractions',true),
('outdoor_shower','Outdoor shower','Outdoor & Main Attractions',true),
('fire_pit','Fire pit','Outdoor & Main Attractions',true),
('multiple_outdoor_areas','Multiple outdoor areas','Outdoor & Main Attractions',true),
('luxury','Luxury','Space Style',true),
('modern','Modern','Space Style',true),
('minimalist','Minimalist','Space Style',true),
('glamorous','Glamorous','Space Style',true),
('industrial','Industrial','Space Style',true),
('rustic','Rustic','Space Style',true),
('tropical','Tropical','Space Style',true),
('mansion','Mansion','Space Style',true),
('penthouse','Penthouse','Space Style',true),
('loft','Loft','Space Style',true),
('villa','Villa','Space Style',true),
('studio','Studio','Space Style',true),
('fully_private_property','Fully private property','Privacy & Production',true),
('no_shared_spaces','No shared spaces','Privacy & Production',true),
('no_on_site_owner','No on-site owner','Privacy & Production',true),
('secluded_location','Secluded location','Privacy & Production',true),
('secure_parking','Secure parking','Privacy & Production',true),
('discreet_location','Discreet location','Privacy & Production',true),
('noise_friendly','Noise-friendly','Privacy & Production',true),
('extended_shooting_hours','Extended shooting hours','Privacy & Production',true),
('production_crew_allowed','Production crew allowed','Privacy & Production',true),
('multiple_performers_allowed','Multiple performers allowed','Privacy & Production',true),
('equipment_allowed','Equipment allowed','Privacy & Production',true),
('step_free_access','Step-free entrance','Accessibility',true),
('disabled_parking','Accessible parking','Accessibility',true),
('wide_entrance','Wide entrances','Accessibility',true),
('elevator','Elevator','Accessibility',true),
('accessible_bathroom','Accessible bathroom','Accessibility',true),
('step_free_bathroom','Step-free bathroom','Accessibility',true),
('accessible_bedroom','Accessible bedroom','Accessibility',true),
('accessible_shower','Accessible shower','Accessibility',true)
ON CONFLICT(key) DO UPDATE SET label=excluded.label,category=excluded.category,active=true;
CREATE OR REPLACE FUNCTION public.ccx_add_property_amenity(p_label text)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Choose a feature from the approved production property catalog' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.ccx_add_property_amenity(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_add_property_amenity(text) FROM PUBLIC,anon,authenticated;
