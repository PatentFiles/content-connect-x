-- Applied on November 22 UTC, 2026; performance-only, additive migration.
-- No identity admission, authorization, booking state, financial or consent change.
CREATE INDEX IF NOT EXISTS idx_ccx_posts_repost_parent ON public.community_posts (repost_of);
CREATE INDEX IF NOT EXISTS idx_ccx_media_albums_owner ON public.member_media_albums (owner_id);
CREATE INDEX IF NOT EXISTS idx_ccx_feed_media_asset ON public.ccx_feed_post_media (media_id);
CREATE INDEX IF NOT EXISTS idx_ccx_recordings_collaboration_fk ON public.ccx_collab_recordings (collaboration_id);
CREATE INDEX IF NOT EXISTS idx_ccx_idv_review_assigned_fk ON public.ccx_idv_review_cases (assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ccx_signature_provider_envelope_fk ON public.ccx_signature_provider_events (envelope_id);
