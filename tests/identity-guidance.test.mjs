import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {headTurnPlan,runHeadTurnSequence} from '../src/supabase/identityCaptureSequence.mjs';
import {mergeIdentitySnapshot,identityResultTitle,identityDiagnosticHelp} from '../src/supabase/identityResultState.mjs';
import {decodedUSDocument,usDocumentDate,compareDocumentFields,middleInitialJoinedByOCR} from '../server/idv-worker/document-contract.mjs';
import {sanitizedCheckDetails} from '../supabase/functions/identity-pilot/check-details.mjs';
import {validateCapture,nameKey,decide,SCHEMA,ENGINE_REVISION} from '../supabase/functions/identity-verification/policy.mjs';
const raw=(changes={})=>{
 const f={DCS:'EXAMPLE',DAC:'JORDAN',DAD:'A',DAQ:'SYNTHETIC123',DBB:'06151990',DBA:'06152035',...changes};
 return '@\n\x1e\rANSI 636026080102DL00410288DL'+Object.entries(f).map(([k,v])=>k+v).join('\n')+'\n';
};
const baseReport=()=>({schema:SCHEMA,engine_revision:ENGINE_REVISION,session_id:'test',evidence_hashes:Object.fromEntries(['front','back','selfie','capture'].map(k=>[k,'a'.repeat(64)])),document:{type:'drivers_license',country:'US',name:'JORDAN A EXAMPLE',dob:'1990-06-15',expiry:'2035-06-15',number:'SYNTHETIC123',fields_confident:true,cross_checked:true,authenticity_passed:true},face:{matched:true,distance:.4,liveness_passed:true,frame_identity_passed:true}});
const baseSession=()=>({id:'test',document_type:'drivers_license',issuing_country:'US',legal_name:'Jordan A Example',evidence:Object.fromEntries(['front','back','selfie','capture'].map(k=>[k,{sha256:'a'.repeat(64)}]))});
test('both directions and three-second holds are explained before capture',()=>{
 const plan=headTurnPlan(['right','left']);assert.equal(plan[0].direction,'right');assert.match(plan[0].instruction,/hold for three seconds/);assert.match(plan[1].instruction,/left/);assert.throws(()=>headTurnPlan(['up','left']));assert.throws(()=>headTurnPlan(null));
});
test('guided real timing preserves the six server-required phases and minimum turn durations',async()=>{
 let now=0;const cues=[],controller=new AbortController();
 const result=await runHeadTurnSequence({directions:['left','right'],signal:controller.signal,clock:()=>now,delay:async ms=>{now+=ms;},frame:phase=>({phase,timestamp:now,frame_base64:'a'.repeat(16)}),onCue:cue=>cues.push(cue)});
 assert.deepEqual(cues.slice(0,3).map(c=>c.countdown),[3,2,1]);
 for(const step of [1,2])assert.deepEqual(cues.filter(c=>c.step===step&&c.stage==='hold'&&c.countdown!==null).map(c=>c.countdown),[3,2,1]);
 const payload={...result,challenge_id:'fixture',challenge_type:'head_turn',directions:['left','right']};
 assert.equal(validateCapture(payload,{challenge_id:'fixture',directions:['left','right']}),payload);
 assert.equal(result.frames.length,6);assert.equal(now,22000);assert.equal(result.end_timestamp-result.start_timestamp,19000);
});
test('cancelling countdown cannot capture or upload further frames',async()=>{
 const c=new AbortController();let frames=0;
 await assert.rejects(runHeadTurnSequence({directions:['left','left'],signal:c.signal,clock:()=>0,delay:async()=>{c.abort();},frame:()=>{frames++;},onCue:()=>{}}),{name:'AbortError'});assert.equal(frames,0);
});
for(const status of ['approved','review_required','name_mismatch','age_restricted','expired','cancelled'])test('late pending poll cannot erase '+status,()=>{
 const old={enabled:true,session:{id:'same',status,diagnostics:{face_matched:true}}};
 const result=mergeIdentitySnapshot(old,{enabled:false,session:{id:'same',status:'processing'}});
 assert.equal(result.session,old.session);assert.equal(result.enabled,false);
});
test('result synchronization accepts real final results and a genuinely new session',()=>{
 const current={session:{id:'first',status:'processing'}};
 assert.equal(mergeIdentitySnapshot(current,{session:{id:'first',status:'review_required'}}).session.status,'review_required');
 assert.equal(mergeIdentitySnapshot({session:{id:'first',status:'approved'}},{session:{id:'second',status:'collecting'}}).session.id,'second');
 assert.equal(mergeIdentitySnapshot({session:{id:'first',status:'name_mismatch'}},{session:{id:'first',status:'approved'}}).session.status,'approved');
 assert.match(identityResultTitle('review_required',true),/finished/);
});
for(const [input,expected] of [['06/15/2035','2035-06-15'],['06152035','2035-06-15'],['2035-06-15','2035-06-15'],['02/30/2035',null],['15/06/2035',null],['6/15/35',null]])test('explicit US barcode date '+input,()=>assert.equal(usDocumentDate(input),expected));
test('actual barcode payload keeps middle names and complete uppercase surnames',()=>{
 const d=decodedUSDocument(raw());assert.equal(d.full_name,'JORDAN A EXAMPLE');assert.equal(d.date_of_birth,'1990-06-15');assert.equal(d.expiry_date,'2035-06-15');assert.equal(d.id_number,'SYNTHETIC123');
 assert.equal(decodedUSDocument(raw({DAD:'NONE'})).full_name,'JORDAN EXAMPLE');
});
test('text OCR, conflicting duplicates and impossible dates are not decoded barcode evidence',()=>{
 assert.equal(decodedUSDocument('JORDAN A EXAMPLE DOB 06/15/1990'),null);
 assert.equal(decodedUSDocument(raw()+'DAQDIFFERENT\n'),null);
 assert.equal(decodedUSDocument(raw({DBA:'02302035'})),null);
});
test('front and decoded back use equivalent date formats without dropping identity tokens',()=>{
 const front={name:'Jordan A Example',dob:'1990-06-15',expiry:'2035-06-15',number:'SYNTHETIC123'};
 const back=decodedUSDocument(raw());assert.equal(compareDocumentFields(front,back,nameKey).passed,true);
 assert.equal(compareDocumentFields(front,{...back,date_of_birth:'06/15/1990'},nameKey).passed,true);
 assert.deepEqual(compareDocumentFields(front,{...back,full_name:'Jordan Example'},nameKey).mismatches,['legal_name']);
 assert.ok(compareDocumentFields(front,{...back,id_number:'OTHER'},nameKey).mismatches.includes('document_number'));
});
test('diagnostic allowlist removes private values and unbounded metadata',()=>{
 const safe=sanitizedCheckDetails({raw_text:'PRIVATE',document_number:'SECRET',worker_revision:'<private>',processing_ms:Infinity,low_confidence_fields:['date_of_birth','SECRET','date_of_birth'],authenticity_score:5,frame_checks:[{phase:'turn_start',face_present:true,embedding:[1,2],raw_text:'PRIVATE'}],turn_checks:[{direction:'left',failed_checks:['return_to_center','PRIVATE'],message:'PRIVATE'}]});
 assert.equal(safe.worker_revision,null);assert.equal(safe.processing_ms,null);assert.equal(safe.authenticity_score,null);assert.deepEqual(safe.low_confidence_fields,['date_of_birth']);assert.doesNotMatch(JSON.stringify(safe),/PRIVATE|SECRET|embedding|raw_text/);
 assert.deepEqual(sanitizedCheckDetails(null),{});
});
test('name and expiry issues get actionable explanations rather than indefinite checking',()=>{
 assert.match(identityDiagnosticHelp('name_matches',{}),/middle/);
 assert.match(identityDiagnosticHelp('document_current',{extracted_expiry:'2000-01-01'},'2026-11-19'),/in the past/);
 assert.match(identityDiagnosticHelp('document_authenticity_check',{}),/does not by itself prove/);
});
for(const key of ['fields_confident','cross_checked','authenticity_passed'])test('passing face and age cannot override failed '+key,()=>{
 const report=baseReport();report.document[key]=false;assert.equal(decide(report,baseSession(),'2026-11-19').status,'review_required');
});
for(const key of ['liveness_passed','frame_identity_passed'])test('passing document and central face cannot override '+key,()=>{
 const report=baseReport();report.face[key]=false;assert.equal(decide(report,baseSession(),'2026-11-19').status,'review_required');
});
test('a complete valid report approves automatically while an omitted middle initial requires correction',()=>{
 const report=baseReport(),session=baseSession();assert.equal(decide(report,session,'2026-11-19').status,'approved');
 session.legal_name='Jordan Example';assert.equal(decide(report,session,'2026-11-19').status,'name_mismatch');
});
test('worker and Edge core policies remain identical',()=>assert.equal(fs.readFileSync('server/idv-worker/policy.mjs','utf8'),fs.readFileSync('supabase/functions/identity-verification/policy.mjs','utf8')));

