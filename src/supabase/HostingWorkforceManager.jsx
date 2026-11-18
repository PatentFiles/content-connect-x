/** Production location cleaners, roles, assignments, consumables and quality history. */
import React,{useEffect,useState} from 'react';
import {UsersRound,ClipboardCheck,Package,AlertTriangle,Star} from 'lucide-react';
import {hostingProduction,formatDate} from './hostingBusinessApi';
const card='rounded-xl border border-[#344C66] bg-[#101D2F] p-4';
const field='w-full rounded-lg border border-[#425773] bg-[#081625] p-2 text-sm text-white';
const btn='rounded-lg ccx-action-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary='rounded-lg border border-[#39526B] bg-[#253A56] px-3 py-2 text-xs text-white disabled:opacity-50';

export default function HostingWorkforceManager({propertyId=null,worker=false}){
 const [invites,setInvites]=useState([]);
 const [staff,setStaff]=useState([]);
 const [jobs,setJobs]=useState([]);
 const [stock,setStock]=useState([]);
 const [performance,setPerformance]=useState([]);
 const [memberId,setMemberId]=useState('');
 const [role,setRole]=useState('cleaner');
 const [supply,setSupply]=useState({label:'',unit:'units',quantity:0,reorder_at:2,notes:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setBusy(true);setError('');
  try{
   if(worker){
    const [i,j]=await Promise.all([hostingProduction('my_staff_invites'),hostingProduction('cleaning_jobs')]);
    setInvites(i.items||[]);setJobs(j.items||[]);
   }else if(propertyId){
    const [s,j,i,p]=await Promise.all([
     hostingProduction('staff_list',{property_id:propertyId}),
     hostingProduction('cleaning_jobs',{property_id:propertyId}),
     hostingProduction('supplies',{property_id:propertyId}),
     hostingProduction('cleaner_performance',{property_id:propertyId})
    ]);
    setStaff(s.items||[]);setJobs(j.items||[]);setStock(i.items||[]);setPerformance(p.items||[]);
   }
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{load();},[propertyId,worker]);
 const act=async(action,body,msg)=>{
  setBusy(true);setError('');setNotice('');
  try{const result=await hostingProduction(action,body);setNotice(msg||'Saved.');await load();return result;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const invite=async(e)=>{
  e.preventDefault();
  const r=await act('staff_invite',{property_id:propertyId,user_id:memberId,role},'Invitation sent for independent acceptance.');
  if(r)setMemberId('');
 };
 const addSupply=async(e)=>{
  e.preventDefault();
  const r=await act('supply_upsert',{property_id:propertyId,...supply},'Supply inventory updated.');
  if(r)setSupply({label:'',unit:'units',quantity:0,reorder_at:2,notes:''});
 };
 const adjust=async(item,delta)=>{
  if(!Number.isFinite(delta)||delta===0)return;
  await act('supply_adjust',{id:item.id,delta,reason:'Recorded by verified property staff'},'Supply quantity adjusted.');
 };
 const workerJobs=worker?jobs:jobs;
 return <div className="space-y-4 text-white">
  <div><h3 className="text-lg font-semibold flex gap-2 items-center"><UsersRound size={18}/>{worker?'My venue work':'Host workforce and property operations'}</h3>
    <p className="text-xs text-[#A2B8D3]">Verified staff access only their accepted assignments. Cleaning work is scheduled after completed rentals.</p></div>
  {error&&<p className="rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
  {notice&&<p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
  {worker&&<div className={card+' space-y-3'}>
    <h4 className="font-semibold">My property invitations</h4>
    {invites.map(i=><div key={i.property_id} className="flex flex-wrap justify-between gap-2 border-t border-[#334961] py-2 text-xs">
      <span className="break-all">{i.property_id} · {i.role} · {i.status}</span>
      {i.status==='invited'&&<div className="ccx-action-row flex gap-2"><button className={btn} onClick={()=>act('staff_respond',{property_id:i.property_id,status:'active'},'Staff invitation accepted.')}>Accept</button>
        <button className={secondary} onClick={()=>act('staff_respond',{property_id:i.property_id,status:'declined'},'Invitation declined.')}>Decline</button></div>}
    </div>)}
    {!invites.length&&<p className="text-xs text-[#9FB5D0]">No staff invitations yet.</p>}
  </div>}
  {!worker&&<form className={card+' space-y-3'} onSubmit={invite}>
    <h4 className="font-semibold">Invite verified cleaners and production staff</h4>
    <div className="flex flex-wrap gap-2">
      <input required className={field+' min-w-[200px] flex-1'} placeholder="Verified member UUID" value={memberId} onChange={e=>setMemberId(e.target.value)}/>
      <select className={field+' max-w-[160px]'} value={role} onChange={e=>setRole(e.target.value)}>{['cleaner','manager','coordinator','assistant','security'].map(x=><option key={x} value={x}>{x}</option>)}</select>
      <button disabled={busy} className={btn}>Invite member</button>
    </div>
    {staff.map(i=><div key={i.member_id} className="flex flex-wrap justify-between gap-2 border-t border-[#334961] pt-2 text-xs">
      <span className="break-all">{i.member_id} · {i.role} · {i.status}</span>
      {i.status==='active'&&<button className="text-red-300" disabled={busy} onClick={()=>act('staff_remove',{property_id:propertyId,user_id:i.member_id},'Staff permission revoked.')}>Remove</button>}
    </div>)}
  </form>}
  <div className={card+' space-y-3'}><h4 className="font-semibold flex gap-2 items-center"><ClipboardCheck size={17}/>Cleaning assignments ({workerJobs.length})</h4>
    {workerJobs.map(job=><div key={job.id} className="space-y-2 rounded-lg border border-[#324861] p-3">
      <p className="text-sm font-semibold capitalize">{job.status.replaceAll('_',' ')} · Due {formatDate(job.due_at)}</p>
      <p className="text-xs text-[#9FB5D0]">Location {job.property_id} · {job.assigned_to?'Assigned cleaner: '+job.assigned_to:'Not yet assigned'}</p>
      {!worker&&<select className={field} defaultValue={job.assigned_to||''} onChange={e=>act('turnover_assign',{turnover_id:job.id,user_id:e.target.value},'Cleaner assigned.')}>
        <option value="">Assign accepted cleaner</option>
        {staff.filter(s=>s.role==='cleaner'&&s.status==='active').map(s=><option value={s.member_id} key={s.member_id}>{s.member_id}</option>)}
      </select>}
      {(job.tasks||[]).map(t=><label key={t.id} className="flex items-center gap-3 text-xs">
        <input type="checkbox" checked={Boolean(t.done)} onChange={e=>act('cleaning_task',{task_id:t.id,done:e.target.checked},'Checklist updated.')}/>
        {t.label}
      </label>)}
      {!worker&&job.status==='completed'&&<div className="flex gap-2 items-center text-xs">
        <span>Rate cleaning quality</span>{[1,2,3,4,5].map(r=><button key={r} title={r+' stars'}
          onClick={()=>act('cleaning_rate',{turnover_id:job.id,rating:r},'Cleaning quality saved.')}>
          <Star size={18} className={job.quality_rating>=r?'text-yellow-400':'text-[#607891]'}/>
        </button>)}
      </div>}
    </div>)}
    {!workerJobs.length&&<p className="text-xs text-[#9FB5D0]">No assigned turnovers. Completed rentals create turnover tasks automatically.</p>}
  </div>
  {!worker&&<form className={card+' space-y-3'} onSubmit={addSupply}>
    <h4 className="font-semibold flex items-center gap-2"><Package size={17}/>Cleaning supplies</h4>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs col-span-2">Supply<input className={field+' mt-1'} minLength={2} required value={supply.label} onChange={e=>setSupply(v=>({...v,label:e.target.value}))}/></label>
      <label className="text-xs">Stock quantity<input className={field+' mt-1'} type="number" step={0.01} min={0} value={supply.quantity} onChange={e=>setSupply(v=>({...v,quantity:Number(e.target.value)}))}/></label>
      <label className="text-xs">Reorder when ≤<input className={field+' mt-1'} type="number" step={0.01} min={0} value={supply.reorder_at} onChange={e=>setSupply(v=>({...v,reorder_at:Number(e.target.value)}))}/></label>
      <label className="text-xs col-span-2">Unit<input className={field+' mt-1'} value={supply.unit} onChange={e=>setSupply(v=>({...v,unit:e.target.value}))}/></label>
    </div>
    <button className={btn} disabled={busy}>Add supply</button>
    {stock.map(i=><div key={i.id} className="flex flex-wrap justify-between gap-2 border-t border-[#334961] pt-2 text-xs">
      <span>{i.label} · {i.quantity} {i.unit}
        {Number(i.quantity)<=Number(i.reorder_at)&&<strong className="ml-2 text-amber-300"><AlertTriangle size={13} className="inline mr-1"/>Low stock</strong>}</span>
      <div className="ccx-action-row flex gap-2"><button type="button" className={secondary} onClick={()=>adjust(i,-1)}>Use 1</button><button type="button" className={secondary} onClick={()=>adjust(i,1)}>Restock 1</button></div>
    </div>)}
  </form>}
  {!worker&&performance.length>0&&<div className={card+' space-y-2'}>
    <h4 className="font-semibold">Cleaner performance</h4>
    {performance.map(p=><div key={p.user_id} className="flex flex-wrap justify-between gap-2 border-t border-[#334961] pt-2 text-xs">
      <span className="break-all">{p.user_id}</span><span>{p.completed}/{p.assigned} completed · {p.average_hours??'–'} hrs average · {p.average_quality??'–'}/5</span>
    </div>)}
  </div>}
 </div>;
}
