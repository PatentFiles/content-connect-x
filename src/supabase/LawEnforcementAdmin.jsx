/** Administrator-controlled agency invitations and scoped legal-process review.
 * Account password is set by the invited officer, never shared by admin.
 */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,Mail,UserX,CheckCircle,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const btn='ccx-secondary rounded-lg px-3 py-2 text-sm disabled:opacity-50',field='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const scopes=['profile','admission','platform_activity','safety_reports','collaboration_metadata'];
async function call(action,other={}){
 const {data,error}=await supabase.functions.invoke('ccx-law-portal',{body:{action,...other}});
 if(error||data?.error)throw Error(data?.error||error?.message||'Lawful disclosure service unavailable');
 return data;
}
export default function LawEnforcementAdmin(){
 const [officers,setOfficers]=useState([]),[cases,setCases]=useState([]),[invite,setInvite]=useState({email:'',agency:'',jurisdiction:''});
 const [reviewedAgency,setReviewedAgency]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [decisions,setDecisions]=useState({});
 const load=async()=>{
  setBusy(true);setError('');
  try{
   const [o,c]=await Promise.all([call('admin_officers'),call('admin_cases')]);
   setOfficers(o.items||[]);setCases(c.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[]);
 const provision=async event=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await call('admin_invite',{...invite,agency_identity_confirmed:reviewedAgency});
   setInvite({email:'',agency:'',jurisdiction:''});setReviewedAgency(false);setNotice('Agency invitation sent. Officer must enroll MFA and request case-specific approval.');
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const disable=async id=>{
  if(!window.confirm('Disable this law-enforcement account and revoke its active disclosure grants?'))return;
  setBusy(true);setError('');setNotice('');
  try{await call('admin_disable',{officer_id:id});setNotice('Officer account disabled and current grants revoked.');await load();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const update=(id,key,value)=>setDecisions(v=>({...v,[id]:{...v[id],[key]:value}}));
 const preservation=async(item,mode)=>{
  const entry=decisions[item.id]||{},reason=(entry.hold_reason||'').trim();
  if(mode==='apply'&&!entry.legal_preservation_confirmed)return setError('Confirm the verified and necessary legal-process preservation before applying a hold.');
  if(reason.length<(mode==='apply'?25:15))return setError('Provide the reason for this preservation decision.');
  setBusy(true);setError('');setNotice('');
  try{
   const result=await call(mode==='apply'?'admin_hold':'admin_release_hold',{
    case_id:item.id,review_note:reason,days:30,
    legal_preservation_confirmed:entry.legal_preservation_confirmed===true,
    release_confirmed:true
   });
   setNotice(mode==='apply'?'A bounded 30-day ID-evidence preservation hold was recorded and audited.':'The preservation hold was released and audited.');
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };

 const decide=async(item,decision)=>{
  const selected=decisions[item.id]||{};
  setBusy(true);setError('');setNotice('');
  try{
   await call('admin_decide',{case_id:item.id,decision,review_note:selected.review_note||'',
    approved_scopes:selected.approved_scopes||item.requested_scopes,hours:24,
    authorized_process_confirmed:selected.authorized_process_confirmed===true});
   setNotice('Case '+decision+' decision recorded. Disclosure permission is audited and bounded to the approved subject and categories.');
   await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-5" data-law-enforcement-admin="true">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={19}/>Law-enforcement access</h2>
   <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Agency verification, officer invitation, case review and narrowly approved disclosure. Not a general admin role.</p></div>
   <button type="button" className={btn} disabled={busy} onClick={()=>void load()}><RefreshCw size={15} className="mr-1 inline"/>Refresh</button>
  </header>
  {error&&<p className="rounded-xl border border-red-300 p-3 text-sm text-red-800" role="alert">{error}</p>}
  {notice&&<p className="text-sm" role="status">{notice}</p>}
  <form onSubmit={provision} className="ccx-surface grid gap-3 rounded-xl p-5 sm:grid-cols-2">
   <div className="sm:col-span-2"><h3 className="font-semibold">Invite a verified officer</h3>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Confirm the agency using an independent official channel. The officer gets an email invitation and establishes a personal password and authenticator. No shared accounts.</p></div>
   <label className="text-sm">Official agency email<input className={field} type="email" required value={invite.email} onChange={e=>setInvite(v=>({...v,email:e.target.value}))}/></label>
   <label className="text-sm">Verified agency<input className={field} minLength={3} required value={invite.agency} onChange={e=>setInvite(v=>({...v,agency:e.target.value}))}/></label>
   <label className="text-sm">Jurisdiction<input className={field} minLength={2} required value={invite.jurisdiction} onChange={e=>setInvite(v=>({...v,jurisdiction:e.target.value}))}/></label>
   <label className="flex items-start gap-2 text-xs sm:col-span-2"><input type="checkbox" required checked={reviewedAgency} onChange={e=>setReviewedAgency(e.target.checked)}/>
    I independently confirmed this specific official agency email, the individual’s authority, and my authorization to invite them.</label>
   <button type="submit" disabled={busy||!reviewedAgency} className="ccx-primary rounded-lg px-4 py-2 text-sm sm:col-span-2"><Mail size={15} className="mr-1 inline"/>Send individual officer invitation</button>
  </form>
  <section className="ccx-surface space-y-3 rounded-xl p-5">
   <h3 className="font-semibold">Officers ({officers.length})</h3>
   {officers.map(o=><div className="flex flex-wrap justify-between gap-3 border-b border-[var(--cc-border)] p-3 text-sm" key={o.user_id}>
    <div><strong>{o.agency}</strong> · {o.jurisdiction}<p className="break-all text-xs">{o.official_email}</p><p className="text-xs">{o.enabled?'Enabled':'Disabled'} · {o.user_id}</p></div>
    {o.enabled&&<button type="button" className={btn} disabled={busy} onClick={()=>void disable(o.user_id)}><UserX size={15} className="mr-1 inline"/>Disable account</button>}
   </div>)}
  </section>
  <section className="space-y-4">
   <h3 className="text-lg font-semibold">Incoming legal-process requests ({cases.length})</h3>
   {!cases.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No requests received.</p>}
   {cases.map(item=><article key={item.id} className="ccx-surface space-y-3 rounded-xl p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.agency_case_number}</strong><span className="text-sm capitalize">{item.status}</span></div>
    <div className="break-words text-xs text-[var(--cc-text-secondary)]"><p>Subject: {item.subject_user_id}</p><p>Officer: {item.officer_id}</p>
     <p>Process: {item.legal_process_type} · Evidence reference: {item.evidence_reference}</p>
     <p className="mt-2">Legal basis: {item.legal_basis}</p></div>
    <p className="text-sm">Requested: {(item.requested_scopes||[]).join(', ')}</p>
    {item.status==='pending'&&<div className="space-y-3 border-t border-[var(--cc-border)] pt-4">
     <fieldset><legend className="mb-2 text-sm font-semibold">Approve only needed categories</legend>
      <div className="flex flex-wrap gap-3">{(item.requested_scopes||[]).filter(s=>scopes.includes(s)).map(s=>{
       const selected=decisions[item.id]?.approved_scopes||item.requested_scopes;
       return <label key={s} className="flex gap-2 text-xs"><input type="checkbox" checked={selected.includes(s)}
        onChange={e=>update(item.id,'approved_scopes',e.target.checked?[...selected,s]:selected.filter(x=>x!==s))}/>{s.replaceAll('_',' ')}</label>
      })}</div>
     </fieldset>
     <label className="block text-sm">Case-specific review reason<textarea className={field} rows={3} minLength={15} value={decisions[item.id]?.review_note||''} onChange={e=>update(item.id,'review_note',e.target.value)}/></label>
     <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={decisions[item.id]?.authorized_process_confirmed===true}
      onChange={e=>update(item.id,'authorized_process_confirmed',e.target.checked)}/>
      I independently validated the legal process, necessity, scope and expiry for this subject.</label>
     <div className="flex gap-2"><button type="button" className="ccx-primary rounded-lg px-4 py-2 text-sm" disabled={busy||!decisions[item.id]?.authorized_process_confirmed||!(decisions[item.id]?.review_note||'').trim()} onClick={()=>void decide(item,'approve')}><CheckCircle size={15} className="mr-1 inline"/>Approve 24-hour access</button>
      <button type="button" className={btn} disabled={busy||!(decisions[item.id]?.review_note||'').trim()} onClick={()=>void decide(item,'deny')}>Deny</button></div>
    </div>}
    {item.status==='approved'&&<button className={btn} disabled={busy||!(decisions[item.id]?.review_note||'').trim()} type="button" onClick={()=>void decide(item,'revoke')}>Revoke grant (enter reason first)</button>}
    {item.status==='approved'&&<div className="space-y-2 rounded-xl border border-[var(--cc-border)] p-3">
    <h4 className="text-sm font-semibold">Finite ID-evidence preservation</h4>
    <p className="text-xs text-[var(--cc-text-secondary)]">Only a verified legal process can preserve private ID records for a limited period. This does not preserve all platform data and does not override ordinary privacy rights outside the approved hold.</p>
    <p className="text-xs">Current case hold: {item.preservation_hold?'Active':'None'}</p>
    <label className="block text-sm">Preservation necessity or release reason
     <textarea rows={2} className={field} value={decisions[item.id]?.hold_reason||''} onChange={e=>update(item.id,'hold_reason',e.target.value)} placeholder="Document the legal basis, necessity, and period or release justification"/></label>
    {!item.preservation_hold&&<label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={decisions[item.id]?.legal_preservation_confirmed===true}
     onChange={e=>update(item.id,'legal_preservation_confirmed',e.target.checked)}/>
     I independently confirmed the current valid preservation order and necessity for this subject.</label>}
    {item.preservation_hold?
     <button type="button" className={btn} disabled={busy||(decisions[item.id]?.hold_reason||'').trim().length<15} onClick={()=>void preservation(item,'release')}>Release evidence hold</button>
     :<button type="button" className={btn} disabled={busy||!decisions[item.id]?.legal_preservation_confirmed||(decisions[item.id]?.hold_reason||'').trim().length<25}
       onClick={()=>void preservation(item,'apply')}>Apply finite 30-day ID-evidence hold</button>}
   </div>}
   {item.status==='approved'&&<textarea rows={2} className={field} placeholder="Reason for immediate revocation" value={decisions[item.id]?.review_note||''} onChange={e=>update(item.id,'review_note',e.target.value)}/>}
   </article>)}
  </section>
 </section>;
}
