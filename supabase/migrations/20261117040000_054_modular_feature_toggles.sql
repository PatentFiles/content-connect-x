-- Modular launch switches for Bolt UI and Supabase Edge Functions.
-- Preserve existing admin choices on reapplication; never reset live rollouts.
-- Critical account actions (verification, safety, consent withdrawal, security)
-- deliberately have no disable switch.
INSERT INTO public.product_feature_flags(key,enabled,allowed_tiers,description) VALUES
 ('testing',true,ARRAY['free','premium'],'PASS linking requests, private medical PDF uploads and consented clearance sharing'),
 ('search',true,ARRAY['free','premium'],'Creator search page; directory server access is still age-gated'),
 ('favorites',true,ARRAY['free','premium'],'Saved creator profiles'),
 ('connections',true,ARRAY['premium'],'Professional friend requests and connections'),
 ('collaborations',true,ARRAY['premium'],'Private production teams, invitations and collaboration workflows'),
 ('representations',false,ARRAY['premium'],'Agent and studio representation manager; enable after Supabase workflow is complete'),
 ('roster',false,ARRAY['premium'],'Studio roster and portfolio management; enable after role-specific workflow is complete'),
 ('production_manager',true,ARRAY['premium'],'Production planning, team assignments and scheduling'),
 ('hosting_marketplace',true,ARRAY['free','premium'],'Age-gated OnlyHost space discovery and hosting tools')
ON CONFLICT(key) DO NOTHING;
