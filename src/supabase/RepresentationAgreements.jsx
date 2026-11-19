/** Contract-aware agent / studio representation.
 * Both accounts must accept the identical hash before a relationship becomes active.
 * Immediate safety exit never depends on serving contractual notice.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {FileSignature,Handshake,RefreshCw,Clock3,ShieldAlert} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import MemberPicker from './MemberPicker';
const panel='ccx-surface rounded-2xl p-5';
const input='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const secondary='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const date=value=>value?new Date(value).toLocaleDateString():'Not yet agreed';
async function rpc(action,data={}){
 const {data:result,error}=await supabase.rpc('ccx_representation_agreement_action',{p_action:action,p_data:data});
 if(error)throw Error(error.message||'Representation service unavailable');
 return result;
}
export default function RepresentationAgreements({role='creator',preview=false}){
 const representing=['agent','studio'].includes(role);
 const [items,setItems]=useState([]),[target,setTarget]=useState(typeof window!=='undefined'?window.history.state?.memberContext?.targetUserId||'':'');
 const [roleFilter,setRoleFilter]=useState(representing?'creator':'agent');
 const [scope,setScope]=useState('Professional representation for content productions, negotiations and bookings; all work remains subject to the professional’s separate informed consent.');
 const [months,setMonths]=useState('12'),[noticeDays,setNoticeDays]=useState('30'),[commission,setCommission]=useState('10'),[exclusive,setExclusive]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [renewMonths,setRenewMonths]=useState('12');
 const load=useCallback(async()=>{
  if(preview)return;setBusy(true);setError('');
  try{const response=await rpc('list');setItems(response.items||[]);}catch(e){setError(e.message);}finally{setBusy(false);}
 },[preview]);
 useEffect(()=>{void load();},[load]);
 const execute=async(action,data,message,confirmText='')=>{
  if(busy||preview)return;
  if(confirmText&&!window.confirm(confirmText))return;
  setBusy(true);setError('');setNotice('');
  try{await rpc(action,data);setNotice(message);const response=await rpc('list');setItems(response.items||[]);setTarget('');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const offer=async e=>{e.preventDefault();await execute('request',{target_id:target,scope,months,notice_days:noticeDays,commission_pct:commission,exclusive},'Agreement proposal sent. It becomes active only after both parties accept the exact terms.');};
 return <section className="space-y-5" data-representation-agreements="true">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{representing?'Representation roster':'My representation'}</h1><p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Each relationship has agreed terms, an expiry date, a documented notice period and an independent audit history. Changes require renewed mutual acceptance.</p></div><button type="button" className={secondary} onClick={()=>void load()} disabled={busy||preview} aria-label="Refresh representation"><RefreshCw size={16}/></button></header>
  {preview&&<p className={panel}>Role preview only. No records are loaded or changed.</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {!preview&&<form onSubmit={offer} className={panel+' space-y-4'}>
   <div className="flex items-center gap-2"><Handshake size={20} className="text-[var(--cc-link)]"/><h2 className="text-lg font-semibold">{representing?'Offer representation':'Request representation'}</h2></div>
   <p className="text-xs text-[var(--cc-text-secondary)]">A request never adds someone to your public roster. Both parties must review and accept the same terms before the relationship becomes active.</p>
   <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Find {representing?'professional':'representative'} role<select className={input} value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setTarget('');}}>{(representing?[['creator','Creator'],['photographer','Photographer'],['videographer','Videographer'],['video_editor','Video editor']]:[['agent','Agent'],['studio','Studio']]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><MemberPicker role={roleFilter} label={representing?'Find a verified professional':'Find a verified agent or studio'} value={target} onChange={id=>setTarget(id)}/></div>
   <label className="block text-sm">Scope of representation<textarea className={input} value={scope} onChange={e=>setScope(e.target.value)} rows={3} minLength={10} maxLength={4000} required/></label>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="block text-sm">Term (months)<select className={input} value={months} onChange={e=>setMonths(e.target.value)}>{[1,3,6,12,18,24].map(n=><option key={n} value={String(n)}>{n}</option>)}</select></label>
    <label className="block text-sm">Ordinary cancellation notice (days)<select className={input} value={noticeDays} onChange={e=>setNoticeDays(e.target.value)}>{[0,7,14,30,60,90].map(n=><option key={n} value={String(n)}>{n}</option>)}</select></label>
    <label className="block text-sm">Commission (%)<input className={input} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={commission} onChange={e=>setCommission(e.target.value)} required/></label>
   </div>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exclusive} onChange={e=>setExclusive(e.target.checked)}/>Exclusive representation during the agreed term</label>
   <div className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-xs leading-5 text-[var(--cc-text-secondary)]">Ordinary termination follows the agreed notice period. Either party may immediately end visible representation for safety or coercion concerns. An agreement never overrides voluntary participation or the right to withdraw consent. Formal enforceability depends on applicable law and independent legal review.</div>
   <button type="submit" className={primary} disabled={!target||busy}><FileSignature size={16}/>Send terms for acceptance</button>
  </form>}
  <div className="space-y-4"><h2 className="text-xl font-semibold">Agreements and history</h2>{!busy&&!items.length&&<p className={panel+' text-sm text-[var(--cc-text-secondary)]'}>No representation contracts yet. You can find a verified professional above.</p>}
   <div className="grid gap-4 lg:grid-cols-2">{items.map(item=><article key={item.id} className={panel+' min-w-0 space-y-3'}>
    <div className="flex items-start justify-between gap-2"><div><h3 className="break-words font-semibold">{item.other_name||'Professional member'}</h3><p className="text-xs capitalize text-[var(--cc-text-secondary)]">{item.other_role||'Member'} · {item.is_representative?'Your represented professional':'Your agent / studio'}</p></div><span className="rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-1 text-xs font-semibold capitalize">{item.status}</span></div>
    {item.agreement?<div className="grid gap-2 rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm"><p className="whitespace-pre-wrap break-words">{item.agreement.scope}</p><p>Term: {item.agreement.term_months} months · Notice: {item.agreement.notice_days} days</p><p>Commission: {item.agreement.commission_pct}% · {item.agreement.exclusive?'Exclusive':'Nonexclusive'}</p><p className="text-xs text-[var(--cc-text-secondary)]">Version {item.version} · Terms fingerprint: {item.agreement_hash?.slice(0,12)}…</p></div>:<p className="text-sm text-amber-800">Legacy invitation: no agreed terms. Decline and request a new written agreement before activating.</p>}
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--cc-text-secondary)]"><Clock3 size={15}/>Started: {date(item.starts_at)} · Expires: {date(item.expires_at)}</div>
    {item.status==='pending'&&item.agreement&&<div><p className="mb-2 text-xs">{item.my_accepted?'You accepted these terms. Waiting for the other party.':'Review the terms carefully before accepting.'}</p><div className="flex flex-wrap gap-2">{!item.my_accepted&&<button type="button" className={primary} disabled={busy} onClick={()=>void execute('accept',{id:item.id,terms_hash:item.agreement_hash},'Both parties accepted. Representation is now active.')}>Accept these terms</button>}<button type="button" className={secondary} disabled={busy} onClick={()=>void execute('decline',{id:item.id},'Invitation declined.')}>Decline</button></div></div>}
    {item.status==='pending'&&!item.agreement&&<button type="button" className={secondary} disabled={busy} onClick={()=>void execute('decline',{id:item.id},'Legacy invitation declined.')}>Decline legacy invitation</button>}
    {item.status==='active'&&<div className="flex flex-col gap-3 border-t border-[var(--cc-border)] pt-3">
      {item.notice_at&&<p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Cancellation notice submitted. Representation ends {date(item.notice_effective_at)} unless it ends sooner under applicable safety procedures.</p>}
      {item.renewal_pending&&<p className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-sm">Renewal proposed for {item.renewal_terms?.term_months} months. {item.renewal_by_me?'Waiting for the other party':'Review before accepting.'}</p>}
      <div className="flex flex-wrap gap-2">
       {!item.notice_at&&<button type="button" className={secondary} disabled={busy} onClick={()=>void execute('give_notice',{id:item.id},'Notice recorded. The relationship remains active until the effective date.','Submit ordinary termination notice under your agreed terms?')}>Give cancellation notice</button>}
       {!item.renewal_pending&&!item.notice_at&&<div className="flex items-center gap-2"><select value={renewMonths} onChange={e=>setRenewMonths(e.target.value)} className={input+' !mt-0'} aria-label="Renewal length">{[3,6,12,24].map(n=><option value={String(n)} key={n}>{n} months</option>)}</select><button type="button" className={secondary} disabled={busy} onClick={()=>void execute('request_renewal',{id:item.id,months:renewMonths},'Renewal proposal sent. Both parties must agree.')}>Propose renewal</button></div>}
       {item.renewal_pending&&!item.renewal_by_me&&<button type="button" className={primary} disabled={busy} onClick={()=>void execute('accept_renewal',{id:item.id,terms_hash:item.renewal_hash},'Renewal accepted. Expiry and audit version updated.')}>Accept renewal</button>}
       <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700" disabled={busy} onClick={()=>void execute('end_for_safety',{id:item.id},'Representation ended immediately. The historical agreement remains in your private record.','End representation immediately for safety or consent concerns? This does not erase the underlying agreement.') }><ShieldAlert size={16}/>Immediate safety exit</button>
      </div></div>}
   </article>)}</div>
  </div>
 </section>;
}
