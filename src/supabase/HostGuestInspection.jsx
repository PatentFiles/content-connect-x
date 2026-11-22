/** Booking-scoped arrival inspection. Shared UI between Host ConnectX and CCX.
 * The backend authenticates the booking guest and restricts uploads to a
 * signed, private Storage path during the first 48 hours after check-in.
 */
import React,{useEffect,useState} from 'react';
import {Camera,ShieldCheck,ArrowLeft} from 'lucide-react';
const panel='rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5';
const field='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const primary='oh-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50';
const secondary='oh-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-3 text-sm';
export default function HostGuestInspection({booking,action,upload,onClose=()=>{}}){
 const [rooms,setRooms]=useState([]),[issues,setIssues]=useState([]);
 const [roomId,setRoomId]=useState(''),[description,setDescription]=useState(''),[file,setFile]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reload=async()=>{
  const [r,i]=await Promise.all([
   action('guest_issue_rooms',{booking_id:booking.id}),
   action('guest_issue_list',{booking_id:booking.id})
  ]);
  setRooms(r.items||[]);setIssues(i.items||[]);
 };
 useEffect(()=>{let live=true;void reload().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[booking.id]);
 const submit=async e=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(description.trim().length<10)throw Error('Describe the concern with at least ten characters.');
   if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024))
    throw Error('Use a JPEG, PNG or WebP photo smaller than 10 MB.');
   const result=await action('guest_issue_create',{
    booking_id:booking.id,room_id:roomId||null,description
   });
   const issueId=result.item?.id;
   if(!issueId)throw Error('Report was not created');
   if(file){
    try{
     const args={booking_id:booking.id,issue_id:issueId,mime_type:file.type};
     const {path,token}=await action('guest_issue_photo_token',args);
     await upload({path,token,file});
     await action('guest_issue_photo_register',{...args,path});
    }catch{
     setNotice('The condition report was recorded, but the photo was not attached. You can ask support to help preserve further evidence.');
     await reload();return;
    }
   }
   setDescription('');setRoomId('');setFile(null);
   await reload();
   setNotice('Property condition report and available evidence saved privately for the host.');
  }catch(e){setError(e.message||'Report unavailable');}finally{setBusy(false);}
 };
 return <section className="space-y-4" data-host-arrival-inspection="true">
  <div className={panel}>
   <button type="button" className={secondary} onClick={onClose}><ArrowLeft size={16}/> Back to booking</button>
   <h2 className="mt-4 text-xl font-bold">Check-in property inspection</h2>
   <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Walk around the venue on arrival. Document any condition issues with the room, a factual description and an optional photo. Reports are visible only to authorized booking/host participants and are retained for accountability.</p>
   <p className="mt-2 text-xs text-[var(--cc-text-secondary)]">This feature is available for confirmed, signed and paid stays, within 48 hours of check-in.</p>
  </div>
  <form className={panel+' space-y-3'} onSubmit={submit}>
   <label className="block text-sm">Room / area<select className={field} value={roomId} onChange={e=>setRoomId(e.target.value)}>
    <option value="">Other area / general issue</option>
    {rooms.map(room=><option key={room.id} value={room.id}>{room.name} · {room.category.replaceAll('_',' ')}</option>)}
   </select></label>
   <label className="block text-sm">What did you find?<textarea className={field} rows={4} required minLength={10} maxLength={1600}
    value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the surface, room and specific condition. Avoid unrelated private information."/></label>
   <label className="block text-sm">Photo evidence (optional)<input type="file" className={field} accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
   {notice&&<p role="status" className="text-sm text-[var(--cc-link)]">{notice}</p>}
   <button className={primary} disabled={busy||description.trim().length<10}><Camera size={17}/>{busy?'Submitting…':'Submit arrival report'}</button>
  </form>
  <div className={panel+' space-y-2'}>
   <h3 className="font-semibold">Your submitted condition records</h3>
   {!issues.length?<p className="text-sm text-[var(--cc-text-secondary)]">No arrival issues reported for this booking.</p>:
    issues.map(issue=><article key={issue.id} className="space-y-2 border-t border-[var(--cc-border)] py-3">
     <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16}/>{issue.status.replaceAll('_',' ')}</p>
     <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
     {issue.host_note&&<p className="text-xs text-[var(--cc-text-secondary)]">Host response: {issue.host_note}</p>}
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(issue.photos||[]).map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
       <img src={photo.url} alt="Arrival condition evidence" className="aspect-video w-full rounded-lg object-cover"/></a>)}
     </div>
    </article>)}
  </div>
 </section>;
}
