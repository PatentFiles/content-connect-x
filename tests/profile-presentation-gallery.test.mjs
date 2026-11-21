import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('owner gallery schema is additive, indexed and owned through row-level security',()=>{
 const migration=read('supabase/migrations/20261121030145_repair_missing_member_media_albums_20261121.sql');
 assert.match(migration,/create table if not exists public\.member_media_albums/i);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/add column if not exists album_id uuid references public\.member_media_albums/i);
 for(const action of ['SELECT','INSERT','UPDATE','DELETE'])assert.match(migration,new RegExp('FOR '+action+' TO authenticated','i'));
 assert.match(migration,/auth\.uid\(\)/);
 assert.doesNotMatch(migration,/drop table|truncate table|delete from/i);
});

test('gallery loads each section independently and exposes useful errors',()=>{
 const ui=read('src/supabase/MediaGalleryBase.jsx');
 assert.match(ui,/Promise\.allSettled/);
 assert.match(ui,/error\.context\.clone\(\)\.json\(\)/);
 assert.match(ui,/setAssets\(results\[0\]\.value\.items\|\|\[\]\)/);
 assert.match(ui,/setAlbums\(results\[2\]\.value\.items\|\|\[\]\)/);
});

test('View Profile navigation remains separate from the account editor',()=>{
 const shell=read('src/supabase/OriginalShell.jsx');
 assert.match(shell,/label:'View Profile'/);
 assert.match(shell,/onNavigate\('public-profile'\)/);
 assert.doesNotMatch(shell,/View Public Profile/);
 const role=read('src/supabase/roleNavigationData.mjs');
 assert.match(role,/Profile:\['My Profile'/);
});

test('owner profile includes connected sections without leaking restricted user data',()=>{
 const ui=read('src/supabase/MemberPublicProfile.jsx');
 for(const name of ['Travel calendar','Professional social links','Representation','Production details','Profile posts','Galleries'])
  assert.ok(ui.includes(name),'Missing profile section '+name);
 assert.doesNotMatch(ui,/real_name|document_path|medical/i);
 const dir=read('supabase/functions/directory/index.ts').split("if(body?.action==='my_public_profile'){")[1].split('const featureKey=')[0];
 assert.ok(dir,'Missing owner-only profile action');
 assert.match(dir,/eq\('id',user\.id\)/);
 assert.match(dir,/\.eq\('visible_to_members',true\)/);
 assert.match(dir,/share_with_premium===true/);
 assert.match(dir,/\.eq\('status','active'\)/);
 assert.match(dir,/agreed_by_representative_at&&row\.agreed_by_professional_at/);
 assert.match(dir,/\.eq\('status','published'\)\.eq\('audience','verified'\)/);
 assert.match(dir,/\.is\('hidden_at',null\)\.is\('group_id',null\)/);
 assert.match(dir,/show_categories_in_discovery/);
 assert.match(dir,/show_orientation_in_discovery/);
 assert.doesNotMatch(dir,/select\('\*'\)/);
 assert.doesNotMatch(dir,/real_name|document_path|testing_credentials|select\([^)]*password/i);
});
