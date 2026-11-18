/** Private booking packet, staff permissions, insurance, arrival and incidents. */
import React,{useEffect,useState} from 'react';
import {FileText,UsersRound,MessageSquare,ShieldCheck,Clock,AlertTriangle,Download} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {hostingProduction,formatDate,hostingAdvanced} from './hostingBusinessApi';
const card='rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4';
const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2 text-sm text-[var(--cc-text-primary)]';
const button='rounded-lg ccx-action-primary px-4 py-2 text-xs font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const second='rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 text-xs text-[var(--cc-text-primary)] disabled:opacity-50';


export default function HostingProductionPacket({bookingId,userId}){
 const [packet,setPacket]=useState(null),[access,setAccess]=useState([]),[incidents,setIncidents]=useState([]);
 const [messageRoom,setMessageRoom]=useState('');
 const [invitedId,setInvitedId]=useState(''),[invitedRole,setInvitedRole]=useState('crew');
 const [insuranceFile,setInsuranceFile]=useState(null),[policyHolder,setPolicyHolder]=useState(''),[insuranceExpiry,setInsuranceExpiry]=useState('');
 const [incidentCategory,setIncidentCategory]=useState('safety'),[incidentText,setIncidentText]=useState('');
 const [equipmentCondition,setEquipmentCondition]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  if(!bookingId)return;
  setBusy(true);setError('');
  try{
   const [p,a,i]=await Promise.all([
    hostingProduction('booking_planning_packet',{booking_id:bookingId}),
    hostingProduction('booking_access_list',{booking_id:bookingId}),
    hostingProduction('incident_my',{booking_id:bookingId})
   ]);
   setPacket(p);setAccess(a.items||[]);setIncidents(i.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{load();},[bookingId]);
 const act=async(action,args,text)=>{
  setBusy(true);setError('');setNotice('');
  try{const r=await hostingProduction(action,args);setNotice(text||r.note||'Saved.');await load();return r;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const sendInvite=async(e)=>{
  e.preventDefault();const done=await act('booking_access_invite',{booking_id:bookingId,user_id:invitedId,role:invitedRole},
   'Private invitation sent. The member must accept.');
  if(done)setInvitedId('');
 };
 const sendInsurance=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!insuranceFile||insuranceFile.size>10*1024*1024)throw Error('Select a PDF/image under 10MB');
   const mime=insuranceFile.type;
   if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime))throw Error('Unsupported proof format');
   const grant=await hostingProduction('insurance_upload_token',{booking_id:bookingId,mime_type:mime});
   const {error:uploadError}=await supabase.storage.from('hosting-compliance')
    .uploadToSignedUrl(grant.path,grant.token,insuranceFile,{contentType:mime});
   if(uploadError)throw uploadError;
   await hostingProduction('insurance_submit',{
    booking_id:bookingId,path:grant.path,expiry_date:insuranceExpiry,policy_holder:policyHolder
   });
   setInsuranceFile(null);setNotice('Private insurance evidence submitted for host approval.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const makeChat=async()=>{
  const result=await act('booking_conversation_open',{booking_id:bookingId},
   'Private production chat is available in your messaging workspace.');
  if(result)setMessageRoom(result.conversation_id);
 };
 const exportPacket=()=>{
  if(!packet)return;
  const content=[
   'CONTENT CONNECT X — PRIVATE SHOOT PLANNING PACKET',
   'Booking '+packet.booking_id,
   'Venue '+(packet.property?.title||''),
   'General area: '+[packet.property?.city,packet.property?.state,packet.property?.country].filter(Boolean).join(', '),
   'Start: '+formatDate(packet.starts_at),'End: '+formatDate(packet.ends_at),
   'Crew size: '+packet.crew_size,'Production use: '+packet.requested_use,
   'Rental agreement: '+packet.agreement_status,
   'Payment verification: '+packet.payment_status,
   'Insurance verification: '+packet.insurance_status,
   'Permitted uses: '+(packet.property?.permitted_uses||[]).join(', '),
   'Venue rules: '+(packet.property?.rules||''),
   'Gear: '+(packet.addons||[]).map(x=>x.addon_id+' x'+x.quantity).join(', '),
   'Approved crew: '+(packet.participants||[]).map(x=>x.role+' '+x.user_id).join(', '),
   'ENTRY ADDRESS: '+(packet.arrival?.exact_address||'Restricted until signed and funded'),
   'ENTRY INSTRUCTIONS: '+(packet.arrival?.entry_instructions||'Restricted until authorized'),
   'CONFIDENTIAL — Authorized booking participants only. Do not redistribute.'
  ].join('\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='private-shoot-packet.txt';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 if(!packet)return <section className={card}><p className="text-sm text-[var(--cc-text-secondary)]">{busy?'Loading protected shoot packet…':error||'No accessible packet'}</p></section>;
 // Host-only operations are separately checked by the backend; the UI never determines permissions.
 return <div className="space-y-4 text-[var(--cc-text-primary)]">
  <div><h3 className="flex gap-2 items-center text-lg font-semibold"><FileText size={18}/>Private shoot planning and operations</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">Documents and arrival details are scoped to the booking and approved participants.</p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <div className={card+' space-y-3'}>
   <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{packet.property?.title||'Private venue'}</h4><button className={button} onClick={exportPacket}><Download size={15} className="inline mr-1"/>Download private packet</button></div>
   <p className="text-xs text-[var(--cc-text-secondary)]">{formatDate(packet.starts_at)} – {formatDate(packet.ends_at)} · {packet.crew_size} participants</p>
   <div className="grid gap-2 text-xs sm:grid-cols-2">
    <p><strong>Approved use:</strong> {packet.requested_use}</p>
    <p><strong>Agreement:</strong> {packet.agreement_status}</p>
    <p><strong>Payment:</strong> {packet.payment_status}</p>
    <p><strong>Insurance:</strong> {packet.insurance_status}</p>
   </div>
   <p className="text-xs whitespace-pre-wrap text-[var(--cc-text-secondary)]">Venue rules: {packet.property?.rules||'Confirm with host'}</p>
   <div className="rounded-lg bg-[var(--cc-surface-subtle)] p-3 text-sm">
    <p className="font-semibold">Authorized entry details</p>
    <p className="mt-1">{packet.arrival?.exact_address||'Address restricted until signed, paid and approved for this role.'}</p>
    <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--cc-text-secondary)]">{packet.arrival?.entry_instructions||''}</p>
   </div>
  </div>
  <div className={card+' space-y-3'}>
   <h4 className="font-semibold flex gap-2 items-center"><UsersRound size={16}/>Production access permissions</h4>
   <form className="flex flex-wrap gap-2" onSubmit={sendInvite}>
    <input className={input+' min-w-[190px] flex-1'} required value={invitedId} onChange={e=>setInvitedId(e.target.value)} placeholder="Verified crew member UUID"/>
    <select className={input+' max-w-[140px]'} value={invitedRole} onChange={e=>setInvitedRole(e.target.value)}>
     {['crew','coordinator','assistant','security','cleaner'].map(role=><option key={role}>{role}</option>)}</select>
    <button className={button} disabled={busy}>Invite</button>
   </form>
   {access.map(a=><div key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cc-border)] py-2 text-xs">
    <span className="break-all">{a.user_id} · {a.role} · {a.status}</span>
    <div className="flex gap-2">
     {a.status==='invited'&&a.user_id===userId&&<button className={second}
       onClick={()=>act('booking_access_respond',{booking_id:bookingId,status:'active'},'Invitation accepted.')}>Accept</button>}
     {a.status==='active'&&<button className={second}
       onClick={()=>act('booking_access_grant_entry',{booking_id:bookingId,user_id:a.user_id,allow:!a.can_view_entry},
        'Entry access updated for this crew member.')}>{a.can_view_entry?'Revoke entry':'Allow entry'}</button>}
     {a.status!=='revoked'&&<button className="text-red-800"
       onClick={()=>act('booking_access_revoke',{booking_id:bookingId,user_id:a.user_id},'Crew access revoked.')}>Remove</button>}
    </div>
   </div>)}
  </div>
  <div className={card+' space-y-3'}>
   <h4 className="font-semibold flex gap-2 items-center"><MessageSquare size={16}/>Booking conversation</h4>
   <p className="text-xs text-[var(--cc-text-secondary)]">Create a conversation for the host, guest and approved crew. Messages remain in the existing member messaging workspace.</p>
   <button className={button} disabled={busy} onClick={makeChat}>Open or create private production chat</button>
   {messageRoom&&<div className="flex flex-wrap items-center gap-2 text-xs"><span className="break-all">{messageRoom}</span>
     <button className={second} onClick={()=>navigator.clipboard?.writeText(messageRoom)}>Copy conversation ID</button></div>}
  </div>
  <div className={card+' space-y-3'}>
   <h4 className="font-semibold flex items-center gap-2"><ShieldCheck size={16}/>Production insurance</h4>
   <p className="text-xs text-[var(--cc-text-secondary)]">The venue host reviews proof before check-in when insurance is mandatory. Medical and identity documents do not belong here.</p>
   <form onSubmit={sendInsurance} className="grid gap-2 sm:grid-cols-2">
    <label className="text-xs">Policy holder<input className={input+' mt-1'} value={policyHolder} onChange={e=>setPolicyHolder(e.target.value)}/></label>
    <label className="text-xs">Coverage expiry<input className={input+' mt-1'} type="date" required value={insuranceExpiry} onChange={e=>setInsuranceExpiry(e.target.value)}/></label>
    <input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setInsuranceFile(e.target.files?.[0]||null)} className="text-xs"/>
    <button className={button} disabled={busy||!insuranceFile}>Submit private insurance evidence</button>
   </form>
   <div className="ccx-action-row flex gap-2">
    <button className={second} onClick={()=>act('insurance_review',{booking_id:bookingId,status:'approved',review_confirmed:true},'Insurance approved by host.')}>Host approve insurance</button>
    <button className={second} onClick={()=>act('insurance_review',{booking_id:bookingId,status:'rejected',review_confirmed:true},'Insurance returned for changes.')}>Return for changes</button>
   </div>
  </div>
  <div className={card+' space-y-3'}>
   <h4 className="font-semibold flex gap-2 items-center"><Clock size={16}/>Arrivals, checkout and overtime</h4>
   <div className="flex flex-wrap gap-2">
    {['check_in','check_out','host_confirm','no_show'].map(type=><button className={type==='no_show'?second:button} key={type}
      disabled={busy} onClick={()=>act('booking_check',{booking_id:bookingId,event_type:type},'Production event recorded: '+type.replaceAll('_',' '))}>
       {type.replaceAll('_',' ')}
      </button>)}
   </div>
   <p className="text-xs text-[var(--cc-text-secondary)]">Check-in requires an accepted booking, completed DocuSign evidence, confirmed payment and approved insurance when required. Overtime is quoted, never automatically charged.</p>
  </div>
  {(packet.addons||[]).length>0&&<div className={card+' space-y-2'}>
   <h4 className="font-semibold">Equipment condition reports</h4>
   {(packet.addons||[]).map(a=><div key={a.addon_id} className="rounded-lg border border-[var(--cc-border)] p-3 space-y-2">
    <p className="text-xs">Equipment ID: {a.addon_id} · Reserved: {a.quantity}</p>
    <div className="grid grid-cols-2 gap-2">
     {['before','after'].map(phase=><label key={phase} className="text-xs capitalize">{phase} condition<select className={input+' mt-1'}
       value={equipmentCondition[a.addon_id]?.[phase]||'good'} onChange={e=>setEquipmentCondition(v=>({...v,[a.addon_id]:{...v[a.addon_id],[phase]:e.target.value}}))}>
       {['new','good','fair','damaged'].map(c=><option key={c}>{c}</option>)}
      </select></label>)}
    </div>
    <button className={second} onClick={async()=>{
      try{
       await hostingAdvanced('addon_condition',{booking_id:bookingId,addon_id:a.addon_id,
        condition_before:equipmentCondition[a.addon_id]?.before||'good',
        condition_after:equipmentCondition[a.addon_id]?.after||'good'});
       setNotice('Equipment condition report saved.');
      }catch(e){setError(e.message);}
    }}>Save equipment inspection</button>
   </div>)}
  </div>}
  <div className={card+' space-y-3'}>
   <h4 className="font-semibold flex items-center gap-2"><AlertTriangle size={16}/>Confidential incident reporting</h4>
   <form className="space-y-2" onSubmit={e=>{e.preventDefault();act('incident_report',{
     booking_id:bookingId,category:incidentCategory,description:incidentText},'Incident submitted for private safety review.');setIncidentText('');}}>
    <label className="text-xs block">Category<select className={input+' mt-1'} value={incidentCategory} onChange={e=>setIncidentCategory(e.target.value)}>
     {['damage','equipment','safety','conduct','access','other'].map(c=><option key={c}>{c}</option>)}</select></label>
    <textarea className={input} rows={3} required minLength={10} maxLength={3000} value={incidentText}
     onChange={e=>setIncidentText(e.target.value)} placeholder="Describe the concern. Do not include private health records."/>
    <button className={button} disabled={busy}>Report incident</button>
   </form>
   {incidents.map(i=><div key={i.id} className="rounded-lg bg-[var(--cc-surface-subtle)] p-3 text-xs">
    <p className="font-semibold">{i.category} · {i.status}</p><p className="mt-1 whitespace-pre-wrap">{i.description}</p>
   </div>)}
  </div>
 </div>;
}
