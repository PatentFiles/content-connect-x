/** Real law Edge handler with synthetic Supabase and identities.
 * Exercises request authorization, expiry, scope, revocation and exports.
 * This does NOT replace separate authenticated staging acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const officer='10000000-0000-4000-8000-000000000001';
const secondOfficer='10000000-0000-4000-8000-000000000002';
const admin='20000000-0000-4000-8000-000000000001';
const member='30000000-0000-4000-8000-000000000001';
const subject='40000000-0000-4000-8000-000000000001';
const caseId='50000000-0000-4000-8000-000000000001';
let state,handler,failAudit=false;
const claims=(id,aal='aal2')=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal,exp:Math.floor(Date.now()/1000)+600})).toString('base64url'),'signature'].join('.');
function reset(){
 failAudit=false;
 state={
  account_security:[...[
   [officer,false],[secondOfficer,false],[admin,true],[member,false],[subject,false]
  ].map(([user_id,admin])=>({user_id,admin,banned:false,suspended:false}))],
  ccx_law_officers:[officer,secondOfficer].map(user_id=>({user_id,agency:'Verified fixture agency',jurisdiction:'Test',enabled:true,disabled_at:null})),
  ccx_law_cases:[],ccx_law_disclosure_audit:[],ccx_law_holds:[],
  member_profiles:[{id:subject,display_name:'=HYPERLINK("https://fixture.invalid")',stage_name:'Professional',
   role_type:'creator',real_name:'DO-NOT-DISCLOSE',created_at:'2026-11-20T12:00:00Z'}],
  member_admissions:[{id:caseId,user_id:subject,admitted_at:'2026-11-20T12:00:00Z',source:'verified',created_at:'2026-11-20T12:00:00Z'}],
  platform_action_audit:[],ccx_trust_requests:[],collaboration_members:[],collaborations:[]
 };
}
class Query{
 constructor(table){this.table=table;this.conditions=[];this.singleRow=false;this.op='read';this.payload=null;this.fields='*';this.max=Infinity;}
 select(fields='*'){this.fields=fields;return this;}
 eq(k,v){this.conditions.push(row=>row[k]===v);return this;}
 in(k,values){this.conditions.push(row=>values.includes(row[k]));return this;}
 is(k,v){this.conditions.push(row=>row[k]===v);return this;}
 order(){return this;}
 limit(count){this.max=count;return this;}
 maybeSingle(){this.singleRow=true;return this;}
 single(){this.singleRow=true;return this;}
 insert(data){this.op='insert';this.payload=data;return this;}
 update(data){this.op='update';this.payload=data;return this;}
 then(resolve){
  if(this.table==='ccx_law_disclosure_audit'&&failAudit&&this.op==='insert')
   return resolve({data:null,error:{message:'audit fixture error'}});
  const src=state[this.table]??[];
  let items=src.filter(row=>this.conditions.every(fn=>fn(row))).slice(0,this.max);
  if(this.op==='insert'){
   const input={...this.payload};
   if(this.table==='ccx_law_cases')Object.assign(input,{id:caseId,status:'pending',approved_scopes:[],requested_at:new Date().toISOString(),...this.payload});
   src.push(input);state[this.table]=src;items=[input];
  }else if(this.op==='update')items.forEach(row=>Object.assign(row,this.payload));
  if(this.fields!=='*')items=items.map(row=>Object.fromEntries(this.fields.split(',').map(k=>k.trim()).filter(k=>k in row).map(k=>[k,row[k]])));
  resolve({data:this.singleRow?(items[0]||null):items,error:null});
 }
}
globalThis.__lawClient=(_url,key,options={})=>key==='fixture-public'?{
 auth:{getUser:async()=>{
  const bearer=options.global?.headers?.Authorization||'';
  const token=bearer.split(' ')[1];
  if(!token)return {data:{user:null},error:{message:'unauthorized'}};
  try{const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
   return {data:{user:{id:payload.sub}},error:null};
  }catch{return {data:{user:null},error:{message:'invalid'}};}
 }}
}:{
 from:table=>new Query(table),
 auth:{admin:{inviteUserByEmail:async()=>({data:{user:{id:secondOfficer}},error:null})}},
 rpc:async()=>({data:{},error:null})
};
globalThis.Deno={env:{get:key=>({
 SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private'
})[key]},serve:fn=>{handler=fn;}};
const js=(await build({
 entryPoints:['supabase/functions/ccx-law-portal/index.ts'],bundle:true,write:false,
 platform:'node',format:'esm',logLevel:'silent',
 plugins:[{name:'law-runtime-fixtures',setup(build){
  build.onResolve({filter:/^npm:@supabase\/supabase-js/},()=>({path:'supabase',namespace:'fixture'}));
  build.onResolve({filter:/pdfReport\.mjs$/},()=>({path:'pdf',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({
   contents:args.path==='supabase'?'export const createClient=globalThis.__lawClient;':
    'export const makeCasePdf=async()=>new TextEncoder().encode("%PDF-1.7 fixture");',
   loader:'js'
  }));
 }}]
})).outputFiles[0].text;
reset();await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#law-runtime');
async function call(as,action,other={},aal='aal2'){
 const token=as?claims(as,aal):'';
 const response=await handler(new Request('https://fixture.invalid',{
  method:'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},
  body:JSON.stringify({action,...other})
 }));
 const contentType=response.headers.get('content-type')||'';
 const body=contentType.includes('json')?await response.json():await response.text();
 return {status:response.status,headers:response.headers,body};
}
function approved(scopes=['profile','admission']){
 state.ccx_law_cases=[{
  id:caseId,officer_id:officer,subject_user_id:subject,agency_case_number:'CASE-FIXTURE',
  status:'approved',approved_scopes:scopes,requested_scopes:scopes,
  expires_at:'2099-01-01T00:00:00Z'
 }];
}
test('ordinary members and unauthenticated visitors cannot list officer cases or disclose records',async()=>{
 reset();approved();
 assert.equal((await call(null,'view',{case_id:caseId})).status,401);
 assert.notEqual((await call(member,'view',{case_id:caseId})).status,200);
 assert.notEqual((await call(member,'admin_cases')).status,200);
 assert.equal(state.ccx_law_disclosure_audit.length,0);
});
test('officer with only password auth cannot request cases or read a disclosure',async()=>{
 reset();approved();
 const role=await call(officer,'role_status',{},'aal1');
 assert.equal(role.body.officer,true);assert.equal(role.body.requires_mfa,true);
 assert.notEqual((await call(officer,'view',{case_id:caseId},'aal1')).status,200);
 assert.notEqual((await call(officer,'request_case',{},'aal1')).status,201);
});
test('missing security record, suspended identity and role overlap all fail closed',async()=>{
 reset();approved();
 state.account_security=state.account_security.filter(row=>row.user_id!==officer);
 assert.equal((await call(officer,'role_status')).body.officer,false);
 assert.notEqual((await call(officer,'view',{case_id:caseId})).status,200);
 reset();approved();state.account_security.find(x=>x.user_id===officer).suspended=true;
 assert.equal((await call(officer,'role_status')).body.officer,false);
 reset();approved();state.account_security.find(x=>x.user_id===officer).admin=true;
 assert.equal((await call(officer,'role_status')).body.officer,false);
});
test('an approved case is owned by a single officer and bounded by scopes and expiry',async()=>{
 reset();approved(['profile']);assert.equal((await call(secondOfficer,'view',{case_id:caseId})).status,403);
 const viewed=await call(officer,'view',{case_id:caseId});assert.equal(viewed.status,200);
 assert.deepEqual(Object.keys(viewed.body.data),['profile']);
 assert.equal(viewed.body.data.profile[0].display_name,'=HYPERLINK("https://fixture.invalid")');
 assert.ok(!JSON.stringify(viewed.body).includes('DO-NOT-DISCLOSE'));
 assert.equal(state.ccx_law_disclosure_audit.filter(x=>x.action==='viewed').length,1);
 state.ccx_law_cases[0].expires_at='2020-01-01T00:00:00Z';
 assert.equal((await call(officer,'view',{case_id:caseId})).status,403);
});
test('CSV neutralizes injection, PDF has attachment type, and each export is separately audited',async()=>{
 reset();approved();
 const csv=await call(officer,'export_csv',{case_id:caseId});assert.equal(csv.status,200);
 assert.match(csv.headers.get('content-type'),/text\/csv/);
 assert.match(csv.body,/'=HYPERLINK/);
 const pdf=await call(officer,'export_pdf',{case_id:caseId});assert.equal(pdf.status,200);
 assert.match(pdf.headers.get('content-type'),/application\/pdf/);
 assert.equal(state.ccx_law_disclosure_audit.filter(x=>['csv_export','pdf_export'].includes(x.action)).length,2);
});
test('no read or export is released when disclosure audit is unavailable',async()=>{
 reset();approved();failAudit=true;
 assert.notEqual((await call(officer,'view',{case_id:caseId})).status,200);
 assert.notEqual((await call(officer,'export_csv',{case_id:caseId})).status,200);
});
test('administrators need AAL2, may only approve requested scope once and can revoke access',async()=>{
 reset();state.ccx_law_cases=[{
  id:caseId,officer_id:officer,subject_user_id:subject,agency_case_number:'CASE-FIXTURE',
  legal_process_type:'warrant',status:'pending',requested_scopes:['profile'],approved_scopes:[]
 }];
 const args={case_id:caseId,decision:'approve',review_note:'Fixture authorization independently verified',approved_scopes:['profile'],authorized_process_confirmed:true};
 assert.notEqual((await call(admin,'admin_decide',args,'aal1')).status,200);
 assert.equal((await call(admin,'admin_decide',{...args,approved_scopes:['admission']})).status,400);
 assert.equal((await call(admin,'admin_decide',args)).status,200);
 assert.equal((await call(officer,'view',{case_id:caseId})).status,200);
 assert.equal((await call(admin,'admin_decide',args)).status,409,'Cannot extend an approved case');
 assert.equal((await call(admin,'admin_decide',{case_id:caseId,decision:'revoke',review_note:'Fixture legal process withdrawn'})).status,200);
 assert.equal((await call(officer,'view',{case_id:caseId})).status,403);
 assert.equal(state.ccx_law_disclosure_audit.some(x=>x.action==='case_revoked'),true);
});
test('MFA officer can submit an exact subject case, but pending case releases no records',async()=>{
 reset();
 const request=await call(officer,'request_case',{
  subject_user_id:subject,agency_case_number:'CASE-FIXTURE',legal_process_type:'warrant',
  legal_basis:'Synthetic warrant metadata for a fictional test account only.',
  evidence_reference:'fictional-reference-2026',requested_scopes:['profile']
 });
 assert.equal(request.status,201);
 assert.equal((await call(officer,'view',{case_id:caseId})).status,403);
 assert.equal(state.ccx_law_disclosure_audit.some(x=>x.action==='case_requested'),true);
});
