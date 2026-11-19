-- Orientation is sensitive. This owner-controlled flag is FALSE for every existing
-- and new member. It is not an advertising preference, recommendation input,
-- or permission to expose free-form self-descriptions.
alter table public.member_profile_preferences
 add column if not exists show_orientation_in_discovery boolean not null default false;
comment on column public.member_profile_preferences.show_orientation_in_discovery
 is 'Explicit opt-in to display a predefined orientation label in a verified member profile only; never for ads.';
