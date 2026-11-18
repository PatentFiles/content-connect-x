/** Regression contracts for the full-screen host workspace and standalone member pages. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMatterportUrl,matterportLinkFromText} from '../src/supabase/propertyTourPolicy.mjs';
const read=path=>readFileSync(path,'utf8');
test('Matterport accepts only hosted Showcase URLs and strips tracking/settings',()=>{
 assert.equal(normalizeMatterportUrl('https://my.matterport.com/show/?m=AbCdEf12345&play=1'),'https://my.matterport.com/show/?m=AbCdEf12345');
 for(const value of ['javascript:alert(1)','https://evil.example/show/?m=AbCdEf12345','http://my.matterport.com/show/?m=AbCdEf12345','https://user:password@my.matterport.com/show/?m=AbCdEf12345','https://my.matterport.com.evil.example/show/?m=AbCdEf12345','https://my.matterport.com:444/show/?m=AbCdEf12345','https://my.matterport.com/show/?m=<script>'])assert.equal(normalizeMatterportUrl(value),null);
});
test('tour link files import safe links, not executable iframe markup or raw models',()=>{
 assert.equal(matterportLinkFromText('[InternetShortcut]\nURL=https://my.matterport.com/show/?m=AbCdEf12345'),'https://my.matterport.com/show/?m=AbCdEf12345');
 assert.equal(matterportLinkFromText('<iframe src="https://evil.example"></iframe>'),null);
 assert.equal(matterportLinkFromText('x'.repeat(100001)),null);
});
test('market action opens native full-screen dialog and provides a visible close control',()=>{
 const host=read('src/supabase/HostingHost.jsx'),dialog=read('src/supabase/HostDialog.jsx');
 assert.match(host,/onMap=\{\(\)=>setMarketFullscreen\(true\)\}/);
 assert.match(host,/<HostDialog[^>]*fullscreen/);
 assert.match(dialog,/dialog\.showModal\(\)/);assert.match(dialog,/aria-label="Close dialog"/);
 assert.match(read('src/supabase/host-workspace.css'),/\.oh-dialog\.oh-dialog-fullscreen\{[^}]*height:100dvh/);
});
test('ordinary member pages have separate headings and no shared workspace tab strip',()=>{
 const member=read('src/supabase/MemberWorkspace.jsx'),app=read('src/supabase/SupabaseApp.jsx');
 assert.doesNotMatch(member,/Member workspace<|visibleSections|role="tablist"/i);
 assert.match(member,/data-member-page=\{section\}/);assert.match(app,/<MemberWorkspace key=\{tab\}/);
 assert.match(app,/<NotificationCenter/);assert.match(read('src/supabase/OriginalShell.jsx'),/Invitations:'notifications'/);
});
test('notifications process both request types and refresh shared counts',()=>{
 const source=read('src/supabase/NotificationCenter.jsx');
 for(const term of ['respond_connection','respond_invitation','mark_notification_read','ccx-data-changed','member_notifications'])assert.ok(source.includes(term));
 assert.match(source,/\.eq\('invitee_id',user\.id\)/);
});
test('search uses cascading geography and shared expandable multi-select amenities',()=>{
 const source=read('src/supabase/HostingMarketplace.jsx');
 for(const term of ['state:region,country','amenities:selectedAmenities','ccx_property_filter_options','setRegion(\'\');setCity(\'\')','<PropertyAmenities'])assert.ok(source.includes(term),term);
 assert.match(read('src/supabase/PropertyAmenities.jsx'),/<details className="oh-amenity-panel"/);
});
test('profile fields are persisted privately and raw scan files are not advertised as playable',()=>{
 const profile=read('src/supabase/HostProfileSettings.jsx'),tour=read('src/supabase/PropertyVirtualTour.jsx');
 assert.match(profile,/from\('host_profiles'\)\.upsert/);assert.match(profile,/\.eq\('user_id',user\.id\)/);
 assert.match(tour,/Raw scan files need processing/);assert.match(tour,/allowFullScreen/);
 assert.match(tour,/src=\{saved\}/);assert.doesNotMatch(tour,/dangerouslySetInnerHTML/);
});
test('dashboard admission repair preserves live owner aggregates and factual badges',()=>{
 const sql=read('supabase/migrations/20261118002857_workspace_dashboard_host_profiles_and_amenity_catalog.sql');
 assert.match(sql,/onboarding_complete/);assert.match(sql,/onboarding_required/);
 assert.match(sql,/CREATE POLICY host_profiles_self_read/);assert.match(sql,/REVOKE ALL/);
 const dashboard=read('src/supabase/CustomDashboard.jsx');
 assert.match(dashboard,/ccx_dashboard_action/);assert.match(dashboard,/30000/);assert.doesNotMatch(dashboard,/if\(preview\|\|!userId\)/);
});
