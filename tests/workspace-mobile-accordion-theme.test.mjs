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
 assert.match(source,/Welcome back, <span className="ccx-member-firstname">\{dashboardGreetingName\(profile\)\}<\/span>/);
 assert.ok(source.indexOf('ccx-dashboard-welcome')<source.indexOf('<ConnectFeed userId='),
  'Welcome header must precede the Feed composer');
 assert.match(source,/ConnectFeed userId=\{userId\} paid=\{paid\} preview=\{preview\}/);
});
test('greeting uses only the first chosen name, never surnames, emails or company labels',()=>{
 assert.equal(dashboardGreetingName({display_name:'Tommy Ryder'}),'Tommy');
 assert.equal(dashboardGreetingName({display_name:'  Ava Rae  ',stage_name:'Other',real_name:'Legal'}),'Ava');
 assert.equal(dashboardGreetingName({stage_name:'Stage Choice',real_name:'Legal'}),'Stage');
 assert.equal(dashboardGreetingName({representative_name:'Maya Jones',real_name:'Legal Name'}),'Maya');
 assert.equal(dashboardGreetingName({company_name:'Creative Studio',real_name:'Legal Name'}),'Legal');
 assert.equal(dashboardGreetingName({real_name:'Private Personal'}),'Private');
 assert.equal(dashboardGreetingName({first_name:'Gianna',display_name:'Other Name'}),'Gianna');
 assert.equal(dashboardGreetingName({company_name:'Creative Studio'}),'there');
 assert.equal(dashboardGreetingName({display_name:'member@private.example'}),'there');
 assert.equal(dashboardGreetingName({display_name:'Host Connect X member'}),'there');
 assert.equal(dashboardGreetingName({}),'there');
 assert.equal(dashboardGreetingName({display_name:'  '}),'there');
 assert.equal(dashboardGreetingName({display_name:'A\u0000B'}),'A');
 const fallback=read('src/supabase/DashboardHome.jsx');
 assert.match(fallback,/dashboardGreetingName\(profile\)/);
 assert.doesNotMatch(fallback,/name\?<>Welcome back/);
});
test('desktop navigation is a single full sidebar with static headings and mobile hamburger',()=>{
 const source=read('src/supabase/OriginalShell.jsx');
 assert.doesNotMatch(source,/CategoryRail|expandedGroup|toggleGroup|visibleGroup|ccx-nav-heading-button/);
 assert.match(source,/aria-label="Grouped role navigation"/);
 assert.match(source,/aria-label="Mobile navigation"/);
 assert.match(source,/aria-label="Open navigation menu"/);
 assert.match(source,/className="ccx-nav-heading"/);
 assert.match(source,/ccx-nav-section-links/);
 assert.match(source,/onNavigate\('settings'\)/);
 assert.match(source,/onSignOut/);
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
test('authenticated Content Connect X adopts the public cyan, violet and pink identity without changing Host Connect X',()=>{
 const base=read('src/supabase/workspace-visual-system.css');
 const palette=read('src/supabase/workspace-public-palette.css');
 const nav=read('src/supabase/workspace-nav.css');
 const imports=read('src/supabase/bootstrap.jsx');
 assert.match(imports,/import '\.\/workspace-visual-system\.css';/);
 assert.ok(imports.indexOf("workspace-public-palette.css")>imports.indexOf("workspace-visual-system.css"),
  'Brand-specific overrides must be last');
 assert.match(base,/:root\[data-ccx-appearance="workspace"\] \.oh-app/);
 assert.match(base,/--brand-host-action:#12698f/,'Host Connect blue remains independent');
 assert.match(palette,/:root\[data-ccx-appearance="workspace"\] \.ccx-original-shell/);
 for(const value of ['#09d3f7','#8d69ff','#f800b8'])
  assert.ok(palette.includes(value),'Missing public brand tone '+value);
 for(const selector of ['.ccx-shell-fixed-header','.ccx-nav-panel','.ccx-dashboard-welcome',
  '.ccx-primary','.ccx-member-firstname'])
  assert.ok(palette.includes(selector),'Missing branded workspace component '+selector);
 assert.match(palette,/--ccx-gradient:linear-gradient\(112deg/);
 assert.match(palette,/background:linear-gradient\(112deg,#126ea7/);
 assert.match(palette,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(palette,/\.ccx-dashboard-card::before/,'Decorative card stripes must stay removed');
 const activeSelectors=palette.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(activeSelectors,/\.oh-app|data-ccx-appearance="public"/,
  'Host Connect or logged-out branding must not be overridden by workspace palette');
 assert.match(nav,/ccx-nav-heading/);
 assert.match(read('src/supabase/authAppearance.js'),/signedIn\?'#F7F3FF'/);
});
