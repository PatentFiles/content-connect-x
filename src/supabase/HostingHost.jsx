/**
 * Host dashboard and operations, adapted to the CCX Supabase schema.
 * Property approval and private images are server-controlled, not UI toggles.
 */
import React,{useCallback,useEffect,useState} from 'react';
import { supabase } from '@/api/supabaseClient';
import {Building2,Plus,UploadCloud,CalendarDays,ClipboardCheck,ImageIcon,RefreshCw,Trash2,Settings2,ShieldCheck,Check,Save,Film, X} from 'lucide-react';
import {hostingAction,uploadHostingPhoto,uploadHostingVideo,rentalCategories,rentalAmenities,rentalUses,usd,dateTime} from './hostingApi';
import HostingHostVerification from './HostingHostVerification';
import HostingBookingOperations from './HostingBookingOperations';
import HostingAdminOperations from './HostingAdminOperations';
import HostingPricingManager from './HostingPricingManager';
import HostingEquipmentManager from './HostingEquipmentManager';
import HostingCalendarManager from './HostingCalendarManager';
import HostingWorkforceManager from './HostingWorkforceManager';
import HostingSuitabilityManager from './HostingSuitabilityManager';
const panel='ccx-surface p-5';
const input='w-full rounded-xl border border-[#34465E] bg-[#0B1422] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const button='rounded-xl ccx-action-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary='rounded-xl border border-[#42536A] bg-[#1F2D40] px-4 py-2.5 text-sm text-white disabled:opacity-50';
const muted='text-sm text-[#A7B9D0]';
const blank={title:'',description:'',category:'film_studio',city:'',state:'',country:'United States',capacity:4,minimum_hours:6,hourly_rate:100,cleaning_fee_cents:0,min_notice_hours:24,preferred_cleaning_minutes:120,cancellation_policy:'flexible',deposit_percent:0,required_insurance:false,rules:'',amenities:[],permitted_uses:[]};

function CheckboxGrid({options,values=[],update}) {
 return <div className="grid gap-2 sm:grid-cols-2">{options.map(([id,label])=>{
  const selected=values.includes(id);
  return <button key={id} type="button" role="checkbox" aria-checked={selected}
    onClick={()=>update(selected?values.filter(v=>v!==id):[...values,id])}
    className={'oh-option-tile flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm '+(selected?'oh-option-selected':'oh-option-idle')}>
    <span>{label}</span><span className="oh-option-check" aria-hidden="true">{selected?<Check size={15}/>:null}</span>
   </button>;
 })}</div>;
}

