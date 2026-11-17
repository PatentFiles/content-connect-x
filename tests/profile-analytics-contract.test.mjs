import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261117122915_record_profile_views_privately_055.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/profile-analytics/index.ts',import.meta.url),'utf8');
const browse=readFileSync(new URL('../src/supabase/CreatorDiscovery.jsx',import.meta.url),'utf8');
test('profile-view table is private with per-member daily deduplication',()=>{
 assert.match(sql,/primary key\(profile_owner_id,viewer_id,viewed_day\)/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.member_profile_view_events from public, anon, authenticated/i);
 assert.match(sql,/profile_views_not_self/i);
});
test('statistics are owner-scoped and raw visitor information is not published',()=>{
 assert.match(edge,/p_owner:uid/);
 assert.match(edge,/db\.rpc\('ccx_profile_view_summary'/);
 assert.match(edge,/!isAdmitted\(viewerAge\.data\?\.\[0\]\)/);
 assert.match(edge,/blocked\.data\?\.length/);
 assert.match(sql,/grant execute on function public\.ccx_profile_view_summary\(uuid\) to service_role/i);
});
test('views are only recorded when an actual public profile is opened',()=>{
 assert.match(browse,/onClick=\{\(\)=>openProfile\(p\)\}/);
 assert.match(browse,/action:'record',profile_owner_id:person\.id/);
});
