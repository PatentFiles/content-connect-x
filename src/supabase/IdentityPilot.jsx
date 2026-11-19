/** Existing admitted administrators test their OWN ID. No production approval action exists here. */
import React,{useCallback,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import IdentityVerification from './IdentityVerification';
import {identityUploadTo} from './identityApi';
import {mergeIdentitySnapshot,identityDiagnosticHelp} from './identityResultState.mjs';
const checks=[['document_fields_confident','ID fields read confidently'],['document_cross_checked','ID front/back or passport machine-readable data agree'],['document_authenticity_check','Document authenticity heuristic'],['document_current','ID expiry read as current'],['name_matches','Entered legal name matches'],['age_eligible','Eligible under the 18th-birthday-plus-one-day rule'],['face_matched','ID face matches camera face'],['frame_identity_passed','Same face throughout the capture'],['liveness_passed','Both head-turn challenges passed']];
export default function IdentityPilot(){
 const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),[generation,setGeneration]=useState(0);
 const invoke=useCallback(async body=>{
  const {data,error:failure}=await supabase.functions.invoke('identity-pilot',{body});
  if(failure||data?.error){let message=data?.error||'The private identity test is unavailable.';if(failure?.context?.json)try{message=(await failure.context.json()).error||message;}catch{}throw Error(message);}
  if(data?.test_only!==true||data?.admission_granted!==false)throw Error('Unexpected test response. No account status was changed.');
  if(data.session!==undefined)setSnapshot(previous=>mergeIdentitySnapshot(previous,data));
  return data;
 },[]);
 const action=useCallback((name,values={})=>invoke({action:name,...values}),[invoke]);
 const upload=useCallback(async(sessionId,kind,file,options={})=>{
  const data=await identityUploadTo('identity-pilot',sessionId,kind,file,options);
  // The transport already enforces test_only, no admission, and the saved receipt.
  if(data.session!==undefined)setSnapshot(previous=>mergeIdentitySnapshot(previous,data));
  return data;
 },[]);
 const remove=async()=>{
  if(!snapshot?.session?.id)return;setDeleting(true);setError('');
  try{await action('delete',{session_id:snapshot.session.id});setGeneration(n=>n+1);}catch(e){setError(e.message);}finally{setDeleting(false);}
 };
 const session=snapshot?.session,diagnostics={...session?.diagnostics};
 if(diagnostics.engine_revision&&diagnostics.document_current===undefined)diagnostics.document_current=diagnostics.extracted_expiry?diagnostics.extracted_expiry>=new Date().toISOString().slice(0,10):null;
 return <div className="mx-auto max-w-3xl space-y-5">
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Private test only.</strong> This runs the real ID-reading, face-matching and head-turn checks. It does not approve a new member, change your existing access, or certify the engine. Use only your own ID. Test documents are scheduled for deletion after 24 hours.</div>
  <IdentityVerification key={generation} testing action={action} uploadAction={upload}/>
  {diagnostics.engine_revision&&session?.status!=='processing'&&<section className="ccx-surface rounded-2xl p-5" aria-labelledby="pilot-results">
   <h2 id="pilot-results" className="text-xl font-semibold">Your test results</h2>
   <p className="mt-2 text-sm">These results are private diagnostics, not an account approval. A failed or unclear check must be investigated rather than overridden.</p>
   <dl className="mt-4 grid gap-3 sm:grid-cols-2">
    {[['Name read from ID',diagnostics.extracted_name],['Date of birth read from ID',diagnostics.extracted_dob],['ID expiry read from ID',diagnostics.extracted_expiry],['Eligible to reverify from (UTC)',diagnostics.eligible_on]].map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-1 break-words text-sm text-slate-950">{value||'Not read reliably'}</dd></div>)}
   </dl>
   <div className="mt-4 divide-y rounded-xl border">{checks.map(([key,label])=><div key={key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm"><div className="min-w-0 flex-1"><span>{label}</span>{diagnostics[key]!==true&&<p className="mt-1 text-xs leading-5 text-slate-600">{identityDiagnosticHelp(key,diagnostics)}</p>}</div><strong className={diagnostics[key]===true?'text-emerald-800':'text-amber-900'}>{diagnostics[key]===true?'Passed':diagnostics[key]===false?'Not passed':'Not determined'}</strong></div>)}</div>
   <p className="mt-3 text-xs text-slate-600">Result code: {session.reason}. No document number, raw OCR, or reusable face embedding is included in this report.</p>
  </section>}
  {session?.id&&<section className="rounded-xl border p-4 text-sm">
   <p>Scheduled evidence deletion: {session.purge_after?new Date(session.purge_after).toLocaleString():'Not available'}. Cleanup runs every 15 minutes; new tests pause if cleanup stops reporting success.</p>
   <button type="button" onClick={remove} disabled={deleting||session.status==='cancelled'} className="ccx-secondary mt-3 min-h-11 rounded-xl px-4 py-3">{session.status==='cancelled'?'Deletion requested':'Delete my test evidence'}</button>
   <p className="mt-2 text-xs text-slate-600">Early deletion waits for in-flight uploads and short-lived links to expire. This does not delete your account.</p>
  </section>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 </div>;
}