export default function HostingHost({paid=false,isAdmin=false,reviewMode=false,user,brand='content_connect'}) {
 const [listings,setListings]=useState([]);
 const [hostMetrics,setHostMetrics]=useState(null);
 const [pending,setPending]=useState([]);
 const [pendingImages,setPendingImages]=useState([]);
 const [pendingVideos,setPendingVideos]=useState([]);
 const [reservations,setReservations]=useState([]);
 const [selected,setSelected]=useState('');
 const [editing,setEditing]=useState(false);
 const editorRef=React.useRef(null);
 const defaultsRef=React.useRef(null);
 useEffect(()=>{
   const target=showDefaults?defaultsRef.current:editing?editorRef.current:null;
   if(!target)return;
   const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
 },[editing,selected,showDefaults]);
 const [defaults,setDefaults]=useState(blank);
 const [defaultForm,setDefaultForm]=useState(blank);
 const [showDefaults,setShowDefaults]=useState(false);
 const [form,setForm]=useState(blank);
 const [image,setImage]=useState(null);
 const [caption,setCaption]=useState('');
 const [video,setVideo]=useState(null);
 const [videoCaption,setVideoCaption]=useState('');
 const [blocks,setBlocks]=useState([]);
 const [blockStart,setBlockStart]=useState('');
 const [blockEnd,setBlockEnd]=useState('');
 const [turnovers,setTurnovers]=useState([]);
 const [turnoverDue,setTurnoverDue]=useState('');
 const [privateDetails,setPrivateDetails]=useState({exact_address:'',entry_instructions:'',internal_notes:''});
 const [inspectionPhotos,setInspectionPhotos]=useState({});
 const [inspectionFile,setInspectionFile]=useState(null);
 const [inspectionPhase,setInspectionPhase]=useState('before');
 const [reviewQueue,setReviewQueue]=useState([]);
 const [expandedBooking,setExpandedBooking]=useState('');
 const [managementTab,setManagementTab]=useState('pricing');
 const [icalFile,setIcalFile]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [approvalChecked,setApprovalChecked]=useState(false);

 const load=useCallback(async()=>{
   setBusy(true);setError('');
   try{
    const [mine,bookings,moderation,defaultsResult]=await Promise.all([
      paid?hostingAction('my_listings'):Promise.resolve({items:[]}),
      paid?hostingAction('host_bookings'):Promise.resolve({items:[]}),
      isAdmin?hostingAction('admin_queue'):Promise.resolve({items:[],pending_images:[],pending_videos:[]}),
      paid&&!reviewMode?hostingAction('host_defaults_get'):Promise.resolve({settings:null}),
    ]);
    if(defaultsResult.settings){
      const next={...blank,...defaultsResult.settings};
      setDefaults(next);setDefaultForm(next);
    }
    setListings(mine.items||[]);setReservations(bookings.items||[]);
    if(!reviewMode&&paid){
      const report=await hostingAction('host_dashboard_summary').catch(()=>null);
      setHostMetrics(report);
    }
    setPending(moderation.items||[]);setPendingImages(moderation.pending_images||[]);setPendingVideos(moderation.pending_videos||[]);
    if(isAdmin){const reviews=await hostingAction('admin_review_queue');setReviewQueue(reviews.items||[]);}
   }catch(e){setError(e.message);}finally{setBusy(false);}
 },[paid,isAdmin,reviewMode]);
 useEffect(()=>{load();},[load]);

 const extra=useCallback(async(id)=>{
  if(!id){setBlocks([]);setTurnovers([]);setPrivateDetails({exact_address:'',entry_instructions:'',internal_notes:''});return;}
  try{
   const [b,t,details]=await Promise.all([
    hostingAction('host_blocks',{id}),paid?hostingAction('turnover_list',{id}):Promise.resolve({items:[]}),hostingAction('host_private_get',{id}),
   ]);
   setBlocks(b.items||[]);setTurnovers(t.items||[]);setPrivateDetails(details.item||{exact_address:'',entry_instructions:'',internal_notes:''});
  }catch(e){setError(e.message);}
 },[paid]);

 const selectListing=async(item)=>{
   setSelected(item?.id||'');setEditing(true);setShowDefaults(false);setError('');setNotice('');
   // Every new listing inherits editable host defaults, never another property's address.
   setForm(item?{...blank,...item,amenities:item.amenities||[],permitted_uses:item.permitted_uses||[]}:
     {...blank,...defaults,amenities:[...(defaults.amenities||[])],permitted_uses:[...(defaults.permitted_uses||[])]});
   setImage(null);setCaption('');setVideo(null);setVideoCaption('');setApprovalChecked(false);
   setPrivateDetails({exact_address:'',entry_instructions:'',internal_notes:''});
   await extra(item?.id||'');
 };
 const closeEditor=()=>{setEditing(false);setSelected('');setImage(null);setVideo(null);setError('');setNotice('');};
 const saveDefaults=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
    const result=await hostingAction('host_defaults_set',{settings:defaultForm});
    setDefaults({...blank,...result.settings});setDefaultForm({...blank,...result.settings});
    setShowDefaults(false);setNotice('Host defaults saved. They will prefill future listings; existing listings are unchanged.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const field=(name,value)=>setForm(current=>({...current,[name]:value}));
 const mutate=async(action,args,message)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const result=await hostingAction(action,args);
   setNotice(message||result.note||'Saved');await load();
   if(selected)await extra(selected);
   return result;
  }catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const save=async(e)=>{
  e.preventDefault();
  if(!selected&&privateDetails.exact_address.trim().length<8){
    setError('Enter the full private street address before creating this property. It will not appear publicly.');return;
  }
  const result=await mutate(selected?'host_update':'host_create',{...form,source_brand:brand,...(selected?{id:selected}:{})},
    selected?'Listing saved as draft. Resubmit for approval.':'Private draft created. Add approved media and submit for review.');
  if(result){
    const chosen=result.item?.id||selected;
    try{
      if(!selected)await hostingAction('host_private_details',{id:chosen,...privateDetails});
      // Optional queued media makes the first-time creation flow work like a
      // property wizard, without sharing unreviewed files with visitors.
      if(image)await uploadHostingPhoto(chosen,image,caption);
      if(video)await uploadHostingVideo(chosen,video,videoCaption);
    }catch(e){setError('The draft was saved, but address/media setup needs attention: '+e.message);}
    const item=(await hostingAction('my_listings')).items.find(v=>v.id===chosen);
    await selectListing(item||{...form,id:chosen,status:'draft'});
    await load();
  }
 };
 const upload=async(e)=>{
  e.preventDefault();
  if(!selected||!image)return;
  setBusy(true);setError('');setNotice('');
  try{
    const r=await uploadHostingPhoto(selected,image,caption);
    setImage(null);setCaption('');setNotice(r.note||'Private upload received.');
    await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const uploadVideo=async(e)=>{
  e.preventDefault();
  if(!selected||!video)return;
  setBusy(true);setError('');setNotice('');
  try{
    const result=await uploadHostingVideo(selected,video,videoCaption);
    setVideo(null);setVideoCaption('');setNotice(result.note||'Private video uploaded for review.');
    await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const reviewVideo=async(id,status)=>{
  if(!approvalChecked){setError('Confirm independent human review first.');return;}
  await mutate('admin_video_review',{id,status,human_review_confirmed:true},'Video review recorded.');
 };
 const block=async(e)=>{
  e.preventDefault();
  const r=await mutate('host_block_dates',{id:selected,starts_at:new Date(blockStart).toISOString(),ends_at:new Date(blockEnd).toISOString()},'Time blocked.');
  if(r){setBlockStart('');setBlockEnd('');}
 };
 const importCalendar=async()=>{
  if(!icalFile||!selected)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(icalFile.size>200000)throw new Error('Calendar must be smaller than 200 KB.');
   const text=await icalFile.text();
   const result=await hostingAction('host_ical_import',{id:selected,ics:text});
   setNotice('Imported '+result.imported+' dates; skipped '+result.ignored+' unsupported or conflicting events.');
   setIcalFile(null);await extra(selected);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const exportCalendar=()=>{
  if(!selected)return;
  const utc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const blocksOnProperty=blocks.map(b=>({id:b.id,starts_at:b.starts_at,ends_at:b.ends_at}));
  const bookingsOnProperty=reservations.filter(b=>b.property_id===selected&&['requested','accepted'].includes(b.status));
  const events=[...blocksOnProperty,...bookingsOnProperty].map(x=>[
   'BEGIN:VEVENT','UID:'+x.id+'@contentconnectx.com','DTSTAMP:'+utc(new Date()),
   'DTSTART:'+utc(x.starts_at),'DTEND:'+utc(x.ends_at),
   'SUMMARY:Unavailable for filming','END:VEVENT'
  ].join('\r\n')).join('\r\n');
  const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Content Connect X//Private Hosting Calendar//EN\r\n'+events+'\r\nEND:VCALENDAR\r\n';
  const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='contentconnectx-hosting.ics';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const newTurnover=async()=>{
  const r=await mutate('turnover_create',{id:selected,due_at:turnoverDue?new Date(turnoverDue).toISOString():null},'Turnover checklist created.');
  if(r)setTurnoverDue('');
 };
 const saveAddress=async(event)=>{
  event.preventDefault();
  await mutate('host_private_details',{id:selected,...privateDetails},'Private location details saved.');
 };
 const showInspection=async(id)=>{
  try{
   const r=await hostingAction('turnover_photos',{id});
   setInspectionPhotos(current=>({...current,[id]:r.items||[]}));
  }catch(e){setError(e.message);}
 };
 const uploadInspection=async(turnoverId)=>{
  if(!inspectionFile)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(inspectionFile.type)||inspectionFile.size>10*1024*1024)throw new Error('Select a JPG, PNG or WebP under 10MB.');
   const granted=await hostingAction('turnover_upload_token',{id:turnoverId,mime_type:inspectionFile.type});
   const {error:uploadError}=await supabase.storage.from('property-inspections').uploadToSignedUrl(granted.path,granted.token,inspectionFile,{contentType:inspectionFile.type,upsert:false});
   if(uploadError)throw uploadError;
   await hostingAction('turnover_upload_register',{id:turnoverId,path:granted.path,phase:inspectionPhase});
   setInspectionFile(null);setNotice('Private condition photo saved.');
   await showInspection(turnoverId);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const reviewGuest=async(id,status)=>{
  if(!approvalChecked)return setError('Confirm manual review first.');
  await mutate('admin_review_decide',{id,status,human_review_confirmed:true},'Guest review moderated.');
 };
 const completeBooking=async(id)=>{
  if(!window.confirm('Confirm this rental has ended and mark the booking complete?'))return;
  await mutate('host_booking_complete',{id},'Booking completed. The guest can now leave a review.');
 };
 const reviewImage=async(id,status)=>{
  if(!approvalChecked)return setError('Confirm manual rights and content review first.');
  await mutate('admin_image_review',{id,status,human_review_confirmed:true},'Photo reviewed.');
 };
 const reviewListing=async(id,status)=>{
  if(!approvalChecked)return setError('Confirm the venue and permitted-use review first.');
  await mutate('admin_listing_review',{id,status,human_review_confirmed:true},'Listing review saved.');
 };
 const own=listings.find(v=>v.id===selected);
 return <section className="space-y-5">
  <header className="flex flex-wrap justify-between gap-2"><div><h2 className="text-2xl font-semibold">{reviewMode?'Hosting approval queue':'Manage your hosting business'}</h2><p className="mt-1 text-sm text-[#A7BAD3]">{reviewMode?'Review uploaded photos and listings before publication.':'Create properties, manage guests and maintain your location between shoots.'}</p></div><button className={secondary+' flex items-center gap-2'} disabled={busy} onClick={load}><RefreshCw size={16}/>Refresh</button></header>
  {!reviewMode&&hostMetrics&&<section aria-label="Your host performance overview" className="space-y-3">
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
    {[
      ['Properties',hostMetrics.properties],['30-day views',hostMetrics.views_30d],
      ['New booking requests',hostMetrics.booking_requests],['Upcoming shoots',hostMetrics.upcoming],
      ['Booking conversations',hostMetrics.conversations]
    ].map(([label,value])=><div className="oh-host-metric" key={label}>
      <p className="text-xs text-[#A9C4E0]">{label}</p><strong className="text-3xl font-bold text-white">{Number(value||0).toLocaleString()}</strong>
     </div>)}
   </div>
   {hostMetrics.by_property?.length>0&&<details className="oh-host-listing-breakdown">
    <summary>Views by property (last 30 days)</summary>
    <div className="mt-3 space-y-2">{hostMetrics.by_property.map(item=><p className="flex justify-between gap-3 text-sm" key={item.id}>
      <span className="truncate">{item.title}</span><strong>{item.views_30d||0} views</strong>
    </p>)}</div>
   </details>}
   <p className="text-xs text-[#95AFC9]">Views are unique daily signed-in listing visits; conversations show booking threads, not unread messages. Figures reflect recorded activity only.</p>
  </section>}
  {error&&<div role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</div>}
  {notice&&<div role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</div>}
  {reviewMode&&isAdmin?<div className="space-y-5">
    <label className={panel+' flex items-start gap-3 text-sm'}><input type="checkbox" className="mt-1" checked={approvalChecked} onChange={e=>setApprovalChecked(e.target.checked)}/>I have independently checked the image/listing, relevant rights and permissions, declared production use and applicable publication procedures. I am not self-approving a listing.</label>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Private photos awaiting approval ({pendingImages.length})</h3>
      {pendingImages.map(pic=><div key={pic.id} className="flex flex-wrap items-center gap-4 border-b border-[#34465E] pb-3">
        {pic.url?<img className="h-24 w-32 rounded-lg object-cover" src={pic.url} alt="Private property review"/>:<ImageIcon size={32}/>}
        <div className="flex-1 min-w-[200px]"><p className="break-all text-xs text-[#AABDD3]">Listing {pic.property_id}</p><div className="mt-3 flex gap-2">
          <button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewImage(pic.id,'approved')}>Approve photo</button>
          <button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewImage(pic.id,'rejected')}>Reject</button></div>
        </div>
      </div>)}
      {!pendingImages.length&&<p className={muted}>No pending property photos.</p>}
    </div>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Private videos awaiting approval ({pendingVideos.length})</h3>
      {pendingVideos.map(video=><div key={video.id} className="flex flex-wrap items-center gap-4 border-b border-[#34465E] pb-3">
        {video.url?<video className="h-28 w-44 rounded-lg bg-black object-cover" src={video.url} controls preload="metadata" playsInline aria-label="Private listing video pending review"/>:<Film size={32}/>}
        <div className="min-w-[180px] flex-1"><p className="text-xs text-[#AAC6E6]">Property {video.property_id}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewVideo(video.id,'approved')}>Approve video</button>
          <button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewVideo(video.id,'rejected')}>Reject video</button></div>
        </div>
      </div>)}
      {!pendingVideos.length&&<p className={muted}>No pending property videos.</p>}
    </div>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Property listings awaiting review ({pending.length})</h3>
      {pending.map(p=><div key={p.id} className="border-b border-[#34465E] pb-4">
        <div className="flex gap-3">
          {p.photos?.[0]?.url?<img alt={p.title} src={p.photos[0].url} className="h-24 w-28 rounded-lg object-cover"/>:<div className="grid h-24 w-28 place-items-center rounded-lg bg-[#21344C]"><ImageIcon/></div>}
          <div><h4 className="font-semibold">{p.title}</h4><p className={muted}>{p.city}, {p.country} · {usd(p.hourly_rate)}/hr</p><p className="text-xs text-[#AABDD3]">Permitted: {(p.permitted_uses||[]).join(', ')}</p></div>
        </div>
        <p className="mt-2 text-xs text-[#A7BAD3]">Rules: {p.rules||'None specified'}</p>
        <div className="mt-3 flex gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewListing(p.id,'active')}>Publish approved listing</button><button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewListing(p.id,'paused')}>Return for changes</button></div>
      </div>)}
      {!pending.length&&<p className={muted}>No listings waiting for review.</p>}
    </div>
    <div className={panel+' space-y-3'}><h3 className="font-semibold">Guest reviews awaiting publication ({reviewQueue.length})</h3>
      {reviewQueue.map(review=><div key={review.id} className="border-b border-[#34465E] pb-3"><p className="text-sm font-semibold">{review.rating}/5 stars</p><p className="text-sm whitespace-pre-wrap">{review.description}</p><p className="text-xs text-[#829AB5]">Property {review.property_id}</p><div className="mt-3 flex gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewGuest(review.id,'published')}>Publish</button><button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewGuest(review.id,'rejected')}>Reject</button></div></div>)}
      {!reviewQueue.length&&<p className={muted}>No pending guest reviews.</p>}
    </div>
  </div>:<>
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className={panel+' h-fit space-y-3 p-4'}>
        <h3 className="font-semibold flex items-center gap-2"><Building2 size={18}/>Your listings ({listings.length})</h3>
        <button type="button" className={button+' flex w-full items-center justify-center gap-2'} onClick={()=>selectListing(null)}><Plus size={17}/>New Space</button>
        <button type="button" className={secondary+' flex w-full items-center justify-center gap-2'} onClick={()=>{
          setShowDefaults(true);setEditing(false);setSelected('');setError('');setNotice('');
        }}><Settings2 size={17}/>Set My Default Rules</button>
        {listings.map(item=><button type="button" key={item.id} onClick={()=>selectListing(item)}
          className={'oh-host-listing-tile block w-full overflow-hidden rounded-2xl border text-left '+(selected===item.id&&editing?'border-[#7BE4F7] ring-1 ring-[#6BDFFA]/50':'border-[#31445C]')}>
          {item.photos?.[0]?.url?<img alt={item.title} className="h-32 w-full object-cover" src={item.photos[0].url} loading="lazy"/>:
           <div className="flex h-32 items-center justify-center bg-[#182940]"><ImageIcon size={30} className="text-[#8BAAC7]"/></div>}
          <div className="p-3"><p className="truncate text-sm font-bold">{item.title}</p>
            <p className="mt-1 truncate text-xs text-[#A9C3DE]">{[item.city,item.state,item.country].filter(Boolean).join(', ')}</p>
            <span className="mt-2 inline-flex rounded-full bg-[#274064] px-2 py-1 text-[11px] capitalize text-[#B6D5F2]">{(item.status||'draft').replaceAll('_',' ')}</span>
            <span className="ml-2 text-xs text-[#80DDEE]">{usd(item.hourly_rate)}/hr</span>
          </div>
        </button>)}
      </aside>
      <div className="space-y-5">
        {showDefaults&&<section ref={defaultsRef} className={panel+' space-y-4 scroll-mt-24'} aria-label="Reusable host listing defaults">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="text-xl font-bold">Default Rules & Pricing</h3>
              <p className={muted}>These prefill future listings. Each property can override any rule independently. Addresses and titles are always property-specific.</p></div>
            <button type="button" className={secondary} onClick={()=>setShowDefaults(false)} aria-label="Close defaults"><X size={17}/></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Default property type<select className={input+' mt-1'} value={defaultForm.category} onChange={e=>setDefaultForm(v=>({...v,category:e.target.value}))}>{rentalCategories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="text-sm">Default hourly rate ($)<input type="number" min="1" max="100000" className={input+' mt-1'} value={defaultForm.hourly_rate} onChange={e=>setDefaultForm(v=>({...v,hourly_rate:Number(e.target.value)}))}/></label>
            <label className="text-sm">Default crew capacity<input type="number" min="1" max="500" className={input+' mt-1'} value={defaultForm.capacity} onChange={e=>setDefaultForm(v=>({...v,capacity:Number(e.target.value)}))}/></label>
            <label className="text-sm">Default cleaning fee ($)<input type="number" min="0" max="100000" step="0.01" className={input+' mt-1'} value={(defaultForm.cleaning_fee_cents||0)/100} onChange={e=>setDefaultForm(v=>({...v,cleaning_fee_cents:Math.round(Number(e.target.value)*100)}))}/></label>
            <label className="text-sm">Minimum booking notice (hours)<input type="number" min="0" max="720" className={input+' mt-1'} value={defaultForm.min_notice_hours??24} onChange={e=>setDefaultForm(v=>({...v,min_notice_hours:Number(e.target.value)}))}/></label>
            <label className="text-sm">Cleaning/turnover buffer (minutes)<input type="number" min="0" max="1440" className={input+' mt-1'} value={defaultForm.preferred_cleaning_minutes??120} onChange={e=>setDefaultForm(v=>({...v,preferred_cleaning_minutes:Number(e.target.value)}))}/></label>
            <label className="text-sm">Minimum hours<input type="number" min="1" max="72" className={input+' mt-1'} value={defaultForm.minimum_hours} onChange={e=>setDefaultForm(v=>({...v,minimum_hours:Number(e.target.value)}))}/></label>
            <label className="text-sm">Cancellation policy<select className={input+' mt-1'} value={defaultForm.cancellation_policy} onChange={e=>setDefaultForm(v=>({...v,cancellation_policy:e.target.value}))}>
              {['flexible','moderate','strict'].map(v=><option value={v} key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Deposit percent<input type="number" min="0" max="50" className={input+' mt-1'} value={defaultForm.deposit_percent} onChange={e=>setDefaultForm(v=>({...v,deposit_percent:Number(e.target.value)}))}/></label>
          </div>
          <label className="block text-sm">Default house rules<textarea className={input+' mt-1'} rows={4} value={defaultForm.rules||''} maxLength={3000} onChange={e=>setDefaultForm(v=>({...v,rules:e.target.value}))}/></label>
          <button type="button" role="checkbox" aria-checked={!!defaultForm.required_insurance}
            className={'oh-option-tile flex w-full items-center justify-between rounded-xl border p-3 text-left '+(defaultForm.required_insurance?'oh-option-selected':'oh-option-idle')}
            onClick={()=>setDefaultForm(v=>({...v,required_insurance:!v.required_insurance}))}>Require production insurance <span className="oh-option-check">{defaultForm.required_insurance?<Check size={15}/>:null}</span></button>
          <div><h4 className="mb-2 font-semibold">Default amenities</h4><CheckboxGrid values={defaultForm.amenities||[]} options={rentalAmenities}
            update={values=>setDefaultForm(v=>({...v,amenities:values}))}/></div>
          <div><h4 className="mb-2 font-semibold">Default allowed productions</h4><CheckboxGrid values={defaultForm.permitted_uses||[]} options={rentalUses}
            update={values=>setDefaultForm(v=>({...v,permitted_uses:values}))}/></div>
          <button type="button" disabled={busy} className={button+' inline-flex items-center gap-2'} onClick={saveDefaults}><Save size={17}/>Save My Defaults</button>
        </section>}
        {!editing&&!showDefaults&&<section className={panel+' space-y-4 text-center'}>
          <Building2 size={42} className="mx-auto text-[#79DFFE]"/>
          <h3 className="text-2xl font-bold">Your properties, all in one place</h3>
          <p className="mx-auto max-w-xl text-sm text-[#ADC6E0]">Select a property thumbnail to manage its listing, images, videos, availability and booking rules—or create a new space using your saved defaults.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button type="button" className={button} onClick={()=>selectListing(null)}>Create a New Space</button>
            <button type="button" className={secondary} onClick={()=>setShowDefaults(true)}>Set Default Rules</button>
          </div>
        </section>}
        {editing&&<form ref={editorRef} onSubmit={save} className={panel+' space-y-4 scroll-mt-24'}>
          <div className="flex justify-between gap-2 items-center"><h3 className="text-lg font-semibold">{selected?'Edit Property':'Add a New Property'}</h3>
            <button type="button" className={secondary+' inline-flex items-center gap-2'} onClick={closeEditor}><X size={16}/>Close</button>
          </div>
          <p className="text-xs text-[#A6C4E0]">{selected?'Changes to published listings may require a new review.':'Start with the saved host defaults, then customize this one property.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Listing title<input required minLength={5} maxLength={140} className={input+' mt-1'} value={form.title} onChange={e=>field('title',e.target.value)}/></label>
            <label className="text-sm">Location type<select className={input+' mt-1'} value={form.category} onChange={e=>field('category',e.target.value)}>{rentalCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
            <label className="text-sm">City<input required className={input+' mt-1'} value={form.city} onChange={e=>field('city',e.target.value)}/></label>
            <label className="text-sm">State/region<input className={input+' mt-1'} value={form.state||''} onChange={e=>field('state',e.target.value)}/></label>
            <label className="text-sm">Country<input required className={input+' mt-1'} value={form.country} onChange={e=>field('country',e.target.value)}/></label>
            {!selected&&<label className="text-sm sm:col-span-2">Full street address (private, required)
              <input required minLength={8} maxLength={400} autoComplete="street-address"
                className={input+' mt-1'} value={privateDetails.exact_address||''} onChange={e=>setPrivateDetails(v=>({...v,exact_address:e.target.value}))}
                placeholder="Street number, street name, unit number"/></label>}
            <label className="text-sm">Hourly rate (USD)<input className={input+' mt-1'} type="number" min={1} max={100000} value={form.hourly_rate} onChange={e=>field('hourly_rate',Number(e.target.value))}/></label>
            <label className="text-sm">Cleaning fee (USD)<input className={input+' mt-1'} type="number" min={0} max={100000} step="0.01" value={(form.cleaning_fee_cents||0)/100} onChange={e=>field('cleaning_fee_cents',Math.round(Number(e.target.value)*100))}/></label>
            <label className="text-sm">Minimum booking notice (hours)<input className={input+' mt-1'} type="number" min={0} max={720} value={form.min_notice_hours??24} onChange={e=>field('min_notice_hours',Number(e.target.value))}/></label>
            <label className="text-sm">Cleaning/turnover buffer (minutes)<input className={input+' mt-1'} type="number" min={0} max={1440} value={form.preferred_cleaning_minutes??120} onChange={e=>field('preferred_cleaning_minutes',Number(e.target.value))}/></label>
            <label className="text-sm">Maximum crew size<input className={input+' mt-1'} type="number" min={1} max={500} value={form.capacity} onChange={e=>field('capacity',Number(e.target.value))}/></label>
            <label className="text-sm">Minimum booking duration
             <input className={input+' mt-1'} type="number" min={1} max={72} value={form.minimum_hours} onChange={e=>field('minimum_hours',Number(e.target.value))}/>
             <span className="mt-2 flex flex-wrap gap-1">{[2,4,6,12,24,48,72].map(hours=><button type="button" key={hours} className={'rounded-lg border px-2 py-1 text-xs '+(form.minimum_hours===hours?'border-[#73E1FA] bg-[#225B84]':'border-[#374A68] text-[#B0D0E8]')} onClick={()=>field('minimum_hours',hours)}>{hours}h</button>)}</span>
             <span className="mt-1 block text-xs text-[#9AB5D1]">Set a 6-hour, 12-hour, full-day (24-hour), or multi-day minimum. Current booking quotes support up to 72 hours; overnight check-in/out presets require a later pricing-engine upgrade.</span>
            </label>
            <label className="text-sm">Cancellation policy<select className={input+' mt-1'} value={form.cancellation_policy||'flexible'} onChange={e=>field('cancellation_policy',e.target.value)}>
              <option value="flexible">Flexible (24h refund window)</option><option value="moderate">Moderate (72h/24h)</option><option value="strict">Strict (7-day/72h)</option>
            </select></label>
            <label className="text-sm">Proposed security deposit (% of rental)<input className={input+' mt-1'} type="number" min={0} max={50} value={form.deposit_percent||0} onChange={e=>field('deposit_percent',Number(e.target.value))}/></label>
            <button type="button" role="checkbox" aria-checked={Boolean(form.required_insurance)}
              className={'oh-option-tile sm:col-span-2 flex w-full items-center justify-between rounded-xl border p-3 text-left '+(form.required_insurance?'oh-option-selected':'oh-option-idle')}
              onClick={()=>field('required_insurance',!form.required_insurance)}>Require production insurance evidence
              <span className="oh-option-check" aria-hidden="true">{form.required_insurance?<Check size={15}/>:null}</span></button>
          </div>
          <label className="block text-sm">Full description<textarea className={input+' mt-1'} rows={4} maxLength={4000} value={form.description} onChange={e=>field('description',e.target.value)}/></label>
          <label className="block text-sm">Host rules and restrictions<textarea className={input+' mt-1'} rows={3} maxLength={3000} value={form.rules} onChange={e=>field('rules',e.target.value)}/></label>
          <div><h4 className="mb-2 text-sm font-semibold">Production amenities</h4><CheckboxGrid values={form.amenities} options={rentalAmenities} update={v=>field('amenities',v)}/></div>
          <div><h4 className="mb-2 text-sm font-semibold">Permitted activities — set deliberately</h4><p className="mb-3 text-xs text-[#AABED8]">Select exactly what you are comfortable allowing. Nude photography and explicit adult videos are separate opt-ins; guests should never assume either is permitted. You must have written owner authority for each approved use.</p><CheckboxGrid values={form.permitted_uses} options={rentalUses} update={v=>field('permitted_uses',v)}/></div>
          {!selected&&<div className="oh-media-queue grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Property cover photo (optional at draft stage)
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
            <label className="text-sm">Property walkthrough video (optional, MP4/WebM, up to 40MB)
              <input type="file" accept="video/mp4,video/webm" className="mt-2 block w-full text-xs" onChange={e=>setVideo(e.target.files?.[0]||null)}/></label>
          </div>}
          <button disabled={busy||!paid||!form.permitted_uses.length} className={button}>{selected?'Save Property Changes':'Create Private Draft & Continue'}</button>
          <p className="text-xs text-[#AABED8]">Your exact address is saved privately and never included in public property cards or the area map.</p>
        </form>}

        {selected&&<HostingHostVerification propertyId={selected} requiredInsurance={Boolean(own?.required_insurance)}/>}
        {selected&&<section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              ['pricing','Advanced pricing'],['equipment','Equipment and add-ons'],
              ['calendar','External calendars'],['workforce','Cleaning and staff'],['suitability','Production suitability']
            ].map(([id,title])=><button key={id} type="button" className={managementTab===id?button:secondary}
              onClick={()=>setManagementTab(id)}>{title}</button>)}
          </div>
          {managementTab==='pricing'&&own&&<HostingPricingManager property={own}/>}
          {managementTab==='equipment'&&<HostingEquipmentManager propertyId={selected}/>}
          {managementTab==='calendar'&&<HostingCalendarManager propertyId={selected}/>}
          {managementTab==='workforce'&&<HostingWorkforceManager propertyId={selected}/>}
          {managementTab==='suitability'&&<HostingSuitabilityManager propertyId={selected}/>}
        </section>}
        {selected&&<form onSubmit={saveAddress} className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={18}/>Private address and access rules</h3>
          <p className={muted}>Never displayed in public search. Entry instructions require an accepted booking, a signed rental agreement, confirmed payment and an authorized attendee.</p>
          <label className="text-sm block">Exact street address<input className={input+' mt-1'} required minLength={8} maxLength={400} value={privateDetails.exact_address||''} onChange={e=>setPrivateDetails(v=>({...v,exact_address:e.target.value}))}/></label>
          <label className="text-sm block">Guest entry instructions<textarea rows={3} maxLength={1500} className={input+' mt-1'} value={privateDetails.entry_instructions||''} onChange={e=>setPrivateDetails(v=>({...v,entry_instructions:e.target.value}))}/></label>
          <label className="text-sm block">Private host notes<textarea rows={2} maxLength={1500} className={input+' mt-1'} value={privateDetails.internal_notes||''} onChange={e=>setPrivateDetails(v=>({...v,internal_notes:e.target.value}))}/></label>
          <button className={button} disabled={busy}>Save protected address</button>
        </form>}
        {selected&&<div className={panel+' space-y-4'}>
          <h3 className="flex items-center gap-2 font-semibold"><UploadCloud size={18}/>Property photo gallery</h3>
          <p className={muted}>Upload up to 20 JPEG/PNG/WebP images. Each image remains private until an administrator approves it.</p>
          <div className="grid grid-cols-3 gap-2">{(own?.photos||[]).map(photo=><div key={photo.id} className="relative"><img alt={photo.caption||'Private listing photo'} src={photo.url} className="h-28 w-full rounded-lg object-cover"/><span className="absolute bottom-1 left-1 rounded bg-[#101926]/90 px-1 py-0.5 text-[10px]">{photo.status}</span><button className="absolute right-1 top-1 rounded-full bg-red-900 p-1" onClick={()=>mutate('host_photo_delete',{id:photo.id},'Photo removed.')}><Trash2 size={13}/></button></div>)}</div>
          <form onSubmit={upload} className="flex flex-wrap items-end gap-3"><label className="text-sm">Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)} className="mt-1 block text-xs"/></label><label className="flex-1 text-sm">Caption<input className={input+' mt-1'} value={caption} onChange={e=>setCaption(e.target.value)} maxLength={250}/></label><button disabled={busy||!image} className={button}>Upload private image</button></form>
          <div className="border-t border-[#354662] pt-5 space-y-3">
            <h3 className="flex items-center gap-2 font-semibold"><Film size={18}/>Property Walkthrough Videos</h3>
            <p className={muted}>Upload up to five short MP4/WebM videos (40MB each). Unreviewed videos are visible only to the owner and authorized moderators; approved videos appear on the property detail page.</p>
            <div className="grid gap-3 sm:grid-cols-2">{(own?.videos||[]).map(v=>
              <div key={v.id} className="relative overflow-hidden rounded-xl border border-[#395071] bg-[#07111F]">
                {v.url?<video controls preload="metadata" playsInline className="h-40 w-full object-cover" src={v.url} aria-label={v.caption||'Property walkthrough'}/>:<div className="grid h-40 place-items-center"><Film/></div>}
                <div className="flex justify-between gap-2 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs">{v.caption||'Property video'}</p><p className="text-xs capitalize text-[#88D8F1]">{v.status}</p></div>
                  <button type="button" className="rounded-full bg-red-950 p-2" aria-label="Delete video" onClick={()=>mutate('host_video_delete',{id:v.id},'Video deleted')}><Trash2 size={15}/></button>
                </div>
              </div>)}</div>
            <form onSubmit={uploadVideo} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-sm">MP4/WebM video<input type="file" accept="video/mp4,video/webm" className="mt-2 block w-full text-xs" onChange={e=>setVideo(e.target.files?.[0]||null)}/></label>
              <label className="text-sm">Video caption<input className={input+' mt-1'} maxLength={250} value={videoCaption} onChange={e=>setVideoCaption(e.target.value)}/></label>
              <button disabled={busy||!video} className={button}>Upload Video</button>
            </form>
          </div>
          <button type="button" className={button} disabled={busy||!own?.photos?.length} onClick={()=>mutate('host_submit',{id:selected},'Listing submitted for human approval.')}>Submit listing for review</button>
        </div>}

        {selected&&<div className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><CalendarDays size={18}/>Blackout dates</h3>
          <form onSubmit={block} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm">From<input className={input+' mt-1'} type="datetime-local" required value={blockStart} onChange={e=>setBlockStart(e.target.value)}/></label><label className="text-sm">To<input className={input+' mt-1'} type="datetime-local" required value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}/></label><button className={button+' self-end'} disabled={busy}>Block dates</button></form>
          <div className="rounded-lg border border-[#34465E] bg-[#0B1422] p-3 space-y-3">
            <p className="font-semibold text-sm">External calendar files (iCalendar)</p>
            <p className="text-xs text-[#9FB4CE]">Import event times from an exported .ics file to block rentals. Guest names and contact details are not stored. UTC and all-day events are supported; other timezone forms are skipped.</p>
            <input type="file" accept=".ics,text/calendar" className="block w-full text-xs" onChange={e=>setIcalFile(e.target.files?.[0]||null)}/>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!icalFile} onClick={importCalendar}>Import calendar blocks</button><button className={secondary} onClick={exportCalendar} disabled={busy}>Export unavailable dates (.ics)</button></div>
          </div>
          {blocks.map(block=><div className="flex justify-between gap-3 border-t border-[#34465E] pt-2 text-xs" key={block.id}><span>{dateTime(block.starts_at)} – {dateTime(block.ends_at)} · {block.source||"manual"}</span><button onClick={()=>mutate('host_remove_block',{id:block.id},'Block removed.')} className="text-red-300">Remove</button></div>)}
        </div>}

        {selected&&<div className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><ClipboardCheck size={18}/>Location turnover checklist</h3>
          <div className="flex flex-wrap gap-2"><label className="text-sm flex-1">Due date<input type="datetime-local" className={input+' mt-1'} value={turnoverDue} onChange={e=>setTurnoverDue(e.target.value)}/></label><button className={button+' self-end'} disabled={busy} onClick={newTurnover}><Plus size={15} className="inline mr-1"/>New turnover</button></div>
          {turnovers.map(turn=><div className="rounded-xl border border-[#34465E] bg-[#0C1726] p-3 space-y-2" key={turn.id}><p className="text-sm font-semibold capitalize">Turnover · {turn.status.replaceAll('_',' ')} {turn.due_at?'· '+dateTime(turn.due_at):''}</p>
            {(turn.tasks||[]).map(task=><label key={task.id} className="flex items-center gap-3 text-xs"><input type="checkbox" checked={task.done} onChange={e=>mutate('turnover_task',{id:task.id,done:e.target.checked},'Checklist updated.')}/>{task.label}</label>)}
            <div className="flex flex-wrap gap-2 items-center"><button className={secondary} onClick={()=>showInspection(turn.id)}>Show condition photos</button><select className={input+' max-w-[140px]'} value={inspectionPhase} onChange={e=>setInspectionPhase(e.target.value)}><option value="before">Before</option><option value="after">After</option></select><input type="file" accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={e=>setInspectionFile(e.target.files?.[0]||null)}/><button disabled={busy||!inspectionFile} className={button} onClick={()=>uploadInspection(turn.id)}>Upload evidence</button></div>
            <div className="grid grid-cols-3 gap-2">{(inspectionPhotos[turn.id]||[]).map(photo=><div key={photo.id}><img src={photo.url} alt={photo.phase+' room inspection'} className="h-24 w-full rounded-lg object-cover"/><p className="text-xs">{photo.phase}</p></div>)}</div>
          </div>)}
        </div>}
      </div>
    </div>
    <div className={panel+' space-y-3'}>
      <h3 className="flex items-center gap-2 font-semibold"><Settings2 size={18}/>Booking requests from guests</h3>
      {!reservations.length&&<p className={muted}>No pending or past reservation requests.</p>}
      {reservations.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-3 border-b border-[#34465E] pb-3">
        <div className="space-y-1"><p className="text-sm font-semibold">{dateTime(b.starts_at)} – {dateTime(b.ends_at)}</p><p className="text-xs text-[#A8BED8]">Requested use: {b.requested_use} · Crew: {b.crew_size} · Est. {usd(b.estimated_total)}</p><p className="text-xs text-[#829AB5]">Guest {b.requester_id} · {b.status}</p><p className="text-sm">{b.notes}</p>
          <button className="mt-2 text-sm text-blue-300" onClick={()=>setExpandedBooking(expandedBooking===b.id?'':b.id)}>
            {expandedBooking===b.id?'Hide operations':'Agreement, payments, refunds and disputes'}
          </button>
          {expandedBooking===b.id&&<div className="mt-4 max-w-3xl"><HostingBookingOperations bookingId={b.id} userId={user?.id}/></div>}
        </div>
        {b.status==='accepted'&&new Date(b.ends_at)<new Date()&&<button className={button} onClick={()=>completeBooking(b.id)} disabled={busy}>Mark completed</button>}{b.status==='requested'&&<div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>mutate('host_booking_respond',{id:b.id,status:'accepted'},'Request accepted; no payment charged.')}>Accept</button><button className={secondary} disabled={busy} onClick={()=>mutate('host_booking_respond',{id:b.id,status:'declined'},'Request declined.')}>Decline</button></div>}
      </div>)}
    </div>
  </>}
  {reviewMode&&isAdmin&&<HostingAdminOperations/>}
 </section>;
}