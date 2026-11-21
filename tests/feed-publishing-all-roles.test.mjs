import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLE_ROUTES} from '../src/supabase/roleNavigationData.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Feed publishing uses one entitlement source for every actual professional role',()=>{
 const main=read('src/supabase/SupabaseApp.jsx');
 const wrapper=read('src/supabase/OriginalRoleDashboard.jsx');
 const dashboard=read('src/supabase/CustomDashboard.jsx');
 const feed=read('src/supabase/ConnectFeed.jsx');
 assert.deepEqual(Object.keys(ROLE_ROUTES).slice(0,6),['creator','agent','studio','photographer','videographer','video_editor']);
 for(const role of ['director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider'])assert.ok(ROLE_ROUTES[role],role+' must have a workspace');
 assert.match(main,/tab==='dashboard'&&<OriginalRoleDashboard/);
 assert.match(main,/paid=\{paid\} onNavigate=\{navigateInWorkspace\}/);
 assert.match(wrapper,/roleOverride,paid=false/);
 assert.match(wrapper,/roleOverride=\{roleOverride\} paid=\{paid\}/);
 assert.match(dashboard,/roleOverride,paid=false/);
 assert.match(dashboard,/ConnectFeed userId=\{userId\} paid=\{paid\} preview=\{preview\}/);
 assert.match(dashboard,/not as another role/);
 assert.doesNotMatch(dashboard,/paid=\{data\?\.account\?\.tier/);
 assert.match(feed,/paid&&!preview&&!profileId/);
 assert.match(feed,/action\('create'/);
 for(const role of Object.keys(ROLE_ROUTES)){
  assert.ok(ROLE_ROUTES[role].includes('Dashboard'),role+' should keep the Feed entry point');
 }
});

test('Post author is always authenticated, not the dashboard role-preview identity',()=>{
 const edge=read('supabase/functions/connect-feed/handler.mjs');
 assert.match(edge,/const who=user\.id,action=body\.action/);
 assert.match(edge,/ccx_feed_create_trusted/);
 assert.match(edge,/p_actor:who/);
 assert.doesNotMatch(edge,/body\.(?:author_id|role_type|user_id)\s*(?:\|\||\?\?)/);
});

test('Database permits verified premium creators and professional members equally and admins publishing as themselves',()=>{
 const migration=read('supabase/migrations/20261120195500_all_roles_feed_publishing.sql');
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.ccx_feed_create/i);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.ccx_feed_create_group/i);
 assert.match(migration,/member_admissions/);
 assert.match(migration,/account_security/);
 assert.match(migration,/admin=true and not banned and not suspended/g);
 assert.match(migration,/member_subscriptions/);
 assert.match(migration,/product_feature_flags/);
 assert.match(migration,/FEED_PREMIUM_REQUIRED/);
 assert.match(migration,/FEED_RATE_LIMIT/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.ccx_feed_create\(/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.ccx_feed_create\([^\n]*\) TO service_role/);
 assert.doesNotMatch(migration,/role_type\s*(?:=|IN\s*\()\s*['"]creator/i);
});
