import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('OpenAI tools read one protected key, never a browser environment value',()=>{
 const suite=read('supabase/functions/collab-suite/index.ts');
 const bio=read('supabase/functions/profile-ai/index.ts');
 const worker=read('supabase/functions/ai-agent-worker/index.ts');
 const settings=read('src/supabase/AIAgentAdmin.jsx');
 assert.match(suite,/OPENAI_API_KEY/);
 assert.match(suite,/ccx_secret_get.*openai_api_key/);
 assert.match(bio,/ccx_secret_get.*openai_api_key/);
 assert.match(worker,/ccx_secret_get|keyFromVault/);
 assert.match(settings,/ai_key_save/);
 for(const file of ['src/supabase/GroupVideoCall.jsx','src/supabase/AIMatchSuggestions.jsx','src/supabase/CreatorProfileEditorBase.jsx'])
  assert.doesNotMatch(read(file),/VITE_OPENAI_API_KEY|import\.meta\.env\.OPENAI_API_KEY/);
});

test('message-first friendship and private introductions are server-side',()=>{
 const sql=read('supabase/migrations/20261120071500_ccx_enforce_message_first_connection.sql');
 const api=read('supabase/functions/collab-suite/index.ts');
 const notifications=read('src/supabase/NotificationCenter.jsx');
 assert.match(sql,/ccx_enforce_message_first_friendship/);
 assert.match(sql,/inbound and outbound/);
 assert.match(api,/case 'intro_send'/);
 assert.match(api,/kind:'introduction'/);
 assert.match(notifications,/kind==='introduction'/);
});

test('recording requires consent, informs the whole call, and transcribes audio automatically',()=>{
 const backend=read('supabase/functions/collab-suite/index.ts');
 const front=read('src/supabase/GroupVideoCall.jsx');
 const sql=read('supabase/migrations/20261120133000_collab_video_recording_presence_signals.sql');
 assert.match(backend,/kind==='recording_start'[\s\S]*checkRecordingConsent/);
 assert.match(backend,/case 'recording_ticket'[\s\S]*checkRecordingConsent/);
 assert.match(front,/await post\('recording_start'\)/);
 assert.match(front,/post\('recording_stop'\)/);
 assert.match(front,/Recording active:/);
 assert.match(front,/suiteAction\('transcribe_recording'/);
 assert.match(sql,/recording_start.*recording_stop/);
});

test('automatic safety scan requires a private job key and stores human-review flags',async()=>{
 const worker=read('supabase/functions/ai-agent-worker/index.ts');
 const job=read('supabase/migrations/20261120134500_scheduled_private_ai_safety_scans.sql');
 assert.match(job,/ccx_ai_safety_weekly/);
 assert.match(job,/ai_agent_cron_key/);
 assert.doesNotMatch(job,/'X-CCX-CRON-KEY',\s*'[a-f0-9]{64}'/);
 assert.match(worker,/constantTime/);
 assert.match(worker,/ccx_ai_agent_runs/);
 assert.match(worker,/ccx_ai_risk_predictions/);
 assert.match(worker,/ccx_ai_agent_flags/);
 assert.match(worker,/member_notifications/);
 const js=buildSync({entryPoints:['supabase/functions/ai-agent-worker/index.ts'],bundle:true,
  write:false,platform:'node',format:'esm',external:['npm:*'],logLevel:'silent'}).outputFiles[0].text
  .replace(/import\s*\{\s*createClient\s*\}\s*from\s*["']npm:@supabase\/supabase-js[^"']*["'];?/,
   'const createClient=globalThis.__aiWorkerClient;');
 let handler=null;
 globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'fake-but-private'}[name]||'')},serve:fn=>{handler=fn;}};
 globalThis.__aiWorkerClient=()=>({rpc:async(_name,args)=>({data:args?.p_name==='ai_agent_cron_key'?'a'.repeat(64):null,error:null})});
 await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#ai-worker-auth-fixture');
 assert.equal(typeof handler,'function');
 const send=async key=>{
  const req=new Request('https://fixture.invalid',{method:'POST',
   headers:{'Content-Type':'application/json','x-ccx-cron-key':key},
   body:JSON.stringify({action:'safety_scan'})});
  const response=await handler(req);return {status:response.status,body:await response.json()};
 };
 assert.equal((await send('b'.repeat(64))).status,401);
 const allowed=await send('a'.repeat(64));
 assert.equal(allowed.status,200);
 assert.equal(allowed.body.skipped,true,'Missing OpenAI key must not create a fabricated run');
});

test('gallery image reports reach a real privacy form with media reference',()=>{
 const gallery=read('src/supabase/MediaGalleryBase.jsx');
 const trust=read('src/supabase/TrustSite.jsx');
 assert.match(gallery,/\/trust\/privacy\?locator=/);
 assert.match(trust,/URLSearchParams\(window\.location\.search\)\.get\('locator'\)/);
});
