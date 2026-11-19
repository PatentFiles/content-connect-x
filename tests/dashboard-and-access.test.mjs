import test from 'node:test';
import assert from 'node:assert/strict';
import {DASHBOARD_WIDGETS,PEOPLE_WIDGETS,defaultDashboardLayout,normalizeDashboardLayout,moveDashboardWidget,widgetsForRole} from '../src/supabase/dashboardWidgets.mjs';
import {accessReason} from '../src/supabase/moduleAccessPolicy.mjs';
import {compatibleEdgeFetch} from '../src/api/edgeTransport.mjs';
for(const role of ['creator','agent','studio','photographer','videographer','video_editor','host'])test(role+' new dashboard is empty without resetting an existing saved layout',()=>{
 assert.deepEqual(defaultDashboardLayout(role),[]);
 assert.deepEqual(normalizeDashboardLayout(null,role),[]);
 const layout=widgetsForRole(role).map(w=>({id:w.id,width:w.kind==='people'?'wide':'normal'}));
 assert.equal(new Set(layout.map(w=>w.id)).size,layout.length);
 assert.deepEqual(normalizeDashboardLayout(layout,role),layout);
});
test('empty user layouts stay empty and malicious/duplicate/other-role widgets are removed',()=>{
 assert.deepEqual(normalizeDashboardLayout([],'creator'),[]);
 assert.deepEqual(normalizeDashboardLayout([{id:'favorites',width:'wide',sql:'BAD'},{id:'favorites'},{id:'roster'},{id:'<script>'}],'creator'),[{id:'favorites',width:'wide'}]);
 assert.equal(DASHBOARD_WIDGETS.length,21);assert.equal(PEOPLE_WIDGETS.length,6);
 assert.deepEqual(PEOPLE_WIDGETS.map(w=>w.id),['featured_professionals','featured_creators','featured_videographers','featured_photographers','featured_editors','creators_near_me']);
});
test('reordering is bounded and does not mutate the saved layout',()=>{
 const a=[{id:'favorites',width:'normal'},{id:'connections',width:'normal'}];
 assert.equal(moveDashboardWidget(a,'favorites',-1),a);
 assert.deepEqual(moveDashboardWidget(a,'favorites',1).map(x=>x.id),['connections','favorites']);
 assert.equal(moveDashboardWidget(a,'favorites',99),a);
 assert.equal(a[0].id,'favorites');
});
test('authorization and load failures are never mislabeled disabled',()=>{
 assert.equal(accessReason('roster',null),'loading');assert.equal(accessReason('roster',{}),'unavailable');
 for(const reason of ['onboarding_required','membership_required','role_required','disabled','rollout_excluded','restricted'])assert.equal(accessReason('roster',{roster:true,__ccxLoaded:true,__ccxAccess:{roster:{reason,eligible:false}}}),reason);
 assert.equal(accessReason('roster',{roster:true,__ccxLoaded:true,__ccxAccess:{roster:{reason:'ready',eligible:true}}}),'ready');
 assert.equal(accessReason('account-security',{}),'ready');
});
test('Edge compatibility retains security headers while removing only SDK telemetry',async()=>{
 let called;const fetcher=compatibleEdgeFetch('https://example.supabase.co',async(i,o)=>{called={i,o};return new Response('{}');});
 await fetcher('https://example.supabase.co/functions/v1/member-workflows',{method:'POST',headers:{authorization:'Bearer fixture',apikey:'public-fixture','content-type':'application/json','x-client-info':'sdk','x-supabase-client-platform':'web','x-job-token':'must-retain'},body:'{}'});
 const h=called.o.headers;assert.equal(h.get('authorization'),'Bearer fixture');assert.equal(h.get('apikey'),'public-fixture');assert.equal(h.get('x-job-token'),'must-retain');assert.equal(h.get('x-client-info'),null);assert.equal(h.get('x-supabase-client-platform'),null);
 const options={headers:{'x-client-info':'unchanged'}};
 await fetcher('https://example.supabase.co/rest/v1/member_profiles',options);assert.equal(called.o,options);
 await fetcher('https://other.supabase.co/functions/v1/x',options);assert.equal(called.o,options);
});
