import test from 'node:test';
import assert from 'node:assert/strict';
import {DASHBOARD_ROLES,DASHBOARD_WIDGETS,defaultDashboardLayout,normalizeDashboardLayout,moveDashboardWidget,widgetsForRole} from '../src/supabase/dashboardCatalog.mjs';
import {moduleAccessState} from '../src/supabase/moduleAccessPolicy.mjs';
import {functionErrorMessage} from '../src/supabase/apiErrors.mjs';

test('six roles have metrics, not a duplicate of every navigation destination',()=>{
 for(const role of DASHBOARD_ROLES){const layout=defaultDashboardLayout(role);assert.ok(layout.some(item=>item.id==='unread_messages'));assert.ok(layout.every(item=>widgetsForRole(role).some(widget=>widget.id===item.id)));assert.ok(layout.length<10);}
 assert.equal(new Set(DASHBOARD_WIDGETS.map(item=>item.id)).size,DASHBOARD_WIDGETS.length);
 assert.ok(defaultDashboardLayout('agent').some(item=>item.id==='roster'));
 assert.ok(defaultDashboardLayout('photographer').some(item=>item.id==='portfolio'));
});
test('layouts preserve intentional emptiness, reject duplicate/unknown/other-role widgets and sanitize size',()=>{
 assert.deepEqual(normalizeDashboardLayout([],'creator'),[]);
 assert.deepEqual(normalizeDashboardLayout([{id:'favorites',width:'wide'},{id:'favorites'},{id:'roster'},{id:'evil'}],'creator'),[{id:'favorites',width:'wide'}]);
 assert.deepEqual(normalizeDashboardLayout([{id:'account',width:'giant'}],'creator'),[{id:'account',width:'normal'}]);
});
test('reordering is immutable and bounded',()=>{
 const layout=[{id:'favorites',width:'normal'},{id:'account',width:'wide'}];
 assert.equal(moveDashboardWidget(layout,'account',-1)[0].id,'account');assert.equal(layout[0].id,'favorites');
 assert.deepEqual(moveDashboardWidget(layout,'favorites',-1),layout);
});
test('loading and network failure are not disabled features',()=>{
 assert.equal(moduleAccessState('messages',{status:'loading'}).code,'loading');
 assert.equal(moduleAccessState('messages',{status:'error',error:'Offline'}).code,'unavailable');
 assert.equal(moduleAccessState('messages',{status:'ready',flags:{},verified:true}).code,'unavailable');
 assert.equal(moduleAccessState('messages',{status:'ready',flags:{messages:false},verified:true}).code,'disabled');
});
test('enabled modules retain real verification, role and membership prerequisites',()=>{
 for(const reason of ['verification_required','membership_required','role_required','mfa_required','rollout_excluded','restricted']){
  assert.equal(moduleAccessState('messages',{status:'ready',flags:{messages:true},access:{messages:{reason}},verified:true}).code,reason);
 }
 assert.equal(moduleAccessState('messages',{status:'ready',flags:{messages:true},verified:false}).code,'verification_required');
 assert.equal(moduleAccessState('messages',{status:'ready',flags:{messages:true},verified:true}).code,'ready');
 for(const tab of ['dashboard','profile','verification','settings','account-security'])assert.equal(moduleAccessState(tab).code,'ready');
});
test('backend explanations survive generic SDK errors without consuming the response',async()=>{
 const response=new Response(JSON.stringify({error:'Administrator MFA required'}),{status:403});
 assert.equal(await functionErrorMessage({context:response,message:'Edge Function returned a non-2xx status code'},null),'Administrator MFA required');
 assert.equal(response.bodyUsed,false);
 assert.match(await functionErrorMessage({context:new Response('',{status:503})},null),/not been turned off/);
});
