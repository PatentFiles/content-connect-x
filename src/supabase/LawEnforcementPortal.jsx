/** Law-enforcement accounts are isolated from member role dashboards.
 * Each disclosed report is bounded by an approved case/subject/scope/expiry.
 */
import React,{useEffect,useState} from 'react';
import {Shield,FileDown,RefreshCw,LogOut,FilePlus,LockKeyhole} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import SecurityCenter from './SecurityCenter';
import MfaChallenge from './MfaChallenge';
const btn='ccx-secondary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const input='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-white p-3 text-sm text-slate-900';
const scopes=[['profile','Public/profile identity metadata'],['admission','Admission and verification decision dates'],['platform_activity','Platform action audit metadata'],['safety_reports','Case-linked report status metadata'],['collaboration_metadata','Collaboration participation metadata']];
async function request(action,params={}){
 const {data,error}=await supabase.functions.invoke('ccx-law-portal',{body:{action,...params}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Request unavailable';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{/* preserve */}
  throw Error(message);
 }
 return data;
}
export default function LawEnforcementPortal(){
 const [user,setUser]=useState(null),[status,setStatus]=useState(null),[cases,setCases]=useState([]);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [caseNumber,setCaseNumber]=useState(''),[subject,setSubject]=useState(''),[basis,setBasis]=useState(''),[reference,setReference]=useState('');
 const [processType,setProcessType]=useState('subpoena'),[selectedScopes,setSelectedScopes]=useState(['profile','admission']),[report,setReport]=useState(null);
 const [selected,setSelected]=useState(null),[reset,setReset]=useState(0),[caseAudit,setCaseAudit]=useState([]);
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const {data:{user:person},error:whoError}=await supabase.auth.getUser();
   if(whoError||!person){setUser(null);setStatus(null);setCases([]);return;}
   setUser(person);
   const role=await request('role_status');
   setStatus(role);
   if(role.officer&&!role.requires_mfa){
    setCases((await request('list_cases')).items||[]);
   }else setCases([]);
  }catch(e){setError(e.message||'Could not authorize this portal');}finally{setLoading(false);}
 };
 useEffect(()=>{let live=true;void load();const {data}=supabase.auth.onAuthStateChange((event)=>{
  if(live&&(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED'))void load();
 });return()=>{live=false;data.subscription?.unsubscribe();};},[reset]);
 const signIn=async event=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{const {error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;setPassword('');await load();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const recovery=async()=>{
  if(!email.trim())return setError('Enter your assigned agency email first.');
  setBusy(true);setError('');
  try{
   const {error:e}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/law-enforcement-portal'});
   if(e)throw e;setNotice('If this email has a portal account, recovery instructions have been sent.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const signOut=async()=>{setReport(null);setCases([]);setStatus(null);await supabase.auth.signOut();};
 const openCase=async id=>{
  setBusy(true);setError('');setReport(null);
  try{const r=await request('view',{case_id:id});setSelected(id);setReport(r);setCaseAudit((await request('case_audit',{case_id:id})).items||[]);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const download=async kind=>{
  if(!selected)return;
  setBusy(true);setError('');
  try{
   const data=await request(kind==='pdf'?'export_pdf':'export_csv',{case_id:selected});
   if(!(data instanceof Blob))throw Error('Export was not returned as a file');
   const href=URL.createObjectURL(data),a=document.createElement('a');a.href=href;
   a.download='law-case-'+selected+'.'+kind;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(href),60000);
   setNotice('Case-scoped '+kind.toUpperCase()+' export created. Each export is recorded in the disclosure audit.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const createCase=async event=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!selectedScopes.length)throw Error('Choose at least one record category');
   const r=await request('request_case',{
    agency_case_number:caseNumber.trim(),subject_user_id:subject.trim(),legal_basis:basis.trim(),
    evidence_reference:reference.trim(),legal_process_type:processType,requested_scopes:selectedScopes
   });
   setNotice('Case '+r.item.id+' submitted. No member data is released until legal review and administrator approval.');
   setCases((await request('list_cases')).items||[]);setCaseNumber('');setBasis('');setReference('');setSubject('');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8" data-law-enforcement-portal="true">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
    <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Shield size={18}/>Verified agency access</p>
     <h1 className="mt-1 text-2xl font-semibold">Law enforcement request portal</h1>
     <p className="mt-2 max-w-2xl text-sm text-slate-600">Restricted and audited case-specific records. Legal review, independent verification and least-privilege approval are mandatory for disclosure.</p></div>
    <div className="flex gap-2">{user&&<button type="button" className={btn} onClick={()=>void signOut()}><LogOut size={16} className="mr-1 inline"/>Sign out</button>}
     <a href="/trust/law-enforcement" className={btn}>Public request instructions</a></div>
   </header>
   {loading&&<p role="status">Checking authorized credentials…</p>}
   {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
   {notice&&<p role="status" className="rounded-xl border border-slate-300 bg-white p-4 text-sm">{notice}</p>}
   {!loading&&!user&&<form onSubmit={signIn} className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
    <h2 className="text-lg font-semibold">Sign in with assigned agency credentials</h2>
    <label className="block text-sm">Agency email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required className={input}/></label>
    <label className="block text-sm">Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className={input}/></label>
    <button type="submit" className="ccx-primary w-full rounded-xl px-4 py-2.5 text-sm" disabled={busy}>Secure sign in</button>
    <button type="button" className="text-sm underline" disabled={busy} onClick={()=>void recovery()}>Recover account password</button>
    <p className="text-xs text-slate-600">Accounts are created by verified agency invitation. Shared credentials are prohibited; authenticator-based two-factor sign-in is required for records.</p>
   </form>}
   {!loading&&user&&!status?.officer&&<section className="rounded-xl border bg-white p-6">
    <h2 className="font-semibold">No authorized agency role</h2><p className="mt-2 text-sm">Your account has not been approved for this portal. Request verification through the published law-enforcement contact channel.</p>
   </section>}
   {!loading&&user&&status?.officer&&status.requires_mfa&&<section className="mx-auto max-w-3xl space-y-4 rounded-xl border bg-white p-5">
    <h2 className="flex gap-2 font-semibold"><LockKeyhole size={19}/>Two-factor authentication required</h2>
    <p className="text-sm">Enroll an authenticator for your agency account, then complete the challenge. No case information is accessible at AAL1.</p>
    <SecurityCenter/>
    <button type="button" className={btn} onClick={()=>setReset(n=>n+1)}>Refresh after authenticator enrollment</button>
    <MfaChallenge key={reset} onVerified={()=>setReset(n=>n+1)}/>
   </section>}
   {!loading&&status?.officer&&!status.requires_mfa&&<>
    <section className="rounded-xl border bg-white p-5">
     <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Agency: {status.agency}</h2>
      <button type="button" className={btn} disabled={busy} onClick={()=>void load()}><RefreshCw size={15} className="mr-1 inline"/>Refresh cases</button></div>
     <p className="mt-2 text-xs text-slate-600">Only subjects and data categories approved for each case may be viewed or exported. Records may be legally retained under a properly authorized preservation hold; routine retention and privacy rights still apply.</p>
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
     <form onSubmit={createCase} className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="flex gap-2 font-semibold"><FilePlus size={17}/>Submit a case request</h2>
      <label className="block text-sm">Agency case number<input className={input} required minLength={3} maxLength={160} value={caseNumber} onChange={e=>setCaseNumber(e.target.value)}/></label>
      <label className="block text-sm">Exact member identifier (UUID)<input className={input} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Provided through reviewed lawful process"/></label>
      <label className="block text-sm">Legal process<select className={input} value={processType} onChange={e=>setProcessType(e.target.value)}>
       {['subpoena','warrant','court_order','preservation_request','emergency_request','other'].map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label>
      <label className="block text-sm">Legal basis and relevance<textarea className={input} required minLength={30} maxLength={3000} rows={4} value={basis} onChange={e=>setBasis(e.target.value)}/></label>
      <label className="block text-sm">Legal document reference or tracking number<input className={input} minLength={10} maxLength={500} required value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <fieldset className="space-y-2"><legend className="text-sm font-semibold">Requested record categories</legend>
       {scopes.map(([id,label])=><label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selectedScopes.includes(id)} onChange={e=>setSelectedScopes(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>{label}</label>)}
      </fieldset>
      <button type="submit" className="ccx-primary rounded-xl px-4 py-2.5 text-sm" disabled={busy}>Submit for legal approval</button>
     </form>
     <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">My authorized cases</h2>
      {!cases.length&&<p className="text-sm text-slate-600">No cases submitted.</p>}
      {cases.map(item=><div className="space-y-2 border-b border-slate-200 py-3" key={item.id}>
       <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{item.agency_case_number}</strong><span className="capitalize">{item.status}</span></div>
       <p className="break-all text-xs text-slate-600">Case reference: {item.id}</p>
       <p className="text-xs text-slate-600">Approved: {(item.approved_scopes||[]).join(', ')||'None'} · Expires: {item.expires_at?new Date(item.expires_at).toLocaleString():'Not approved'}</p>
       {item.status==='approved'&&Date.parse(item.expires_at)>Date.now()&&<button type="button" className={btn} onClick={()=>void openCase(item.id)} disabled={busy}>View approved case records</button>}
      </div>)}
     </section>
    </div>
    {report&&<section className="space-y-4 rounded-xl border bg-white p-5" aria-label="Authorized case report">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">Approved disclosure</h2>
      <p className="text-xs text-slate-600">Case {report.agency_case_number} · Subject {report.subject_user_id} · Generated {new Date(report.generated_at).toLocaleString()}</p></div>
      <div className="flex gap-2"><button type="button" className={btn} disabled={busy} onClick={()=>void download('csv')}><FileDown size={16} className="mr-1 inline"/>CSV</button>
       <button type="button" className={btn} disabled={busy} onClick={()=>void download('pdf')}><FileDown size={16} className="mr-1 inline"/>PDF</button></div></div>
     {Object.entries(report.data||{}).map(([category,records])=><details key={category} className="rounded-xl border border-slate-200 p-3" open>
      <summary className="cursor-pointer font-semibold capitalize">{category.replaceAll('_',' ')} ({records.length})</summary>
      <div className="mt-3 space-y-3">{records.map((record,i)=><pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs" key={i}>{JSON.stringify(record,null,2)}</pre>)}</div>
     </details>)}
     <p className="text-xs text-slate-600">{report.disclaimer}</p>
     <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer font-semibold">Case disclosure and export audit ({caseAudit.length})</summary>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
       {caseAudit.map(entry=><p key={entry.id} className="border-b border-slate-100 py-2 text-xs">
        <strong>{entry.action.replaceAll('_',' ')}</strong> · {new Date(entry.created_at).toLocaleString()} · {entry.result_status}
       </p>)}
      </div>
     </details>
    </section>}
   </>}
  </div>
 </main>;
}
