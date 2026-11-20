import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLE_ROUTES,navigationForRole} from '../src/supabase/roleNavigationData.mjs';
import {groupedWorkspaceNavigation,currentNavigationGroup,WORKSPACE_NAV_GROUPS} from '../src/supabase/workspaceNavigationGroups.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all professional roles retain every existing route when grouped',()=>{
 for(const role of Object.keys(ROLE_ROUTES)){
  const links=navigationForRole(role);
  const extras=[{path:'Notifications',label:'Notifications'},{path:'PublicProfile',label:'View Public Profile'},{path:'Membership',label:'Membership'}];
  const groups=groupedWorkspaceNavigation(links,[],extras);
  const items=groups.flatMap(g=>g.items);
  const paths=items.map(item=>item.path);
  assert.deepEqual(new Set(paths),new Set([...links.map(x=>x.path),...extras.map(x=>x.path)]),role+' route preservation');
  assert.equal(paths.length,new Set(paths).size,'Sidebar does not repeat links');
  assert.ok(paths.includes('Shop'),role+' can open Shop');
  assert.ok(groups.some(g=>g.id==='personal'&&g.items.some(x=>x.path==='Notifications')));
  assert.equal(currentNavigationGroup(groups,'messages',path=>path==='Messages'?'messages':path),'community');
 }
});
test('admin links have their own gated groups, and role previews cannot invent admin items',()=>{
 const roleLinks=navigationForRole('creator');
 const adminLinks=[
  {path:'AdminDashboard',label:'Platform Controls'},
  {path:'CompliancePortal',label:'API & Integrations'},
  {path:'TestingReviews',label:'Testing Reviews'}
 ];
 const member=groupedWorkspaceNavigation(roleLinks);
 const admin=groupedWorkspaceNavigation(roleLinks,adminLinks);
 assert.equal(member.some(g=>g.id==='admin'||g.id==='integrations'),false);
 assert.ok(admin.find(g=>g.id==='admin').items.some(x=>x.path==='AdminDashboard'));
 assert.ok(admin.find(g=>g.id==='integrations').items.some(x=>x.path==='CompliancePortal'));
 assert.equal(currentNavigationGroup(admin,'unknown',()=>null),null);
 assert.equal(WORKSPACE_NAV_GROUPS.at(0).label,'Overview');
});
test('desktop rail and mobile drawer share categorized page components and current-page feedback',()=>{
 const shell=read('src/supabase/OriginalShell.jsx');
 assert.match(shell,/ccx-nav-rail/);
 assert.match(shell,/NavigationSections groups=\{navGroups\}/);
 assert.match(shell,/Mobile grouped navigation/);
 assert.match(shell,/aria-current=\{isActive\?'page':undefined\}/);
 assert.match(shell,/aria-current=\{active\?'location':undefined\}/);
 assert.match(shell,/onNavigate\('public-profile'\)/);
 assert.match(shell,/RoleDashboardSwitcher/);
 assert.match(shell,/getNavigationForRole\(effectiveRole\)\.filter\(item=>isModuleVisible/);
 assert.match(shell,/isAdmin\?\[/);
});
test('authenticated sidebar styling respects marketing pages and aligns footer',()=>{
 const css=read('src/supabase/workspace-nav.css');
 const bootstrap=read('src/supabase/bootstrap.jsx');
 assert.match(bootstrap,/import '\.\/workspace-nav\.css';/);
 assert.match(css,/:root\[data-ccx-appearance="workspace"\]/);
 assert.match(css,/--ccx-workspace-nav-width:18rem/);
 assert.match(css,/ccx-shell-main/);
 assert.match(css,/ccx-trust-footer:not\(\.ccx-trust-footer-standalone\)/);
 assert.match(css,/margin-left:var\(--ccx-workspace-nav-width\)!important/);
 assert.match(css,/@media \(min-width:768px\)/);
 assert.match(css,/@media \(max-width:767px\)/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media \(forced-colors:active\)/);
 assert.ok(!css.includes('public-landing'),'Logged-out home pages must not be restyled');
});
