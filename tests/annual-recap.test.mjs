import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RECAP_ROLES,RECAP_METRICS,normalizeRecap,recapAchievements,recapShareText,safePdfText} from '../supabase/functions/annual-recap/recapPolicy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sample=(role='creator',metrics={})=>({report_year:2026,role_type:role,metrics});
test('all six roles receive exactly the same invariant metrics contract',()=>{
 assert.deepEqual(Object.keys(RECAP_ROLES).sort(),
  ['agent','creator','photographer','studio','video_editor','videographer']);
 for(const role of Object.keys(RECAP_ROLES)){
  const record=normalizeRecap(sample(role));
  assert.equal(record.role,role);
  assert.equal(Object.keys(record.metrics).length,8);
  for(const metric of RECAP_METRICS)assert.equal(record.metrics[metric.key],0);
  assert.equal(recapAchievements(sample(role)).length,0,'Do not invent achievements for zero activity');
 }
});
test('invalid snapshots and unsafe metrics fail closed or normalize safely',()=>{
 assert.throws(()=>normalizeRecap(sample('law_enforcement')));
 assert.throws(()=>normalizeRecap({...sample(),report_year:2025}));
 assert.throws(()=>normalizeRecap({...sample(),report_year:2201}));
 assert.deepEqual(normalizeRecap(sample('studio',{collaborations:-5,new_friends:'bad',
  published_posts:2.5,shared_trips:1e20})).metrics.collaborations,0);
 const record=normalizeRecap(sample('photographer',{collaborations:4,new_friends:3,featured_portfolio_items:5}));
 assert.equal(record.metrics.collaborations,4);
 assert.equal(record.metrics.new_friends,3);
 assert.equal(record.metrics.featured_portfolio_items,5);
});
test('share card includes only aggregate metrics and no private identity, health or messages',()=>{
 const fixture={...sample('agent',{collaborations:12,new_friends:7,published_posts:22,featured_portfolio_items:2}),
  id:'10000000-0000-4000-8000-000000000001',
  email:'confidential@private.invalid',real_name:'PRIVATE LEGAL NAME',
  private_messages:'DO NOT DISCLOSE',health_records:'PRIVATE RECORDS'};
 const body=recapShareText(fixture);
 assert.match(body,/2026 Content Connect X Year in Review/);
 for(const text of ['12 collaborations','7 new friends','22 published posts','2 featured portfolio'])
  assert.ok(body.includes(text),text);
 for(const text of [fixture.email,fixture.real_name,fixture.private_messages,fixture.health_records,fixture.id])
  assert.ok(!body.includes(text),'Leaked sensitive fixture data: '+text);
 assert.ok(body.length<400);
 assert.equal(safePdfText('name\r\nBcc:invalid@example.invalid'), 'name  Bcc:invalid@example.invalid');
});
test('honest, threshold-based role achievements do not manufacture milestones',()=>{
 const creator=recapAchievements(sample('creator',{collaborations:1,new_friends:5}));
 assert.equal(creator.length,2);
 assert.equal(creator[0].title,'Creative Collaborator');
 assert.equal(creator[1].title,'Community Connector');
 assert.equal(recapAchievements(sample('studio',{new_representations:1}))[0].title,'Professional Representation');
 assert.ok(recapAchievements(sample('photographer',{featured_portfolio_items:1})).some(x=>x.title==='Portfolio Spotlight'));
});
test('yearly snapshot migration is private, unique, audited, idempotent and Jan 1 gated',()=>{
 const sql=read('supabase/migrations/20261121035028_annual_member_year_in_review_2026.sql');
 for(const fragment of ['unique(user_id,report_year)','enable row level security',
  'revoke all on public.ccx_annual_recaps from public,anon,authenticated',
  'ccx_annual_recap_event_immutable','pg_try_advisory_xact_lock','on conflict(user_id,report_year) do nothing',
  'ccx_annual_recap_generate_batch(500)','*/5 * 1-7 1 *',
  "now() < pg_catalog.make_timestamptz(v_year+1,1,1,15,0,0,'UTC')",
  "'annual_recap'","'feed_shared'"])
  assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()),'Missing '+fragment);
 assert.match(sql,/agreed_by_representative_at is not null and mr\.agreed_by_professional_at is not null/);
 assert.match(sql,/mr\.status='active'/);
 assert.match(sql,/a\.banned is false and a\.suspended is false/);
 assert.match(sql,/a\.visibility='verified'/);
 assert.match(sql,/t\.visible_to_members is true/);
 assert.doesNotMatch(sql,/grant (?:all|select|insert|update|delete) on public\.ccx_annual_recaps to authenticated/i);
 const wrapper=read('supabase/migrations/20261121035054_annual_recap_service_only_share_wrappers.sql');
 assert.match(wrapper,/security invoker/);
 assert.match(wrapper,/to service_role/);
 assert.match(wrapper,/revoke all on function public\.ccx_annual_recap_feed_share\(uuid,uuid\) from public,anon,authenticated/);
});
test('API, PDF and UI keep sharing opt-in and download owner-only',()=>{
 const edge=read('supabase/functions/annual-recap/index.ts');
 const pdf=read('supabase/functions/annual-recap/pdfReport.mjs');
 const ui=read('src/supabase/AnnualRecap.jsx');
 const shell=read('src/supabase/OriginalShell.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const notify=read('src/supabase/NotificationCenter.jsx');
 assert.match(edge,/caller\.auth\.getUser\(\)/);
 assert.match(edge,/eq\('user_id',uid\)\.eq\('report_year',year\)/);
 assert.match(edge,/audited=await db\.from\('ccx_annual_recap_events'\)\.insert/);
 assert.match(edge,/Content-Disposition/);
 assert.match(pdf,/renderRecapPdf/);
 assert.match(pdf,/PDFDocument/);
 assert.match(ui,/shareConfirm/);
 assert.match(ui,/checkbox/);
 assert.match(ui,/Download PDF/);
 assert.match(ui,/Share to social media/);
 assert.match(ui,/Publish to Connect Feed/);
 assert.match(shell,/label:'Year in Review'/);
 assert.match(app,/tab==='annual-recap'&&approved&&<AnnualRecap/);
 assert.match(notify,/kind==='annual_recap'/);
 assert.doesNotMatch(edge,/\.select\('\*'\)/);
});
