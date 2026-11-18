/** Independent verified administrator review: hosts, damage claims, refunds and signing identity. */
import React,{useCallback,useEffect,useState} from 'react';
import {ShieldCheck,FileSignature,RefreshCw,AlertTriangle,ExternalLink} from 'lucide-react';
import {hostingBusiness,hostingAgreement,hostingProduction,formatUSD,formatDate} from './hostingBusinessApi';
const panel='ccx-surface p-5';
const button='rounded-lg ccx-action-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary='rounded-lg border border-[#40536B] bg-[#26384D] px-4 py-2 text-sm text-white disabled:opacity-50';
const input='w-full rounded-lg border border-[#40536B] bg-[#091522] p-2.5 text-sm text-white';

export default function HostingAdminOperations(){
 const [hosts,setHosts]=useState([]);
 const [claims,setClaims]=useState([]);
 const [refunds,setRefunds]=useState([]);
 const [venueReviews,setVenueReviews]=useState([]);
 const [reviewed,setReviewed]=useState(false);
 const [note,setNote]=useState('');
 const [target,setTarget]=useState('');
 const [legalName,setLegalName]=useState('');
 const [method,setMethod]=useState('reviewed_government_id');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const [a,b,c,d]=await Promise.all([
    hostingBusiness('admin_host_queue'),hostingBusiness('admin_claims'),hostingBusiness('admin_refunds'),hostingProduction('admin_suitability_queue')
   ]);
   setHosts(a.items||[]);setClaims(b.items||[]);setRefunds(c.items||[]);setVenueReviews(d.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{refresh();},[refresh]);
 const perform=async(fn,action,body,message)=>{
  setBusy(true);setError('');setNotice('');
  try{const result=await fn(action,body);setNotice(message||result.note||'Review saved.');await refresh();return result;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const docs=async(id)=>{
  setError('');try{
   const result=await hostingBusiness('admin_host_documents',{id});
   for(const item of result.links||[]){
    const parsed=new URL(item.url);if(parsed.protocol==='https:')window.open(parsed.toString(),'_blank','noopener,noreferrer');
   }
  }catch(e){setError(e.message);}
 };
 const evidence=async(id)=>{
  setError('');try{const result=await hostingBusiness('admin_claim_evidence',{id});
   const parsed=new URL(result.url);if(parsed.protocol==='https:')window.open(parsed.toString(),'_blank','noopener,noreferrer');
  }catch(e){setError(e.message);}
 };
 const confirm=(message)=>reviewed&&window.confirm(message);
 return <section className="space-y-5 text-white">
  <div className="flex justify-between gap-3 items-start">
    <div><h2 className="text-2xl font-semibold">Hosting compliance and finance reviews</h2><p className="text-sm text-[#A2B6CF] mt-2">Sensitive admin operations require administrator permissions. Financial approvals do not move money without a provider.</p></div>
    <button className={secondary} disabled={busy} onClick={refresh}><RefreshCw size={16}/></button>
  </div>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  <label className={panel+' flex gap-3 text-sm items-start'}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} className="mt-1"/>
    I independently inspected the relevant documents and evidence, checked identity and authority, and understand that these actions may affect trust, bookings or financial disputes.</label>
  <div className={panel+' space-y-3'}><h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={17}/>Host property verification ({hosts.length})</h3>
    {!hosts.length&&<p className="text-sm text-[#9FB3CB]">No property authority submissions pending.</p>}
    {hosts.map(item=><div key={item.id} className="space-y-2 border-t border-[#31445D] pt-3">
      <p className="text-sm font-semibold">{item.business_name||'Individual host'} · {item.authority_type.replaceAll('_',' ')}</p>
      <p className="text-xs text-[#9FB3CB]">Property: {item.property_id} · Submitted {formatDate(item.created_at)}</p>
      <button className={secondary+' flex items-center gap-2'} disabled={busy||!reviewed} onClick={()=>docs(item.id)}><ExternalLink size={14}/>Review private evidence</button>
      <textarea className={input} placeholder="Review notes (no raw ID details)" rows={2} value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}/>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={!reviewed||busy} onClick={()=>{
        if(confirm('Approve independently reviewed property authority for one year?'))
         perform(hostingBusiness,'admin_host_decide',{id:item.id,decision:'approved',note,human_review_confirmed:true},'Host authority approved.');
      }}>Approve host</button>
      <button className={secondary} disabled={!reviewed||busy} onClick={()=>perform(hostingBusiness,'admin_host_decide',{id:item.id,decision:'rejected',note,human_review_confirmed:true},'Verification rejected.')}>Reject</button></div>
    </div>)}
  </div>
  <div className={panel+' space-y-3'}>
    <h3 className="font-semibold">Venue production suitability review ({venueReviews.length})</h3>
    {venueReviews.map(v=><div className="space-y-2 border-t border-[#31445D] py-3" key={v.property_id}>
      <p className="text-xs break-all">Venue {v.property_id}</p>
      <p className="text-sm">Adult production: {v.adult_production_permitted?'Host permits':'Not declared'} · Privacy: {v.privacy_level} · Soundproofing: {v.soundproof_confirmed?'Declared':'Not declared'}</p>
      <p className="text-xs text-[#AABDD3]">Parking: {v.parking_spaces} · Dressing rooms: {v.separate_dressing_rooms}</p>
      <p className="text-xs whitespace-pre-wrap text-[#AABDD3]">Restrictions: {v.noise_restrictions||'None provided'}</p>
      <div className="ccx-action-row flex gap-2">
        <button className={button} disabled={busy||!reviewed} onClick={()=>perform(hostingProduction,'admin_suitability_review',{property_id:v.property_id,approved:true,review_confirmed:true},'Suitability approved after independent review.')}>Confirm verified suitability</button>
        <button className={secondary} disabled={busy||!reviewed} onClick={()=>perform(hostingProduction,'admin_suitability_review',{property_id:v.property_id,approved:false,review_confirmed:true},'Venue declarations remain unverified.')}>Leave unverified</button>
      </div>
    </div>)}
  </div>
  <div className={panel+' space-y-3'}><h3 className="font-semibold flex gap-2 items-center"><FileSignature size={17}/>Trusted DocuSign legal names</h3>
    <p className="text-xs text-[#A9BED6]">Register a name only after independently checking government identification. Profile display names are never automatically used as legal signer names.</p>
    <form className="grid gap-2 sm:grid-cols-2" onSubmit={async e=>{
      e.preventDefault();if(!reviewed)return setError('Confirm independent review first.');
      const saved=await perform(hostingAgreement,'admin_register_signer_name',{
        user_id:target,legal_name:legalName,method,independent_review_confirmed:true
      },'Trusted signer name recorded.');
      if(saved){setTarget('');setLegalName('');}
    }}>
      <label className="text-sm">Verified member ID<input required className={input+' mt-1'} placeholder="Supabase user UUID" value={target} onChange={e=>setTarget(e.target.value)}/></label>
      <label className="text-sm">Legal name from reviewed ID<input required minLength={3} maxLength={180} className={input+' mt-1'} value={legalName} onChange={e=>setLegalName(e.target.value)}/></label>
      <label className="text-sm">Verification method<select className={input+' mt-1'} value={method} onChange={e=>setMethod(e.target.value)}>
        <option value="reviewed_government_id">Government ID reviewed</option><option value="approved_identity_provider">Approved identity provider</option>
      </select></label>
      <button disabled={busy||!reviewed} className={button+' self-end'}>Register trusted name</button>
    </form>
  </div>
  <div className={panel+' space-y-3'}><h3 className="font-semibold flex gap-2 items-center"><AlertTriangle size={17}/>Damage claims ({claims.length})</h3>
    {!claims.length&&<p className="text-sm text-[#9FB3CB]">No open damage claims.</p>}
    {claims.map(item=><div key={item.id} className="space-y-2 border-t border-[#31445D] pt-3">
      <p className="font-semibold text-sm">{formatUSD(item.claimed_cents)} · {item.status}</p>
      <p className="text-xs text-[#A9BED6]">Booking: {item.booking_id} · {formatDate(item.created_at)}</p>
      <p className="text-sm whitespace-pre-wrap">{item.description}</p>
      {item.has_evidence&&<button className={secondary} onClick={()=>evidence(item.id)} disabled={!reviewed||busy}>View private damage evidence</button>}
      <div className="flex gap-2">{['approved','rejected'].map(decision=><button key={decision} disabled={!reviewed||busy} className={decision==='approved'?button:secondary} onClick={()=>{
        if(confirm('Record '+decision+' for this claim? No funds are automatically moved.'))
         perform(hostingBusiness,'admin_claim_decide',{id:item.id,decision,human_review_confirmed:true},'Claim decision saved; no charge processed.');
      }}>{decision}</button>)}</div>
    </div>)}
  </div>
  <div className={panel+' space-y-3'}><h3 className="font-semibold">Refund requests ({refunds.length})</h3>
    {!refunds.length&&<p className="text-sm text-[#9FB3CB]">No refunds awaiting review.</p>}
    {refunds.map(item=><div key={item.id} className="space-y-2 border-t border-[#31445D] pt-3">
      <p className="font-semibold text-sm">{formatUSD(item.amount_cents)} · {item.status}</p><p className="text-xs text-[#9FB3CB]">Booking {item.booking_id}</p>
      <p className="text-sm">{item.reason}</p>
      {item.status==='requested'&&<div className="flex gap-2">{['approved','rejected'].map(decision=><button key={decision} disabled={!reviewed||busy}
        className={decision==='approved'?button:secondary} onClick={()=>{
          if(confirm('Review refund request as '+decision+'? This does NOT execute an external refund.'))
           perform(hostingBusiness,'admin_refund_decide',{id:item.id,decision,human_review_confirmed:true},
             'Refund reviewed; processor settlement is separate.');
        }}>{decision}</button>)}</div>}
    </div>)}
  </div>
 </section>;
}
