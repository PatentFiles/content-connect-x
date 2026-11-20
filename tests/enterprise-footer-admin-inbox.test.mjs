import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRUST_LINKS,TRUST_PAGES} from '../src/supabase/trustContent.mjs';
import {validateTrustReply} from '../supabase/functions/trust-intake/policy.mjs';
import {createTrustIntakeHandler} from '../supabase/functions/trust-intake/handler.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const reference='10000000-0000-4000-8000-000000000001';
const code='20000000-0000-4000-8000-000000000002';
const idempotency_key='30000000-0000-4000-8000-000000000003';
const http=body=>new Request('https://fixture.invalid/functions/v1/trust-intake',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});

test('workspace footer aligns brand, links and request information to center on desktop and mobile',()=>{
 const css=read('src/supabase/trust-site.css');
 assert.match(css,/\.ccx-trust-footer\s*\{\s*text-align:center/i);
 assert.match(css,/\.ccx-trust-footer-top\s*\{[\s\S]*?align-items:center/i);
 assert.match(css,/\.ccx-trust-footer nav\s*\{[\s\S]*?justify-content:center/i);
 assert.match(css,/\.ccx-trust-footer-bottom\s*\{[\s\S]*?align-items:center/i);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.ccx-trust-footer nav\{justify-content:center/);
});

test('view public profile uses the account owner preview and not Discovery',()=>{
 const shell=read('src/supabase/OriginalShell.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const directory=read('supabase/functions/directory/index.ts');
 assert.match(shell,/View Public Profile/);
 assert.match(shell,/onClick=\{\(\)=>onNavigate\('public-profile'\)\}/);
 assert.doesNotMatch(shell,/onClick=\{\(\)=>onNavigate\('directory'\)\}[^\n]*View Public Profile/);
 assert.match(app,/tab==='public-profile'&&approved&&<MemberPublicProfile/);
 assert.match(directory,/body\?\.action==='my_public_profile'/);
 assert.match(directory,/\.eq\('id',user\.id\)/);
 assert.match(directory,/show_orientation_in_discovery/);
 assert.match(directory,/safeProfileAvatarPath\(user\.id,p\.avatar_path\)/);
 assert.doesNotMatch(read('src/supabase/MemberPublicProfile.jsx'),/real_name|document_path|medical/i);
});

test('every informational footer page has an actual support request intake path',()=>{
 const trust=read('src/supabase/TrustSite.jsx');
 const paths=new Set(TRUST_LINKS.map(([slug])=>slug));
 assert.ok(paths.has('affiliates')&&paths.has('content-removal')&&paths.has('billing'));
 for(const [slug] of TRUST_LINKS)if(!['cookies'].includes(slug))assert.ok(TRUST_PAGES[slug],slug);
 assert.match(trust,/TRUST_PAGES\[active\].*\?['"]support['"]/);
 assert.match(trust,/page&&!\['cookies','review'\]\.includes\(slug\)\?['"]support['"]/);
 assert.match(trust,/originSlug=\{slug\}/);
 assert.match(trust,/functions\.invoke\('trust-intake'/);
});

test('admin messages and bell notifications deep-link to private case inbox',()=>{
 const ui=read('src/supabase/AdminTrustInbox.jsx');
 const workspace=read('src/supabase/MemberWorkspace.jsx');
 const bell=read('src/supabase/NotificationCenter.jsx');
 const shell=read('src/supabase/OriginalShell.jsx');
 assert.match(workspace,/workspace\.isAdmin&&adminMessagesView==='requests'&&<AdminTrustInbox/);
 assert.match(ui,/ccx_trust_triage/);
 assert.match(ui,/ccx_trust_review/);
 assert.match(ui,/ccx_trust_staff_reply/);
 assert.match(ui,/ccx_trust_staff_thread/);
 assert.match(bell,/kind==='trust_case'\|\|kind==='trust_case_followup'/);
 assert.match(bell,/supportCaseId:item\.details\.case_id/);
 assert.match(shell,/member_notifications/);
 assert.match(shell,/header-notifications-/);
});

test('private staff and reporter messages use MFA, private capability, dedupe and notifications',()=>{
 const sql=read('supabase/migrations/20261120141000_trust_request_conversations_and_admin_replies.sql');
 assert.match(sql,/ccx_trust_messages.*row level security/i);
 assert.match(sql,/ccx_trust_staff_reply/);
 assert.match(sql,/auth\.jwt\(\)->>'aal'/);
 assert.match(sql,/assigned_reviewer_id/);
 assert.match(sql,/ccx_trust_reporter_reply/);
 assert.match(sql,/idempotency_key/);
 assert.match(sql,/ccx_trust_reporter_message_notify/);
 assert.match(sql,/member_notifications/);
 assert.match(sql,/revoke all on table public\.ccx_trust_messages from public,anon,authenticated/);
});

test('anonymous follow-up only works with both capability fields; responses sanitize private staff values',async()=>{
 const request={action:'reply',reference,access_code:code,idempotency_key,message:'Can you send an update?'};
 assert.equal(validateTrustReply(request).reference,reference);
 for(const change of [{access_code:'bad'},{reference:'bad'},{idempotency_key:'bad'},{message:'x'}])
  assert.throws(()=>validateTrustReply({...request,...change}));
 const handler=createTrustIntakeHandler({
  rateKey:async()=> 'a'.repeat(64),
  submit:async()=>{throw Error('not called');},
  reply:async()=>({data:{verified:true,sent:true,id:idempotency_key,private_email:'do not disclose'}}),
  status:async()=>({data:{verified:true,status:'reviewing',created_at:'2026-11-20T10:00:00Z',
   assigned_reviewer_id:'private',resolution_note:'staff only',payload:{secret:'private'},
   messages:[{id:idempotency_key,author:'staff',body:'We received your request.',created_at:'2026-11-20T11:00:00Z',staff_id:'secret'}]}})
 });
 const result=await handler(http(request));
 assert.equal(result.status,201);
 assert.deepEqual(await result.json(),{sent:true,id:idempotency_key});
 const status=await handler(http({action:'status',reference,access_code:code}));
 assert.equal(status.status,200);
 const response=await status.json();
 assert.deepEqual(response.messages,[{id:idempotency_key,author:'staff',body:'We received your request.',created_at:'2026-11-20T11:00:00Z'}]);
 assert.ok(!JSON.stringify(response).includes('private'));
 assert.ok(!JSON.stringify(response).includes('secret'));
});
