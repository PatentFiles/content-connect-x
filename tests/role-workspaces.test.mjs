import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLE_ROUTES,navigationForRole,TAB_FOR_PAGE} from '../src/supabase/roleNavigationData.mjs';
import {effectiveWorkspaceRole,professionalSections,PORTFOLIO_ROLES,localDiscoveryFilters,validateWorkLink} from '../src/supabase/roleWorkspacePolicy.mjs';
import {isModuleVisible,isModuleEnabled} from '../src/supabase/featureModules.mjs';
import {safeProfileAvatarPath,directoryFeatureForMode} from '../supabase/functions/directory/profileCardPolicy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all six CCX roles have the original discovery/search/favorites/properties routes',()=>{
 assert.deepEqual(Object.keys(ROLE_ROUTES),['creator','agent','studio','photographer','videographer','video_editor']);
 for(const role of Object.keys(ROLE_ROUTES))for(const path of ['Dashboard','Discovery','Search','Favorites','Connections','Messages','Properties','Profile','Settings'])assert.ok(ROLE_ROUTES[role].includes(path),role+': '+path);
 assert.equal(navigationForRole('creator').find(x=>x.path==='Properties').label,'Properties');
 assert.equal(TAB_FOR_PAGE.Properties,'hosting');
});
test('roster and portfolio routes belong to their respective roles, not Host',()=>{
 for(const role of ['agent','studio'])assert.ok(ROLE_ROUTES[role].includes('Roster'));
 for(const role of PORTFOLIO_ROLES)assert.ok(ROLE_ROUTES[role].includes('Portfolio'));
 assert.equal(ROLE_ROUTES.host,undefined);
 assert.equal(ROLE_ROUTES.creator.includes('Portfolio'),false);
});
test('a missing flag response cannot erase navigation, but cannot grant access',()=>{
 assert.equal(isModuleVisible('directory',null),true);
 assert.equal(isModuleVisible('directory',{}),true);
 assert.equal(isModuleEnabled('directory',{}),false);
 assert.equal(isModuleVisible('directory',{creator_discovery:false}),false);
 assert.equal(isModuleVisible('directory',{creator_discovery:true}),true);
});
test('only an administrator can preview another presentation role',()=>{
 assert.equal(effectiveWorkspaceRole('creator','studio',true),'studio');
 assert.equal(effectiveWorkspaceRole('creator','studio',false),'creator');
 assert.equal(effectiveWorkspaceRole('creator','host',true),'creator');
 for(const role of ['agent','studio',...PORTFOLIO_ROLES]){
  const sections=professionalSections(role).map(([id])=>id);
  for(const forbidden of ['identity','collaboration','production','health'])assert.equal(sections.includes(forbidden),false);
 }
});
test('local discovery uses the stored general city; no precise geolocation is fabricated',()=>{
 assert.deepEqual(localDiscoveryFilters({city:'Phoenix',state:'AZ',country:'United States'}),{query:'',role:'',country:'United States',state:'AZ',city:'Phoenix',category:'',gender:''});
 assert.equal(localDiscoveryFilters().city,'');
 const browse=read('src/supabase/CreatorDiscovery.jsx');
 assert.match(browse,/MemberDiscoveryCard/);
 assert.match(browse,/onClick=\{\(\)=>openProfile\(p\)\}/);
 assert.match(browse,/creator_favorites/);
 assert.match(read('src/supabase/MemberDiscoveryCard.jsx'),/right-3 top-3/);
});
test('work links are HTTPS only and never use executable or credential-bearing URLs',()=>{
 assert.equal(validateWorkLink('https://vimeo.com/123'),'https://vimeo.com/123');
 for(const url of ['javascript:alert(1)','http://example.com','https://name:password@example.com','https://localhost/file'])assert.equal(validateWorkLink(url),null);
});
test('directory can sign only the visible profile-avatar folder',()=>{
 const owner='00000000-0000-4000-8000-000000000001';
 const good=owner+'/profile/avatar-example.png';
 assert.equal(safeProfileAvatarPath(owner,good),good);
 for(const bad of [owner+'/clearance/document.pdf',owner+'/private/image.png',owner+'/profile/avatar-../secret.png','someone-else/profile/avatar-example.png'])assert.equal(safeProfileAvatarPath(owner,bad),null);
 assert.equal(directoryFeatureForMode('search'),'search');
 assert.equal(directoryFeatureForMode('favorites'),'favorites');
});
test('roster/portfolio mount their real components without replacing unrelated workspaces',()=>{
 assert.match(read('src/supabase/ProductionManager.jsx'),/w\.tab==='roster'/);
 assert.match(read('src/supabase/MediaGallery.jsx'),/w\.tab==='portfolio'/);
 assert.match(read('src/supabase/CreatorProfileEditor.jsx'),/ProfessionalProfileEditor/);
 assert.match(read('src/supabase/CreatorProfileEditor.jsx'),/workspace\.preview/);
 assert.match(read('src/supabase/ProfessionalProfileEditor.jsx'),/ccx_save_professional_profile/);
 assert.match(read('src/supabase/RosterPanel.jsx'),/ccx_roster_action/);
 assert.match(read('src/supabase/ProfessionalPortfolio.jsx'),/ccx_portfolio_action/);
});
