import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {optedIn,safeSender,retryAfter,resendRequest} from '../supabase/functions/ccx-email-worker/deliveryPolicy.mjs';
import {verifiedSentryDsn} from '../supabase/functions/ccx-integrations/sentryDsnPolicy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='10000000-0000-4000-8000-000000000001';

test('transactional email requires deliberate opt-in and respects topic preferences',()=>{
 const sec={banned:false,suspended:false};
 assert.equal(optedIn(null,sec,'message'),false);
 assert.equal(optedIn({transactional_email:false},sec,'message'),false);
 assert.equal(optedIn({transactional_email:true,message_alerts:false},sec,'message'),false);
 assert.equal(optedIn({transactional_email:true,booking_reminders:false},sec,'booking_reminder'),false);
 assert.equal(optedIn({transactional_email:true,message_alerts:true},sec,'message'),true);
 assert.equal(optedIn({transactional_email:true}, {...sec,banned:true},'trust_case'),false);
 assert.equal(optedIn({transactional_email:true},null,'meeting_invitation'),false);
});

test('email delivery sends only generic private-account notices with stable retries',()=>{
 assert.equal(safeSender('CCX Support <updates@example.com>'),'CCX Support <updates@example.com>');
 assert.equal(safeSender('From\r\nBCC: victim@example.com'),null);
 assert.equal(safeSender('https://other.example.com'),null);
 assert.equal(retryAfter(1),90);
 assert.equal(retryAfter(9),11520);
 const msg=resendRequest(id,'CCX <updates@example.com>','test@recipient.example');
 assert.match(msg.subject,/private Content Connect X notification/i);
 assert.match(msg.text,/Notifications/);
 assert.doesNotMatch(JSON.stringify(msg),/medical|testing|ID document|agreement details|recording/);
 assert.throws(()=>resendRequest(id,'Sender\nBcc: bad','test@example.com'));
});

test('Sentry only exposes official ingestion DSNs and strips browser event contents',()=>{
 assert.equal(verifiedSentryDsn('https://public123@o450.ingest.sentry.io/123456'),'https://public123@o450.ingest.sentry.io/123456');
 assert.equal(verifiedSentryDsn('https://public123@o450.ingest.us.sentry.io/123456'),'https://public123@o450.ingest.us.sentry.io/123456');
 assert.equal(verifiedSentryDsn('https://foo@evil.example.com/123'),null);
 assert.equal(verifiedSentryDsn('http://public@o450.ingest.sentry.io/123'),null);
 const monitor=read('src/supabase/integrations.js');
 const scrub=read('src/supabase/monitoringPrivacy.mjs');
 assert.match(monitor,/consent\.diagnostics/);
 assert.match(monitor,/monitoring_config/);
 assert.match(monitor,/beforeSend:sanitizeMonitoringEvent/);
 assert.match(monitor,/tracesSampleRate:0/);
 assert.match(scrub,/value:'Application error'/);
 assert.doesNotMatch(monitor,/replaysSessionSampleRate:\s*0\.[1-9]/);
});

test('durable queue and service-only RPCs are included in schema and worker',()=>{
 const sql=read('supabase/migrations/20261120220000_durable_member_email_queue.sql');
 const schedule=read('supabase/migrations/20261120220500_email_queue_worker_schedule.sql');
 const worker=read('supabase/functions/ccx-email-worker/index.ts');
 for(const statement of [
  "CREATE EXTENSION IF NOT EXISTS pgmq",
  "pgmq.create('ccx_member_email')",
  "ccx_queue_member_email",
  "ccx_email_claim",
  "ccx_email_finish",
  "pgmq.set_vt",
  "pgmq.archive",
  "REVOKE ALL ON public.ccx_email_delivery",
  "GRANT EXECUTE ON FUNCTION public.ccx_email_claim(integer) TO service_role"
 ])assert.ok(sql.includes(statement),statement);
 assert.match(schedule,/ccx_runtime_ccx_email_worker_key/);
 assert.match(schedule,/ccx_email_delivery_every_two_minutes/);
 assert.match(worker,/ccx_secret_get/);
 assert.match(worker,/ccx_email_claim/);
 assert.match(worker,/ccx_email_finish/);
 assert.match(worker,/Idempotency-Key/);
 assert.match(worker,/integration\?\.enabled!==true/);
 assert.match(worker,/\^\[a-f0-9\]\{128\}\$/);
 assert.doesNotMatch(worker,/console\.log\([^)]*email/);
});

test('notification opt-in is editable in both member and host preferences',()=>{
 const files=['src/supabase/MemberSettings.jsx','src/supabase/HostingNotificationSettings.jsx','supabase/functions/production-manager/index.ts'];
 for(const file of files)assert.match(read(file),/transactional_email/,file);
 const backend=read('supabase/functions/production-manager/index.ts');
 assert.match(backend,/typeof body\.transactional_email!=='boolean'/);
 const admin=read('supabase/functions/ccx-integrations/index.ts');
 assert.match(admin,/getAuthenticatorAssuranceLevel/);
 assert.match(admin,/admin_provider_settings/);
 assert.match(admin,/monitoring_config/);
});
