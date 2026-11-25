import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {browserKeyIsUnsafe,assertSafeBrowserEnvironment} from '../src/api/browserKeySafety.mjs';
import {parseDate,parseEvents} from '../supabase/functions/hosting-calendar/calendarParser.mjs';
import {validJobBearer} from '../supabase/functions/_shared/jobAuth.mjs';
import {sanitizeMonitoringEvent} from '../src/supabase/monitoringPrivacy.mjs';
import {waitForActiveWorker} from '../src/supabase/pushLifecycle.mjs';
const read=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
const jwt=payload=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify(payload)).toString('base64url'),'signature'].join('.');
const feed=extra=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:booking-1\r\nDTSTART:20301117T120000Z\r\nDTEND:20301117T180000Z\r\n${extra}END:VEVENT\r\nEND:VCALENDAR\r\n`;

test('browser rejects legacy service/admin/member JWTs without logging them',()=>{
 for(const role of ['service_role','authenticated','supabase_admin'])assert.equal(browserKeyIsUnsafe(jwt({role})),true);
 assert.equal(browserKeyIsUnsafe(jwt({role:'anon'})),false);
 assert.equal(browserKeyIsUnsafe('sb_publishable_fixture'),false);
 assert.equal(browserKeyIsUnsafe('sb_secret_fixture'),true);
 assert.equal(browserKeyIsUnsafe('eyJ.bad.token'),true);
});
test('build guard checks unused alternate public env values before Vite embeds them',()=>{
 const privateKey=jwt({role:'service_role'});
 assert.throws(()=>assertSafeBrowserEnvironment({VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_SUPABASE_ANON_KEY:privateKey}),e=>!e.message.includes(privateKey));
 assert.doesNotThrow(()=>assertSafeBrowserEnvironment({SUPABASE_SERVICE_ROLE_KEY:privateKey,VITE_SUPABASE_ANON_KEY:jwt({role:'anon'})}));
});
test('calendar handles UTC and all-day venue-zone dates',()=>{
 assert.equal(parseDate('DTSTART:20301117T120000Z','America/Phoenix'),'2030-11-17T12:00:00.000Z');
 assert.equal(parseDate('DTSTART;VALUE=DATE:20301117','America/Phoenix'),'2030-11-17T07:00:00.000Z');
 assert.equal(parseEvents(feed(''),'',0).length,1);
});
test('calendar rejects impossible normalized dates and invalid times',()=>{
 for(const value of ['20300230T120000Z','20301301T120000Z','20300101T250000Z','20300101T126000Z'])assert.equal(parseDate('DTSTART:'+value,'UTC'),null);
 assert.equal(parseDate('DTSTART;TZID=America/New_York:20260308T023000','UTC'),null);
});
test('unsupported recurrence cannot erase prior calendar busy blocks',()=>{
 for(const line of ['RRULE:FREQ=WEEKLY','RDATE:20301201T120000Z','EXDATE:20301201T120000Z','RECURRENCE-ID:20301201T120000Z'])
  assert.throws(()=>parseEvents(feed(line+'\r\n'),'UTC',0),/existing blocks were kept/);
});
test('calendar incomplete feeds fail rather than clearing availability',()=>{
 assert.throws(()=>parseEvents('BEGIN:VCALENDAR\nBEGIN:VEVENT\n','UTC',0));
 assert.throws(()=>parseEvents(feed('').replace('DTEND:20301117T180000Z','DTEND:bad'),'UTC',0));
});
test('job bearer authentication requires a configured high-entropy credential',async()=>{
 const secret='x'.repeat(64);
 assert.equal(await validJobBearer('Bearer '+secret,secret),true);
 for(const h of [null,'','Bearer '+secret+'x','Bearer wrong','Basic '+secret])assert.equal(await validJobBearer(h,secret),false);
 assert.equal(await validJobBearer('Bearer short','short'),false);
});
test('calendar/worker gateway delegates only to internal authentication, not open access',()=>{
 const config=read('supabase/config.toml');
 for(const name of ['hosting-calendar','hosting-notification-worker'])assert.match(config,new RegExp('\\[functions\\.'+name+'\\]\\nverify_jwt = false'));
 assert.match(read('supabase/functions/hosting-calendar/index.ts'),/auth\.auth\.getUser\(\)/);
 assert.match(read('supabase/functions/hosting-calendar/index.ts'),/action==='cron_sync'&&!cron/);
 assert.match(read('supabase/functions/hosting-notification-worker/index.ts'),/validJobBearer/);
 for(const name of ['hosting-calendar','hosting-notification-worker'])assert.equal(read('supabase/functions/'+name+'/jobAuth.mjs'),read('supabase/functions/_shared/jobAuth.mjs'));
});
test('security headers are included for every nginx location that adds cache headers',()=>{
 const source=read('deploy/nginx.conf.template');
 for(const block of source.split(/\n    location /).slice(1))assert.match(block,/include \/etc\/nginx\/snippets\/security-headers\.conf/);
 assert.match(read('Dockerfile'),/COPY deploy\/security-headers.conf/);
 assert.match(read('deploy/security-headers.conf'),/frame-ancestors 'none'/);
});
test('monitoring uses an allowlist and drops sensitive messages/URLs/tags',()=>{
 const safe=sanitizeMonitoringEvent({message:'private body',user:{email:'private'},extra:{password:'private'},tags:{token:'private'},
  exception:{values:[{type:'Error',value:'private body',stacktrace:{frames:[{filename:'https://site.example/assets/app.js?token=private',vars:{secret:'private'}},{filename:'https://site.example/private/document'}]}}]}});
 assert.doesNotMatch(JSON.stringify(safe),/private|token=|email|password/);
 assert.equal(safe.exception.values[0].stacktrace.frames[0].filename,'/assets/app.js');
});
test('service worker waits for activation, rejects failure, and cannot hang indefinitely',async()=>{
 assert.equal((await waitForActiveWorker({active:{}},1)).active!=null,true);
 const worker=new EventTarget();worker.state='installing';const registration={installing:worker};
 const wait=waitForActiveWorker(registration,100);worker.state='activated';worker.dispatchEvent(new Event('statechange'));
 assert.equal(await wait,registration);
 const failed=new EventTarget();failed.state='redundant';await assert.rejects(waitForActiveWorker({installing:failed},10),/failed/);
 const stuck=new EventTarget();stuck.state='installing';await assert.rejects(waitForActiveWorker({installing:stuck},5),/too long/);
});
test('mark-all is one scoped backend mutation, not a loop over the first page',()=>{
 const ui=read('src/supabase/NotificationCenter.jsx'),edge=read('supabase/functions/member-workflows/index.ts');
 assert.match(ui,/action\('mark_all_notifications_read'\)/);assert.match(ui,/Promise\.allSettled/);
 const section=edge.split("case 'mark_all_notifications_read':")[1].split("case 'mark_notification_read':")[0];
 assert.match(section,/eq\('recipient_id',uid\)/);assert.match(section,/is\('read_at',null\)/);assert.match(section,/lte\('created_at',cutoff\)/);
});

// Whitelisting prevents push subscriptions from turning the worker into an SSRF proxy.
test('push URLs and keys are validated before registration and again before sending',async()=>{
 const {isSupportedPushEndpoint,validPushKeys}=await import('../supabase/functions/_shared/pushPolicy.mjs');
 for(const url of ['https://fcm.googleapis.com/fcm/send/fixture','https://updates.push.services.mozilla.com/wpush/v2/fixture','https://web.push.apple.com/fixture','https://wns.notify.windows.com/fixture'])assert.equal(isSupportedPushEndpoint(url),true,url);
 for(const url of ['https://127.0.0.1/private','https://169.254.169.254/latest','https://localhost/admin','https://fcm.googleapis.com.evil.invalid/send','https://user:pass@fcm.googleapis.com/send','https://fcm.googleapis.com:8080/send','https://evil.invalid/send'])assert.equal(isSupportedPushEndpoint(url),false,url);
 const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url'),secret=Buffer.alloc(16,1).toString('base64url');
 assert.equal(validPushKeys(key,secret),true);assert.equal(validPushKeys('invalid','invalid'),false);
 for(const name of ['hosting-operations','hosting-notification-worker'])assert.equal(read('supabase/functions/'+name+'/pushPolicy.mjs'),read('supabase/functions/_shared/pushPolicy.mjs'));
});

test('runtime and build configuration both reject legacy service JWT configuration',async()=>{
 const {resolveBrowserSupabaseConfig,CCX_SUPABASE_PUBLIC_URL}=await import('../src/api/publicSupabaseConfig.mjs');
 const result=resolveBrowserSupabaseConfig({VITE_SUPABASE_URL:CCX_SUPABASE_PUBLIC_URL,VITE_SUPABASE_ANON_KEY:jwt({role:'service_role'})});
 assert.equal(result.ready,false);assert.equal(result.key,null);
});

test('normal public URLs and dotted versions remain valid config',()=>{
 assert.doesNotThrow(()=>assertSafeBrowserEnvironment({VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SENTRY_DSN:'https://public@example.ingest.sentry.io/123',VITE_RELEASE_SHA:'1.2.3'}));
});

test('role previews cannot publish feed posts and repost media keeps its full-width layout',()=>{
 const dashboard=read('src/supabase/CustomDashboard.jsx');
 const feed=read('src/supabase/ConnectFeed.jsx');
 assert.match(dashboard,/<ConnectFeed[^>]*preview=\{preview\}/);
 assert.doesNotMatch(dashboard,/<ConnectFeed[^>]*preview=\{false\}/);
 assert.match(feed,/if\(posting\.current\|\|!paid\|\|preview\)return/); 
 assert.match(feed,/if\(busy\|\|preview\)return/); 
 assert.match(feed,/paid=\{paid&&!preview\} preview=\{preview\}/);
 assert.match(feed,/data-original-repost-media="true"/);
 assert.match(feed,/className="pb-0" data-original-repost-media/);
});

test('authenticated brands use separate central tokens and no recursive surface variable',()=>{
 const css=read('src/supabase/workspace-visual-system.css');
 assert.match(css,/--cc-action:#12698f/);
 assert.match(css,/--brand-host-action:#12698f/);
 assert.match(css,/--ccx-nav-panel-accent:#8fd3ef/);
 assert.doesNotMatch(css,/--cc-surface:var\(--cc-surface\)/);
 assert.match(css,/:root\[data-ccx-appearance="workspace"\]/);
});
test('venue selection checks available calendar and booking requests require review',()=>{
 const wizard=read('src/supabase/CollaborationCreationWizard.jsx');
 const host=read('src/supabase/HostingMarketplace.jsx');
 assert.match(wizard,/Search Host Connect properties/);
 assert.match(wizard,/hostConnectAction\('listing'/);
 assert.match(wizard,/venueConflict/);
 assert.match(host,/Review reservation request/);
 assert.match(host,/<HostDialog title="Review your reservation request"/);
 assert.match(host,/disabled=\{busy\|\|!acknowledged\}/);
 assert.match(host,/No deposit is charged at this stage/);
});

test('database-managed scheduler credentials do not require a manually entered Edge key',async()=>{
 const {validJobBearerWithVault}=await import('../supabase/functions/_shared/jobAuth.mjs');
 const token='v'.repeat(64);let calls=0;
 const db={rpc:async(name,args)=>{calls++;assert.equal(name,'ccx_hosting_job_authorized');assert.equal(args.p_job,'calendar');assert.match(args.p_hash,/^[a-f0-9]{64}$/);assert.notEqual(args.p_hash,token);return {data:true,error:null};}};
 assert.equal(await validJobBearerWithVault('Bearer '+token,undefined,db,'calendar'),true);
 assert.equal(await validJobBearerWithVault('Bearer short',undefined,db,'calendar'),false);
 assert.equal(await validJobBearerWithVault('Bearer '+token,undefined,db,'unrelated'),false);
 assert.equal(calls,1);
 for(const result of [{data:false,error:null},{data:{ok:true},error:null},{data:true,error:{message:'denied'}}])
   assert.equal(await validJobBearerWithVault('Bearer '+token,undefined,{rpc:async()=>result},'calendar'),false);
 assert.equal(await validJobBearerWithVault('Bearer '+token,undefined,{rpc:async()=>{throw Error('unavailable');}},'calendar'),false);
});