test('middle initial fused by OCR is matched only when barcode corroborates all fields',()=>{
 const barcode=decodedUSDocument(raw()),base={name:'JORDANA EXAMPLE',dob:'1990-06-15',expiry:'2035-06-15',number:'SYNTHETIC123'};
 assert.equal(middleInitialJoinedByOCR(base.name,barcode.full_name,nameKey),true);
 assert.equal(compareDocumentFields(base,barcode,nameKey).passed,true);
 assert.equal(compareDocumentFields({...base,expiry:'2023-06-15'},barcode,nameKey).passed,false);
 assert.deepEqual(compareDocumentFields({...base,expiry:'2023-06-15'},barcode,nameKey).mismatches,['expiry_date']);
 assert.equal(middleInitialJoinedByOCR('JORDANX EXAMPLE',barcode.full_name,nameKey),false);
 assert.equal(middleInitialJoinedByOCR('JORDAN EXAMPLE',barcode.full_name,nameKey),false);
});


test('a newer evidence revision replaces a final review verdict; stale polls cannot restore it',()=>{
 const old={enabled:true,session:{id:'same',status:'review_required',evidence_revision:0,uploaded:{front:true,back:true,capture:true}}};
 const retaken=mergeIdentitySnapshot(old,{session:{id:'same',status:'collecting',evidence_revision:1,uploaded:{front:false,back:true,capture:true}}});
 assert.equal(retaken.session.status,'collecting');
 assert.equal(retaken.session.uploaded.front,false);
 const stale=mergeIdentitySnapshot(retaken,{session:{id:'same',status:'review_required',evidence_revision:0,uploaded:{front:true}}});
 assert.equal(stale.session.evidence_revision,1);
 assert.equal(stale.session.uploaded.front,false);
});
