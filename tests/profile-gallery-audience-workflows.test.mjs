import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all creator production categories allow saved custom tags except the three compensation choices',()=>{
 const editor=read('src/supabase/OriginalCreatorPreferences.jsx');
 const form=read('src/supabase/CreatorProfileEditorBase.jsx');
 for(const field of ['scene_pairings','standard_acts','fetish_acts','kink_edge_acts','performance_positioning','looking_for_genders']){
  assert.ok(editor.includes("'"+field+"'")||editor.includes(field+':'),'Missing '+field);
 }
 assert.match(editor,/const allowsOther=name!=='compensation_preferences'/);
 assert.match(editor,/const tag='custom:'\+label/);
 assert.match(editor,/onKeyDown=\{e=>\{if\(e\.key==='Enter'/);
 assert.doesNotMatch(editor,/<form onSubmit=\{add\}/);
 assert.doesNotMatch(form,/<CheckList label="Preferred collaborators"/);
 assert.doesNotMatch(form,/<CheckList label="Professional specialties" options=\{specialties\}>\s*selected=\{prefs\.specialties\}/);
 assert.match(form,/form\.role_type==='creator'&&<OriginalCreatorPreferences/);
 assert.match(editor,/compensation_preferences:/);
});

test('album privacy rules are persisted and deny group and general access without server checks',()=>{
 const sql=read('supabase/migrations/20261122114000_ccx_gallery_album_audiences.sql');
 const edge=read('supabase/functions/media-gateway/index.ts');
 assert.match(sql,/default 'private'/);
 for(const scope of ['premium','friends','groups','private'])assert.ok(sql.includes("'"+scope+"'"));
 assert.match(sql,/cardinality\(allowed_group_ids\)<=12/);
 assert.match(edge,/const canView=async/);
 assert.match(edge,/const activeGroups=async/);
 assert.match(edge,/ccx_social_group_members/);
 assert.match(edge,/m\.status==='active'|\.eq\('status','active'\)/);
 assert.match(edge,/if\(await canView\(media\)\)filtered\.push/);
 assert.match(edge,/!await canView\(asset\)/);
 assert.match(edge,/await audienceFor\(asset\)!=='premium'/);
 assert.match(edge,/await revokeShares\(/);
 assert.match(edge,/if\(ownedError\|\|!owned\)return reply\(\{error:'Media not found'/);
 assert.match(edge,/if\(action==='edit_media'\)/);
 assert.match(edge,/if\(action==='update_album'\)/);
 assert.match(edge,/if\(action==='available_groups'\)/);
});

test('profile and dashboard screens expose per-album management and signed private avatars',()=>{
 const manager=read('src/supabase/GalleryAlbumManager.jsx');
 const profile=read('src/supabase/ProfileGallery.jsx');
 const owner=read('src/supabase/MediaGalleryBase.jsx');
 const avatar=read('src/supabase/DashboardProfileAvatar.jsx');
 const dashboard=read('src/supabase/CustomDashboard.jsx');
 const shell=read('src/supabase/OriginalShell.jsx');
 for(const action of ['create_album','update_album','delete_album','available_groups'])assert.ok(manager.includes("'"+action+"'"));
 for(const action of ['edit_media','assign_album','GalleryAlbumManager'])assert.ok(profile.includes(action));
 assert.match(owner,/GalleryAlbumManager/);
 assert.match(owner,/Save details/);
 assert.match(avatar,/createSignedUrl\(path,600\)/);
 assert.match(dashboard,/DashboardProfileAvatar profile=\{profile\}/);
 assert.match(shell,/DashboardProfileAvatar profile=\{profile\}/);
});
