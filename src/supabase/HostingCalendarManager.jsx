import React,{useEffect,useState} from 'react';
import {CalendarDays,Link2,Trash2} from 'lucide-react';
import {hostingCalendar,formatDate} from './hostingBusinessApi';
const panel='ccx-surface p-4';
const input='w-full rounded-lg border border-[#40546E] bg-[#091726] px-3 py-2 text-sm text-white';
const button='rounded-lg ccx-action-primary px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50';
export default function HostingCalendarManager({propertyId}){
 const [connections,setConnections]=useState([]),[tokens,setTokens]=useState([]);
 const [provider,setProvider]=useState('airbnb'),[source,setSource]=useState(''),[exportUrl,setExportUrl]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  if(!propertyId)return;
  setBusy(true);setError('');
  try{const [a,b]=await Promise.all([hostingCalendar('list',{property_id:propertyId}),hostingCalendar('export_tokens',{property_id:propertyId})]);
   setConnections(a.items||[]);setTokens(b.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{load();},[propertyId]);
 const act=async(action,args,message)=>{
  setBusy(true);setError('');setNotice('');
  try{const result=await hostingCalendar(action,args);setNotice(message||result.note||'Saved');await load();return result;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const connect=async(e)=>{
  e.preventDefault();const result=await act('connect',{property_id:propertyId,provider,import_url:source},
   'Calendar feed connected. Automatic imports run once the scheduling secret is configured.');
  if(result)setSource('');
 };
 const createExport=async()=>{
  const result=await act('export_create',{property_id:propertyId});
  if(result)setExportUrl(result.calendar_url);
 };
 return <section className="space-y-4 text-white">
  <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={18}/>External booking calendar synchronization</h3>
  <p className="text-xs text-[#9FB6D1]">Two-way iCalendar: import blocked dates from trusted providers, and give those providers a revocable Content Connect X busy-calendar feed. Imported calendars never store third-party guest details.</p>
  {error&&<p className="rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
  {notice&&<p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
  <form className={panel+' space-y-3'} onSubmit={connect}>
   <h4 className="font-semibold">Import another booking calendar</h4>
   <label className="text-xs block">Provider<select className={input+' mt-1'} value={provider} onChange={e=>setProvider(e.target.value)}>
    <option value="airbnb">Airbnb</option><option value="vrbo">VRBO</option><option value="booking">Booking.com</option><option value="other">Approved other provider</option>
   </select></label>
   <label className="text-xs block">Private HTTPS calendar export URL<input className={input+' mt-1'} type="url" required value={source} onChange={e=>setSource(e.target.value)} placeholder="https://www.airbnb.com/calendar/ical/..."/></label>
   <button disabled={busy} className={button}><Link2 size={15} className="inline mr-1"/>Connect feed</button>
   <p className="text-xs text-[#9FB6D1]">Unapproved domains and HTTP redirects are rejected. Conflict notifications require host review, not silent overwrites.</p>
  </form>
  <div className={panel+' space-y-2'}>
   <h4 className="font-semibold">Connected calendars ({connections.length})</h4>
   {connections.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#30445D] py-3">
    <div><p className="text-sm font-semibold capitalize">{c.provider} · {c.status}</p><p className="text-xs text-[#9AB1CE]">{c.last_synced_at?'Last sync '+formatDate(c.last_synced_at):'Awaiting first import'} · {c.last_successful_count||0} busy intervals</p>
     {c.last_error&&<p className="text-xs text-amber-200">{c.last_error}</p>}</div>
    <div className="flex gap-2">
     <button className={button} disabled={busy} onClick={()=>act('sync_now',{id:c.id},'External calendar synchronized.')}>Sync now</button>
     <button className={button+' bg-red-800'} disabled={busy} onClick={()=>act('disconnect',{id:c.id},'Calendar disconnected; only its imported blocks were removed.')}>Disconnect</button>
    </div>
   </div>)}
   {!connections.length&&<p className="text-sm text-[#9CB3CD]">No external calendars linked yet.</p>}
  </div>
  <div className={panel+' space-y-3'}>
   <h4 className="font-semibold">Export private unavailable/busy calendar</h4>
   <p className="text-xs text-[#A3B7D1]">Use the generated link in external booking services. The URL is a bearer secret; only the busy date ranges are exposed, never addresses or guest details. Revoke it if shared accidentally.</p>
   <button className={button} disabled={busy} onClick={createExport}>Create revocable iCalendar URL</button>
   {exportUrl&&<div className="rounded-lg border border-blue-500/40 bg-blue-950/30 p-3 space-y-2">
     <p className="text-xs text-amber-200">Copy this link now. It is shown only once.</p>
     <input readOnly className={input+' font-mono'} value={exportUrl}/>
     <button className={button} onClick={()=>navigator.clipboard?.writeText(exportUrl)}>Copy URL</button>
   </div>}
   {tokens.map(t=><div className="flex items-center justify-between gap-2 border-t border-[#30445D] pt-2 text-xs" key={t.id}>
    <span>Created {formatDate(t.created_at)} · {t.revoked_at?'Revoked':'Active'}</span>
    {!t.revoked_at&&<button className="flex gap-1 items-center text-red-300" disabled={busy} onClick={()=>act('export_revoke',{id:t.id},'Calendar link revoked.')}>
     <Trash2 size={14}/>Revoke
    </button>}
   </div>)}
  </div>
 </section>;
}
