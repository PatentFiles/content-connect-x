import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dashboardGreetingName} from '../src/supabase/roleWorkspacePolicy.mjs';
import {ROLE_ROUTES} from '../src/supabase/roleNavigationData.mjs';
import {groupedWorkspaceNavigation,currentNavigationGroup} from '../src/supabase/workspaceNavigationGroups.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('six professional dashboards greet the actual member above the update composer',()=>{
 const source=read('src/supabase/CustomDashboard.jsx');
 for(const role of ['creator','agent','studio','photographer','videographer','video_editor']){
  assert.ok(ROLE_ROUTES[role]?.includes('Dashboard'),'Missing dashboard for '+role);
 }
 assert.match(source,/aria-label="Welcome to your dashboard"/);
 assert.match(source,/Welcome back, \{dashboardGreetingName\(profile\)\}/);
 assert.ok(source.indexOf('ccx-dashboard-welcome')<source.indexOf('<ConnectFeed userId='),
  'Welcome header must precede the Feed composer');
 assert.match(source,/ConnectFeed userId=\{userId\} paid=\{paid\} preview=\{preview\}/);
});
test('greeting selects a display or stage name before legal/private name',()=>{
 assert.equal(dashboardGreetingName({display_name:'  Ava Rae  ',stage_name:'Other',real_name:'Legal'}),'Ava Rae');
 assert.equal(dashboardGreetingName({stage_name:'Stage Choice',real_name:'Legal'}),'Stage Choice');
 assert.equal(dashboardGreetingName({company_name:'Creative Studio',real_name:'Legal'}),'Creative Studio');
 assert.equal(dashboardGreetingName({real_name:'Private Personal'}),'Private Personal');
 assert.equal(dashboardGreetingName({}),'there');
 assert.equal(dashboardGreetingName({display_name:'  '}),'there');
 assert.equal(dashboardGreetingName({display_name:'A\u0000B'}),'A B');
});
test('desktop category rail reveals one section; mobile is traditional single-column hamburger',()=>{
 const source=read('src/supabase/OriginalShell.jsx');
 assert.match(source,/const \[expandedGroup,setExpandedGroup\]=useState\(null\)/);
 assert.match(source,/visibleGroup=expandedGroup===null/);
 assert.match(source,/const toggleGroup=id=>setExpandedGroup\(id\?\?'\'\)/);
 assert.match(source,/const open=mobile\|\|expandedGroup===group\.id/);
 assert.match(source,/aria-expanded=\{open\}/);
 assert.match(source,/onClick=\{\(\)=>onExpand\?\.\(open\?null:group\.id\)\}/);
 assert.match(source,/aria-label="Open navigation menu"/);
 assert.match(source,/aria-label="Mobile navigation"/);
 assert.doesNotMatch(source,/<CategoryRail mobile/);
 assert.match(source,/flex-col overflow-hidden border-r/);
 const groups=groupedWorkspaceNavigation([{path:'Dashboard',label:'Dashboard'},
 {path:'Discovery',label:'Discovery'},{path:'Messages',label:'Messages'}]);
 assert.equal(currentNavigationGroup(groups,'messages',path=>({Messages:'messages',Dashboard:'dashboard',Discovery:'directory'})[path]),'community');
});
test('Host Connect offers standard mobile hamburger, settings and section navigation',()=>{
 const host=read('src/supabase/OnlyHostApp.jsx');
 const marketplace=read('src/supabase/HostingMarketplace.jsx');
 assert.match(host,/Open Host Connect navigation menu/);
 assert.match(host,/Host Connect mobile navigation/);
 assert.match(host,/hostMenuOpen&&user&&/);
 assert.match(host,/\['host','Dashboard',Home\]/);
 assert.match(host,/\['alerts','Notifications',Bell\]/);
 assert.match(host,/\['crew','Crew inbox',UsersRound\]/);
 assert.match(host,/Log out/);
 assert.match(host,/role="dialog" aria-modal="true"/);
 assert.match(host,/requestedSection=\{hostSection\}/);
 assert.match(marketplace,/requestedSection=null/);
 assert.match(marketplace,/setSection\(requestedSection\)/);
});
test('unified enterprise colors are scoped to authenticated sites, not public marketing',()=>{
 const css=read('src/supabase/workspace-visual-system.css');
 const nav=read('src/supabase/workspace-nav.css');
 const imports=read('src/supabase/bootstrap.jsx');
 assert.match(imports,/import '\.\/workspace-visual-system\.css';/);
 assert.match(css,/:root\[data-ccx-appearance="workspace"\] \.ccx-original-shell/);
 assert.match(css,/:root\[data-ccx-appearance="workspace"\] \.oh-app/);
 assert.match(css,/--cc-surface:#ffffff/);
 assert.match(css,/--cc-action:#253244/);
 assert.match(css,/data-feed-composer/);
 assert.match(css,/ccx-dashboard-card::before\{\s*display:none!important/);
 assert.match(css,/oh-host-mobile-drawer/);
 assert.match(nav,/--ccx-nav-rail-bg:#15191f/);
 assert.match(nav,/ccx-nav-heading-button/);
 assert.doesNotMatch(css,/data-ccx-appearance="public"/);
 const boot=read('src/supabase/bootstrap.jsx');
 assert.match(boot,/Host_Connect_Banner|onlyhost-theme|OnlyHostApp/);
});
