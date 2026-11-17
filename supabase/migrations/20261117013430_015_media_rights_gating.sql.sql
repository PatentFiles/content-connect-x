-- Media release rights must be acknowledged before any gallery publication.
alter table public.member_media_assets
 add column if not exists uploader_rights_attested boolean not null default false,
 add column if not exists rights_attested_at timestamptz;
insert into public.product_feature_flags(key,enabled,allowed_tiers,description)
 values('media_gallery',true,array['free','premium'],
   'Moderated, age-gated creator media. Premium users may submit private media for review')
 on conflict(key) do nothing;