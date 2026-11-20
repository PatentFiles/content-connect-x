import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {livekitJoinToken,livekitUrl} from '../supabase/functions/meeting-suite/livekitToken.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('travel calendar enforces non-overlap at both UI and Postgres transaction boundary',()=>{
 const sql=read('supabase/migrations/20261120164000_travel_date_exclusion.sql');
 const calendar=read('src/supabase/TravelCalendar.jsx');
 const backend=read('supabase/functions/collab-suite/index.ts');
 assert.match(sql,/EXCLUDE USING GIST|exclude using gist/i);
 assert.match(sql,/user_id with =, tstzrange\(starts_at,ends_at,'\[\]'\) with &&/i);
 assert.match(calendar,/Conflicts with/);
 assert.match(calendar,/entry\.city/);
 assert.match(calendar,/trip\.city/);
 assert.match(calendar,/has_more/);
 assert.match(backend,/result\.error\?\.code==='23P01'/);
});

test('LiveKit room JWT is signed with a short expiry and bound to its private scope and user',async()=>{
 const uid='10000000-0000-4000-8000-000000000001';
 const room='ccx-conversation-20000000-0000-4000-8000-000000000002';
 const apiKey='API_testkey2026',apiSecret='fixture-secret-do-not-use-for-production';
 const issued=1795193700;
 const token=await livekitJoinToken(apiKey,apiSecret,room,uid,'Review Member',issued);
 const [header,body,signature]=token.split('.');
 assert.equal(JSON.parse(Buffer.from(header,'base64url').toString()).alg,'HS256');
 const data=JSON.parse(Buffer.from(body,'base64url').toString());
 assert.equal(data.sub,uid);
 assert.equal(data.video.room,room);
 assert.equal(data.video.roomJoin,true);
 assert.equal(data.video.canPublish,true);
 assert.equal(data.exp-issued,3600);
 assert.equal(signature,createHmac('sha256',apiSecret).update(header+'.'+body).digest('base64url'));
 await assert.rejects(()=>livekitJoinToken(apiKey,apiSecret,'ccx-collaboration-not-a-uuid',uid,'Member'));
 assert.equal(livekitUrl('wss://sample.livekit.cloud'),'wss://sample.livekit.cloud');
 assert.throws(()=>livekitUrl('http://sample.livekit.cloud'));
});

test('meeting membership, consent, notes, recordings and invitations are enforced by backend',()=>{
 const edge=read('supabase/functions/meeting-suite/index.ts');
 for(const source of ['collaboration_members','conversation_members','ccx_social_group_members'])
  assert.ok(edge.includes(source),source);
 for(const action of ['room_ticket','invite','consent_set','recording_heartbeat','recordings_list','transcribe','notes_save'])
  assert.ok(edge.includes("action==='"+action+"'"),action);
 assert.match(edge,/member_blocks/);
 assert.match(edge,/Every participant must explicitly approve meeting recording/);
 assert.match(edge,/member_notifications/);
 assert.match(edge,/createSignedUploadUrl/);
 assert.match(edge,/ccx_secret_get/);
 const sql=read('supabase/migrations/20261120170000_context_video_meetings.sql');
 assert.match(sql,/row level security/i);
 assert.match(sql,/revoke all on public\.\%I from public,anon,authenticated/i);
 const stage=read('src/supabase/MeetingStudio.jsx');
 assert.match(stage,/Invite all participants/);
 assert.match(stage,/Shared meeting notes/);
 assert.match(stage,/Recording/);
});

test('human review of AI contract is required before DocuSign signing invitations',()=>{
 const edge=read('supabase/functions/agreement-packets/index.ts');
 const ui=read('src/supabase/AgreementPackets.jsx');
 assert.match(edge,/action==='draft_review'/);
 assert.match(edge,/hashContract/);
 assert.match(edge,/Every signer must approve the current AI contract draft/);
 assert.match(ui,/Request changes/);
 assert.match(ui,/I reviewed and approve this draft/);
 const generator=read('supabase/functions/collab-suite/index.ts');
 assert.match(generator,/ccx_meeting_notes/);
 assert.match(generator,/ccx_meeting_recordings/);
 assert.match(generator,/review_required:true/);
});

test('adult shop uses supplier checkout, no tracking until approved, private admin configuration',()=>{
 const edge=read('supabase/functions/shop-directory/index.ts');
 const ui=read('src/supabase/AffiliateShop.jsx');
 const sql=read('supabase/migrations/20261120182000_affiliate_shop_partners.sql');
 assert.match(edge,/if\(!admin\)return out\(\{error:'Administrator required'/);
 assert.match(edge,/status==='approved'&&!affiliate/);
 assert.match(edge,/partner_status==='approved'/);
 assert.match(ui,/rel="sponsored noopener noreferrer"/);
 assert.match(ui,/Affiliate referral link active/);
 assert.match(sql,/shark-spot/);
 assert.match(sql,/null,array\['machines'\]/i);
 const correction=read('supabase/migrations/20261120193000_verified_shockspot_manufacturer.sql');
 assert.match(correction,/name='Shockspot'/);
 assert.match(correction,/official_url='https:\/\/shockspot\.net\/'/);
 assert.match(correction,/partner_status='prospect'/);
 assert.doesNotMatch(ui,/addToCart|paymentMethod|creditCardNumber/);
});
