/** Explicit administrative operator/legal review; never auto-approve policy
 * obligations or claim a staff rota exists without confirmation.
 */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,Save,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const blank={legal_entity:'',postal_address:'',contact_email:'',policies_approved:false,reviewer_coverage_confirmed:false};
async function call(action,params={}){
 const {data,error}=await supabase.functions.invoke('ccx-operations',{body:{action,...params}});
 if(error||data?.error)throw Error(data?.error||'An active admin session with two-factor authentication is required');
 return data;
}
export default function AdminSafetyOperations(){
 const [fields,setFields]=useState(blank),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [policyAck,setPolicyAck]=useState(false),[coverageAck,setCoverageAck]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');setMessage('');
  try{const result=await call('trust_settings_get');
   setFields({...blank,...result.item});
  }catch(e){setError(e.message);}finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const edit=(key,value)=>{
  setFields(f=>({...f,[key]:value}));
  if(key==='policies_approved')setPolicyAck(false);
  if(key==='reviewer_coverage_confirmed')setCoverageAck(false);
 };
 const submit=async event=>{
  event.preventDefault();setError('');setMessage('');setSaving(true);
  try{
   const result=await call('trust_settings_save',{
    ...fields,
    policy_acknowledgement:fields.policies_approved&&policyAck?'I_REVIEWED_CURRENT_POLICIES':null,
    reviewer_acknowledgement:fields.reviewer_coverage_confirmed&&coverageAck?'STAFF_COVERAGE_CONFIRMED':null
   });
   setFields({...blank,...result.item});
   setMessage('Operator contact and explicit review declarations saved and audited.');
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <section className="ccx-surface max-w-3xl space-y-4 rounded-xl p-5" data-safety-operations="true">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={19}/>Public safety operations</h2>
    <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Complete the real operator identity, public contact information and staff-response readiness before launch.</p></div>
   <button className="ccx-secondary rounded-lg px-3 py-2 text-sm" type="button" disabled={saving} onClick={()=>void load()}><RefreshCw size={15} className="mr-1 inline"/>Refresh</button>
  </div>
  <p className="text-xs text-[var(--cc-text-secondary)]">This records your declarations; it does not perform legal review or assign staff automatically. Do not check any approval unless you have completed it.</p>
  <form onSubmit={submit} className="space-y-4">
   <label className="block text-sm">Legal operator or registered business name
    <input className={input+' mt-1'} required minLength={3} maxLength={160} value={fields.legal_entity||''}
     onChange={e=>edit('legal_entity',e.target.value)} placeholder="Registered business or responsible legal operator"/></label>
   <label className="block text-sm">Public postal contact address
    <textarea className={input+' mt-1'} required minLength={8} maxLength={360} rows={2} value={fields.postal_address||''} onChange={e=>edit('postal_address',e.target.value)} /></label>
   <label className="block text-sm">Monitored safety and support email
    <input className={input+' mt-1'} type="email" required maxLength={254} value={fields.contact_email||''} onChange={e=>edit('contact_email',e.target.value)} placeholder="safety@example.com"/></label>
   <fieldset className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4">
    <legend className="px-1 text-sm font-semibold">Required human confirmations</legend>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={fields.policies_approved===true}
     onChange={e=>edit('policies_approved',e.target.checked)}/>
     The published privacy, safety, content-removal, affiliate and complaint policies have been reviewed by the responsible operator.</label>
    {fields.policies_approved&&<label className="flex items-start gap-3 pl-6 text-xs"><input type="checkbox" required checked={policyAck} onChange={e=>setPolicyAck(e.target.checked)}/>
     I personally confirm that this review has actually been completed, and take responsibility for this declaration.</label>}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={fields.reviewer_coverage_confirmed===true}
     onChange={e=>edit('reviewer_coverage_confirmed',e.target.checked)}/>
     Named administrative reviewers are available to respond to urgent reports, and there is a real on-call coverage process.</label>
    {fields.reviewer_coverage_confirmed&&<label className="flex items-start gap-3 pl-6 text-xs"><input type="checkbox" required checked={coverageAck} onChange={e=>setCoverageAck(e.target.checked)}/>
     I confirm the actual response coverage exists and has been checked, including escalations and absences.</label>}
   </fieldset>
   <button type="submit" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={saving||loading}><Save size={16} className="mr-1 inline"/>{saving?'Saving…':'Save verified operator settings'}</button>
  </form>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
 </section>;
}
