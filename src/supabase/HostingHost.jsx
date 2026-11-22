/**
 * Host dashboard and operations, adapted to the CCX Supabase schema.
 * Property approval and private images are server-controlled, not UI toggles.
 */
import React,{useCallback,useEffect,useState} from 'react';
import { supabase } from '@/api/supabaseClient';
import {Plus,CalendarDays,ClipboardCheck,ImageIcon,RefreshCw,Trash2,Settings2,ShieldCheck,Check,Save,Film} from 'lucide-react';
import {hostingAction,uploadHostingPhoto,uploadHostingVideo,rentalCategories,rentalUses,usd,dateTime} from './hostingApi';
import HostingHostVerification from './HostingHostVerification';
import HostingBookingOperations from './HostingBookingOperations';
import HostingAdminOperations from './HostingAdminOperations';
import HostingPricingManager from './HostingPricingManager';
import HostingEquipmentManager from './HostingEquipmentManager';
import HostingCalendarManager from './HostingCalendarManager';
import HostingWorkforceManager from './HostingWorkforceManager';
import HostingSuitabilityManager from './HostingSuitabilityManager';
import HostDialog from './HostDialog';
import PropertyAmenities from './PropertyAmenities';
import PropertyVirtualTour from './PropertyVirtualTour';
import {normalizeMatterportUrl} from './propertyTourPolicy.mjs';
import {saveNewPropertyTour} from './propertyToursApi';
import HostPortfolio from './HostPortfolio';
import HostMarketExplorer from './HostMarketExplorer';
import {HostPhotoPicker,HostPhotoManager} from './PropertyPhotoGallery';
const panel='ccx-surface p-5';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)] focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const button='rounded-xl ccx-action-primary px-4 py-2.5 text-sm font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const secondary='rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-2.5 text-sm text-[var(--cc-text-primary)] disabled:opacity-50';
const muted='text-sm text-[var(--cc-text-secondary)]';
const blank={title:'',description:'',category:'film_studio',city:'',state:'',country:'United States',capacity:4,minimum_hours:24,hourly_rate:100,daily_rate:800,cleaning_fee_cents:0,min_notice_hours:24,preferred_cleaning_minutes:120,cancellation_policy:'flexible',deposit_percent:0,required_insurance:false,rules:'',amenities:[],permitted_uses:[]};

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
 const [editorTab,setEditorTab]=useState('details');
 const [saving,setSaving]=useState(false);
 const [defaults,setDefaults]=useState(blank);
 const [defaultForm,setDefaultForm]=useState(blank);
 const [showDefaults,setShowDefaults]=useState(false);
 const [marketFullscreen,setMarketFullscreen]=useState(false);
 const [form,setForm]=useState(blank);
 const [matterportUrl,setMatterportUrl]=useState('');
 const [tourFile,setTourFile]=useState(null);
 const [photoFiles,setPhotoFiles]=useState(/** @type {File[]} */([]));
 const [uploadProgress,setUploadProgress]=useState('');
 const [video,setVideo]=useState(null);
 const [videoCaption,setVideoCaption]=useState('');
 const [blocks,setBlocks]=useState([]);
 const [blockStart,setBlockStart]=useState('');
 const [blockEnd,setBlockEnd]=useState('');
 const [turnovers,setTurnovers]=useState([]);
 const [turnoverDue,setTurnoverDue]=useState('');
 const [privateDetails,setPrivateDetails]=useState({exact_address:'',entry_instructions:'',internal_notes:'',public_address_visible:false,latitude:'',longitude:''});
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
  if(!id){setBlocks([]);setTurnovers([]);setPrivateDetails({exact_address:'',entry_instructions:'',internal_notes:'',public_address_visible:false,latitude:'',longitude:''});return;}
  try{
   const [b,t,details]=await Promise.all([
    hostingAction('host_blocks',{id}),paid?hostingAction('turnover_list',{id}):Promise.resolve({items:[]}),hostingAction('host_private_get',{id}),
   ]);
   setBlocks(b.items||[]);setTurnovers(t.items||[]);setPrivateDetails(details.item||{exact_address:'',entry_instructions:'',internal_notes:'',public_address_visible:false,latitude:'',longitude:''});
  }catch(e){setError(e.message);}
 },[paid]);

 const selectListing=async(item)=>{
   setMatterportUrl('');setTourFile(null);
   setSelected(item?.id||'');setEditing(true);setShowDefaults(false);setError('');setNotice('');
   // Every new listing inherits editable host defaults, never another property's address.
   setForm(item?{...blank,...item,amenities:item.amenities||[],permitted_uses:item.permitted_uses||[]}:
     {...blank,...defaults,amenities:[...(defaults.amenities||[])],permitted_uses:[...(defaults.permitted_uses||[])]});
   setPhotoFiles([]);setUploadProgress('');setEditorTab('details');setVideo(null);setVideoCaption('');setApprovalChecked(false);
   setPrivateDetails({exact_address:'',entry_instructions:'',internal_notes:'',public_address_visible:false,latitude:'',longitude:''});
   await extra(item?.id||'');
 };
 const closeEditor=()=>{if(saving||busy)return;setEditing(false);setSelected('');setPhotoFiles([]);setVideo(null);setError('');setNotice('');};
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
  e.preventDefault();if(saving)return;
  if(!selected&&matterportUrl&&!normalizeMatterportUrl(matterportUrl)){setError('Enter a valid Matterport Showcase share link.');return;}
  if(privateDetails.exact_address.trim().length<8){setError('Enter the full private street address. Public cards show city and region only.');return;}
  setSaving(true);setError('');setNotice('');setUploadProgress('');
  try{
   const result=await hostingAction(selected?'host_update':'host_create',{...form,source_brand:brand,...(selected?{id:selected}:{})});
   const chosen=result.item?.id||selected;
   // Keep the saved draft selected even if a later private-media operation fails.
   setSelected(chosen);
   const failures=[];const retryPhotos=[];
   try{await hostingAction('host_private_details',{id:chosen,...privateDetails});}
   catch(error){failures.push('Private address: '+error.message);}
   if(matterportUrl||tourFile){try{await saveNewPropertyTour(chosen,matterportUrl,tourFile);setMatterportUrl('');setTourFile(null);}catch(error){failures.push('Matterport tour: '+error.message);}}
   for(let index=0;index<photoFiles.length;index++){
    const file=photoFiles[index];setUploadProgress(`Saving photo ${index+1} of ${photoFiles.length}`);
    try{await uploadHostingPhoto(chosen,file,file.name.replace(/\.[^.]+$/,''));}
    catch(error){retryPhotos.push(file);failures.push(file.name+': '+error.message);}
   }
   if(video){try{await uploadHostingVideo(chosen,video,videoCaption);setVideo(null);setVideoCaption('');}
    catch(error){failures.push('Video: '+error.message);}}
   await load();await extra(chosen);setPhotoFiles(retryPhotos);
   setUploadProgress('');
   if(failures.length)setError('Your draft was saved. Please retry: '+failures.join(' '));
   else{setNotice('Property saved privately. Review your photos, complete property authorization, then submit for approval.');setEditorTab('media');}
  }catch(error){setError(error.message);}finally{setSaving(false);}
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
  const content='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Content ConnectX//Private Hosting Calendar//EN\r\n'+events+'\r\nEND:VCALENDAR\r\n';
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
  <header className="flex flex-wrap justify-between gap-2"><div><h2 className="text-2xl font-semibold">{reviewMode?'Hosting approval queue':'Manage your hosting business'}</h2><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{reviewMode?'Review uploaded photos and listings before publication.':'Create properties, manage guests and maintain your location between shoots.'}</p></div><button className={secondary+' flex items-center gap-2'} disabled={busy} onClick={load}><RefreshCw size={16}/>Refresh</button></header>
  {!reviewMode&&hostMetrics&&<section aria-label="Your host performance overview" className="space-y-3">
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
    {[
      ['Properties',hostMetrics.properties],['30-day views',hostMetrics.views_30d],
      ['New booking requests',hostMetrics.booking_requests],['Upcoming shoots',hostMetrics.upcoming],
      ['Booking conversations',hostMetrics.conversations]
    ].map(([label,value])=><div className="oh-host-metric" key={label}>
      <p className="text-xs text-[var(--cc-text-secondary)]">{label}</p><strong className="text-3xl font-bold text-[var(--cc-text-primary)]">{Number(value||0).toLocaleString()}</strong>
     </div>)}
   </div>
   {hostMetrics.by_property?.length>0&&<details className="oh-host-listing-breakdown">
    <summary>Views by property (last 30 days)</summary>
    <div className="mt-3 space-y-2">{hostMetrics.by_property.map(item=><p className="flex justify-between gap-3 text-sm" key={item.id}>
      <span className="truncate">{item.title}</span><strong>{item.views_30d||0} views</strong>
    </p>)}</div>
   </details>}
   <p className="text-xs text-[var(--cc-text-secondary)]">Views are unique daily signed-in listing visits; conversations show booking threads, not unread messages. Figures reflect recorded activity only.</p>
  </section>}
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
  {notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
  {reviewMode&&isAdmin?<div className="space-y-5">
    <label className={panel+' flex items-start gap-3 text-sm'}><input type="checkbox" className="mt-1" checked={approvalChecked} onChange={e=>setApprovalChecked(e.target.checked)}/>I have independently checked the image/listing, relevant rights and permissions, declared production use and applicable publication procedures. I am not self-approving a listing.</label>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Private photos awaiting approval ({pendingImages.length})</h3>
      {pendingImages.map(pic=><div key={pic.id} className="flex flex-wrap items-center gap-4 border-b border-[var(--cc-border)] pb-3">
        {pic.url?<img className="h-24 w-32 rounded-lg object-cover" src={pic.url} alt="Private property review"/>:<ImageIcon size={32}/>}
        <div className="flex-1 min-w-[200px]"><p className="break-all text-xs text-[var(--cc-text-secondary)]">Listing {pic.property_id}</p><div className="ccx-action-row mt-3 flex gap-2">
          <button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewImage(pic.id,'approved')}>Approve photo</button>
          <button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewImage(pic.id,'rejected')}>Reject</button></div>
        </div>
      </div>)}
      {!pendingImages.length&&<p className={muted}>No pending property photos.</p>}
    </div>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Private videos awaiting approval ({pendingVideos.length})</h3>
      {pendingVideos.map(video=><div key={video.id} className="flex flex-wrap items-center gap-4 border-b border-[var(--cc-border)] pb-3">
        {video.url?<video className="h-28 w-44 rounded-lg bg-black object-cover" src={video.url} controls preload="metadata" playsInline aria-label="Private listing video pending review"/>:<Film size={32}/>}
        <div className="min-w-[180px] flex-1"><p className="text-xs text-[var(--cc-link)]">Property {video.property_id}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewVideo(video.id,'approved')}>Approve video</button>
          <button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewVideo(video.id,'rejected')}>Reject video</button></div>
        </div>
      </div>)}
      {!pendingVideos.length&&<p className={muted}>No pending property videos.</p>}
    </div>
    <div className={panel+' space-y-4'}><h3 className="font-semibold">Property listings awaiting review ({pending.length})</h3>
      {pending.map(p=><div key={p.id} className="border-b border-[var(--cc-border)] pb-4">
        <div className="flex gap-3">
          {p.photos?.[0]?.url?<img alt={p.title} src={p.photos[0].url} className="h-24 w-28 rounded-lg object-cover"/>:<div className="grid h-24 w-28 place-items-center rounded-lg bg-[var(--cc-surface)]"><ImageIcon/></div>}
          <div><h4 className="font-semibold">{p.title}</h4><p className={muted}>{p.city}, {p.country} · {p.daily_rate!=null?usd(p.daily_rate):'Set day rate'}/day</p><p className="text-xs text-[var(--cc-text-secondary)]">Permitted: {(p.permitted_uses||[]).join(', ')}</p></div>
        </div>
        <p className="mt-2 text-xs text-[var(--cc-text-secondary)]">Rules: {p.rules||'None specified'}</p>
        <PropertyVirtualTour propertyId={p.id} title={p.title}/>
        <div className="ccx-action-row mt-3 flex gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewListing(p.id,'active')}>Publish approved listing</button><button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewListing(p.id,'paused')}>Return for changes</button></div>
      </div>)}
      {!pending.length&&<p className={muted}>No listings waiting for review.</p>}
    </div>
    <div className={panel+' space-y-3'}><h3 className="font-semibold">Guest reviews awaiting publication ({reviewQueue.length})</h3>
      {reviewQueue.map(review=><div key={review.id} className="border-b border-[var(--cc-border)] pb-3"><p className="text-sm font-semibold">{review.rating}/5 stars</p><p className="text-sm whitespace-pre-wrap">{review.description}</p><p className="text-xs text-[var(--cc-text-secondary)]">Property {review.property_id}</p><div className="ccx-action-row mt-3 flex gap-2"><button disabled={busy||!approvalChecked} className={button} onClick={()=>reviewGuest(review.id,'published')}>Publish</button><button disabled={busy||!approvalChecked} className={secondary} onClick={()=>reviewGuest(review.id,'rejected')}>Reject</button></div></div>)}
      {!reviewQueue.length&&<p className={muted}>No pending guest reviews.</p>}
    </div>
  </div>:<>
    <HostPortfolio listings={listings} busy={busy||saving} onSelect={selectListing} onNew={()=>selectListing(null)}
      onDefaults={()=>{setDefaultForm(defaults);setShowDefaults(true);setEditing(false);setSelected('');setError('');setNotice('');}}
      onMap={()=>setMarketFullscreen(true)}/>
    {showDefaults&&<HostDialog title="Default Rules & Pricing" subtitle="Save once. Personalize for every property." busy={busy} onClose={()=>setShowDefaults(false)}>
      {error&&<p role="alert" className="oh-inline-error">{error}</p>}
        <section className={panel+' space-y-4 scroll-mt-24'} aria-label="Reusable host listing defaults">
          <p className="oh-map-privacy-note">These defaults prefill future listings. Each property can override any rule independently. Addresses and titles are always property-specific.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Default property type<select className={input+' mt-1'} value={defaultForm.category} onChange={e=>setDefaultForm(v=>({...v,category:e.target.value}))}>{rentalCategories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="text-sm">Default day rate ($)<input type="number" min="1" max="100000" className={input+' mt-1'} value={defaultForm.daily_rate} onChange={e=>setDefaultForm(v=>({...v,daily_rate:Number(e.target.value)}))}/></label>
            <label className="text-sm">Default crew capacity<input type="number" min="1" max="500" className={input+' mt-1'} value={defaultForm.capacity} onChange={e=>setDefaultForm(v=>({...v,capacity:Number(e.target.value)}))}/></label>
            <label className="text-sm">Default cleaning fee ($)<input type="number" min="0" max="100000" step="0.01" className={input+' mt-1'} value={(defaultForm.cleaning_fee_cents||0)/100} onChange={e=>setDefaultForm(v=>({...v,cleaning_fee_cents:Math.round(Number(e.target.value)*100)}))}/></label>
            <label className="text-sm">Minimum booking notice (hours)<input type="number" min="0" max="720" className={input+' mt-1'} value={defaultForm.min_notice_hours??24} onChange={e=>setDefaultForm(v=>({...v,min_notice_hours:Number(e.target.value)}))}/></label>
            <label className="text-sm">Cleaning/turnover buffer (minutes)<input type="number" min="0" max="1440" className={input+' mt-1'} value={defaultForm.preferred_cleaning_minutes??120} onChange={e=>setDefaultForm(v=>({...v,preferred_cleaning_minutes:Number(e.target.value)}))}/></label>

            <label className="text-sm">Cancellation policy<select className={input+' mt-1'} value={defaultForm.cancellation_policy} onChange={e=>setDefaultForm(v=>({...v,cancellation_policy:e.target.value}))}>
              {['flexible','moderate','strict'].map(v=><option value={v} key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Deposit percent<input type="number" min="0" max="50" className={input+' mt-1'} value={defaultForm.deposit_percent} onChange={e=>setDefaultForm(v=>({...v,deposit_percent:Number(e.target.value)}))}/></label>
          </div>
          <label className="block text-sm">Default house rules<textarea className={input+' mt-1'} rows={4} value={defaultForm.rules||''} maxLength={3000} onChange={e=>setDefaultForm(v=>({...v,rules:e.target.value}))}/></label>
          <button type="button" role="checkbox" aria-checked={!!defaultForm.required_insurance}
            className={'oh-option-tile flex w-full items-center justify-between rounded-xl border p-3 text-left '+(defaultForm.required_insurance?'oh-option-selected':'oh-option-idle')}
            onClick={()=>setDefaultForm(v=>({...v,required_insurance:!v.required_insurance}))}>Require production insurance <span className="oh-option-check">{defaultForm.required_insurance?<Check size={15}/>:null}</span></button>
          <PropertyAmenities title="Default amenities" values={defaultForm.amenities||[]} allowCustom onChange={values=>setDefaultForm(v=>({...v,amenities:values}))}/>
          <div><h4 className="mb-2 font-semibold">Default allowed productions</h4><CheckboxGrid values={defaultForm.permitted_uses||[]} options={rentalUses}
            update={values=>setDefaultForm(v=>({...v,permitted_uses:values}))}/></div>
          <button type="button" disabled={busy} className={button+' inline-flex items-center gap-2'} onClick={saveDefaults}><Save size={17}/>Save My Defaults</button>
        </section>
    </HostDialog>}
    {editing&&<HostDialog title={selected?(form.title||'Manage your property'):'Add a New Space'}
      subtitle={selected?'Manage your listing, photos, availability and approvals.':'A great listing starts with the details that make your property unique.'}
      busy={busy||saving} onClose={closeEditor} className="oh-property-editor-dialog">
      {error&&<p role="alert" className="oh-inline-error">{error}</p>}
      {notice&&<p role="status" className="oh-inline-success">{notice}</p>}
      {selected&&<nav className="oh-editor-tabs" aria-label="Property settings">
        {[["details","Listing details"],["media","Photos & videos"],["availability","Availability"],["operations","Pricing & operations"],["approval","Approval"]].map(([id,label])=>
          <button type="button" key={id} aria-current={editorTab===id?'page':undefined} onClick={()=>setEditorTab(id)} disabled={saving}>{label}</button>)}
      </nav>}
        {editorTab==='details'&&<form onSubmit={save} className={panel+' space-y-4 scroll-mt-24'}>
          <div className="oh-form-section-heading"><span>01</span><div><h3>Tell us about your space</h3><p>Give your listing a name and add its location. Your street address stays private unless you explicitly choose to publish it.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Listing title<input required minLength={5} maxLength={140} className={input+' mt-1'} value={form.title} onChange={e=>field('title',e.target.value)}/></label>
            <label className="text-sm">Location type<select className={input+' mt-1'} value={form.category} onChange={e=>field('category',e.target.value)}>{rentalCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
            <label className="text-sm">City<input required className={input+' mt-1'} value={form.city} onChange={e=>field('city',e.target.value)}/></label>
            <label className="text-sm">State/region<input className={input+' mt-1'} value={form.state||''} onChange={e=>field('state',e.target.value)}/></label>
            <label className="text-sm">Country<input required className={input+' mt-1'} value={form.country} onChange={e=>field('country',e.target.value)}/></label>
            <label className="text-sm sm:col-span-2">Full street address (required, private by default)
              <input required minLength={8} maxLength={400} autoComplete="street-address"
                className={input+' mt-1'} value={privateDetails.exact_address||''} onChange={e=>setPrivateDetails(v=>({...v,exact_address:e.target.value}))}
                placeholder="Street number, street name, unit number"/>
              <span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Private by default. The full address is only released through protected booking access unless you explicitly enable public display below.</span>
            </label>
            <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">
             <input type="checkbox" className="mt-1 h-5 w-5" checked={privateDetails.public_address_visible===true}
              onChange={e=>setPrivateDetails(v=>({...v,public_address_visible:e.target.checked,latitude:e.target.checked?v.latitude:'',longitude:e.target.checked?v.longitude:''}))}/>
             <span><strong>Show my street address publicly on this listing</strong><span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Optional for publicly listed studios or dungeons. Leave unchecked to show only the approved city/neighborhood marker. Even after opting in, private entry instructions stay confidential.</span></span>
            </label>
            {privateDetails.public_address_visible===true&&<div className="sm:col-span-2 space-y-2 rounded-xl border border-[var(--cc-border)] p-3 text-xs">
              <strong>Optional exact public map pin</strong>
              <p className="text-[var(--cc-text-secondary)]">Paste published coordinates only if this is an address you deliberately want visitors to find. Leave both blank to keep a general neighborhood pin even while showing the address text.</p>
              <div className="grid gap-2 sm:grid-cols-2">
               <label>Latitude<input type="number" step="any" min="-85" max="85" placeholder="e.g. 34.0522" className={input+' mt-1'} value={privateDetails.latitude??''} onChange={e=>setPrivateDetails(v=>({...v,latitude:e.target.value}))}/></label>
               <label>Longitude<input type="number" step="any" min="-180" max="180" placeholder="e.g. -118.2437" className={input+' mt-1'} value={privateDetails.longitude??''} onChange={e=>setPrivateDetails(v=>({...v,longitude:e.target.value}))}/></label>
              </div>
            </div>}
          </div>
          <div className="oh-form-section-heading"><span>02</span><div><h3>Your pricing & house rules</h3><p>Pre-filled from your defaults. Change anything for this particular property.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Daily rental rate (USD)<input className={input+' mt-1'} type="number" min={1} max={100000} value={form.daily_rate} onChange={e=>field('daily_rate',Number(e.target.value))}/></label>
            <label className="text-sm">Cleaning fee (USD)<input className={input+' mt-1'} type="number" min={0} max={100000} step="0.01" value={(form.cleaning_fee_cents||0)/100} onChange={e=>field('cleaning_fee_cents',Math.round(Number(e.target.value)*100))}/></label>
            <label className="text-sm">Minimum booking notice (hours)<input className={input+' mt-1'} type="number" min={0} max={720} value={form.min_notice_hours??24} onChange={e=>field('min_notice_hours',Number(e.target.value))}/></label>
            <label className="text-sm">Cleaning/turnover buffer (minutes)<input className={input+' mt-1'} type="number" min={0} max={1440} value={form.preferred_cleaning_minutes??120} onChange={e=>field('preferred_cleaning_minutes',Number(e.target.value))}/></label>
            <label className="text-sm">Maximum crew size<input className={input+' mt-1'} type="number" min={1} max={500} value={form.capacity} onChange={e=>field('capacity',Number(e.target.value))}/></label>
            <p className="text-xs text-[var(--cc-text-secondary)]">Bookings are full venue-local calendar days, 3 p.m. check-in to 3 p.m. checkout. Multi-day stays use the daily rate.</p>
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
          <PropertyAmenities title="Production amenities" values={form.amenities} allowCustom onChange={v=>field('amenities',v)}/>
          <div><h4 className="mb-2 text-sm font-semibold">Permitted activities — set deliberately</h4><p className="mb-3 text-xs text-[var(--cc-text-secondary)]">Select exactly what you are comfortable allowing. Nude photography and explicit adult videos are separate opt-ins; guests should never assume either is permitted. You must have written owner authority for each approved use.</p><CheckboxGrid values={form.permitted_uses} options={rentalUses} update={v=>field('permitted_uses',v)}/></div>
          {!selected&&<section className="oh-create-media-section">
            <div className="oh-form-section-heading"><span>03</span><div><h3>Let your photos do the talking</h3><p>Select your cover photo first. All uploads remain private until reviewed.</p></div></div>
            <HostPhotoPicker files={photoFiles} onChange={setPhotoFiles} disabled={saving}/>
            <label className="oh-video-upload-label">Optional property walkthrough video <span>MP4/WebM · up to 40 MB</span>
              <input type="file" accept="video/mp4,video/webm" disabled={saving} onChange={event=>setVideo(event.target.files?.[0]||null)}/></label>
          </section>}
          {uploadProgress&&<p role="status" className="oh-upload-count">{uploadProgress}</p>}
          {!selected&&<fieldset className="oh-new-tour-field space-y-3"><legend className="font-semibold">Matterport 3D tour (optional)</legend>
            <label className="block text-sm">Hosted Showcase link<input type="url" className={input+' mt-2'} value={matterportUrl} onChange={e=>setMatterportUrl(e.target.value)} placeholder="https://my.matterport.com/show/?m=…" maxLength={2048}/></label>
            <label className="block text-sm">Or upload a tour link file / private source archive<input type="file" className="mt-2 block w-full text-xs" accept=".url,.webloc,.json,.txt,.zip" onChange={e=>setTourFile(e.target.files?.[0]||null)}/></label>
            <p className="text-xs leading-6 text-[var(--cc-text-secondary)]">Hosted Matterport links open in a full-screen interactive viewer. Link files can import a tour URL. Raw ZIP scans are stored privately (50MB maximum) and still need processing through Matterport before they can be explored.</p>
          </fieldset>}
          <button disabled={busy||saving||!paid||!form.permitted_uses.length} className={button}>{saving?'Saving your space…':selected?'Save Property Changes':'Save & Add My Space'}</button>
          <p className="text-xs text-[var(--cc-text-secondary)]">Your exact address is saved privately and never included in public property cards or the area map.</p>
        </form>}

        {selected&&editorTab==='media'&&<PropertyVirtualTour propertyId={selected} title={form.title} editable onChanged={load}/>}
        {selected&&editorTab==='approval'&&<HostingHostVerification propertyId={selected} requiredInsurance={Boolean(own?.required_insurance)}/>}
        {selected&&editorTab==='operations'&&<section className="space-y-4">
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
        {selected&&editorTab==='details'&&<form onSubmit={saveAddress} className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={18}/>Private Entry Instructions</h3>
          <p className={muted}>The street address follows your public/private preference. Entry instructions always require an accepted booking, a signed rental agreement, confirmed payment and an authorized attendee.</p>

          <label className="text-sm block">Guest entry instructions<textarea rows={3} maxLength={1500} className={input+' mt-1'} value={privateDetails.entry_instructions||''} onChange={e=>setPrivateDetails(v=>({...v,entry_instructions:e.target.value}))}/></label>
          <label className="text-sm block">Private host notes<textarea rows={2} maxLength={1500} className={input+' mt-1'} value={privateDetails.internal_notes||''} onChange={e=>setPrivateDetails(v=>({...v,internal_notes:e.target.value}))}/></label>
          <button className={button} disabled={busy}>Save protected address</button>
        </form>}
        {selected&&editorTab==='media'&&<div className={panel+' space-y-4'}>
          <HostPhotoManager propertyId={selected} onChanged={load}/>
          <div className="border-t border-[var(--cc-border)] pt-5 space-y-3">
            <h3 className="flex items-center gap-2 font-semibold"><Film size={18}/>Property Walkthrough Videos</h3>
            <p className={muted}>Upload up to five short MP4/WebM videos (40MB each). Unreviewed videos are visible only to the owner and authorized moderators; approved videos appear on the property detail page.</p>
            <div className="grid gap-3 sm:grid-cols-2">{(own?.videos||[]).map(v=>
              <div key={v.id} className="relative overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]">
                {v.url?<video controls preload="metadata" playsInline className="h-40 w-full object-cover" src={v.url} aria-label={v.caption||'Property walkthrough'}/>:<div className="grid h-40 place-items-center"><Film/></div>}
                <div className="flex justify-between gap-2 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs">{v.caption||'Property video'}</p><p className="text-xs capitalize text-[var(--cc-link)]">{v.status}</p></div>
                  <button type="button" className="rounded-full bg-red-50 p-2" aria-label="Delete video" onClick={()=>mutate('host_video_delete',{id:v.id},'Video deleted')}><Trash2 size={15}/></button>
                </div>
              </div>)}</div>
            <form onSubmit={uploadVideo} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-sm">MP4/WebM video<input type="file" accept="video/mp4,video/webm" className="mt-2 block w-full text-xs" onChange={e=>setVideo(e.target.files?.[0]||null)}/></label>
              <label className="text-sm">Video caption<input className={input+' mt-1'} maxLength={250} value={videoCaption} onChange={e=>setVideoCaption(e.target.value)}/></label>
              <button disabled={busy||!video} className={button}>Upload Video</button>
            </form>
          </div>

        </div>}

        {selected&&editorTab==='availability'&&<div className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><CalendarDays size={18}/>Blackout dates</h3>
          <form onSubmit={block} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm">From<input className={input+' mt-1'} type="datetime-local" required value={blockStart} onChange={e=>setBlockStart(e.target.value)}/></label><label className="text-sm">To<input className={input+' mt-1'} type="datetime-local" required value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}/></label><button className={button+' self-end'} disabled={busy}>Block dates</button></form>
          <div className="rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 space-y-3">
            <p className="font-semibold text-sm">External calendar files (iCalendar)</p>
            <p className="text-xs text-[var(--cc-text-secondary)]">Import event times from an exported .ics file to block rentals. Guest names and contact details are not stored. UTC and all-day events are supported; other timezone forms are skipped.</p>
            <input type="file" accept=".ics,text/calendar" className="block w-full text-xs" onChange={e=>setIcalFile(e.target.files?.[0]||null)}/>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!icalFile} onClick={importCalendar}>Import calendar blocks</button><button className={secondary} onClick={exportCalendar} disabled={busy}>Export unavailable dates (.ics)</button></div>
          </div>
          {blocks.map(block=><div className="flex justify-between gap-3 border-t border-[var(--cc-border)] pt-2 text-xs" key={block.id}><span>{dateTime(block.starts_at)} – {dateTime(block.ends_at)} · {block.source||"manual"}</span><button onClick={()=>mutate('host_remove_block',{id:block.id},'Block removed.')} className="text-red-800">Remove</button></div>)}
        </div>}

        {selected&&editorTab==='availability'&&<div className={panel+' space-y-3'}>
          <h3 className="font-semibold flex items-center gap-2"><ClipboardCheck size={18}/>Location turnover checklist</h3>
          <div className="flex flex-wrap gap-2"><label className="text-sm flex-1">Due date<input type="datetime-local" className={input+' mt-1'} value={turnoverDue} onChange={e=>setTurnoverDue(e.target.value)}/></label><button className={button+' self-end'} disabled={busy} onClick={newTurnover}><Plus size={15} className="inline mr-1"/>New turnover</button></div>
          {turnovers.map(turn=><div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 space-y-2" key={turn.id}><p className="text-sm font-semibold capitalize">Turnover · {turn.status.replaceAll('_',' ')} {turn.due_at?'· '+dateTime(turn.due_at):''}</p>
            {(turn.tasks||[]).map(task=><label key={task.id} className="flex items-center gap-3 text-xs"><input type="checkbox" checked={task.done} onChange={e=>mutate('turnover_task',{id:task.id,done:e.target.checked},'Checklist updated.')}/>{task.label}</label>)}
            <div className="flex flex-wrap gap-2 items-center"><button className={secondary} onClick={()=>showInspection(turn.id)}>Show condition photos</button><select className={input+' max-w-[140px]'} value={inspectionPhase} onChange={e=>setInspectionPhase(e.target.value)}><option value="before">Before</option><option value="after">After</option></select><input type="file" accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={e=>setInspectionFile(e.target.files?.[0]||null)}/><button disabled={busy||!inspectionFile} className={button} onClick={()=>uploadInspection(turn.id)}>Upload evidence</button></div>
            <div className="grid grid-cols-3 gap-2">{(inspectionPhotos[turn.id]||[]).map(photo=><div key={photo.id}><img src={photo.url} alt={photo.phase+' room inspection'} className="h-24 w-full rounded-lg object-cover"/><p className="text-xs">{photo.phase}</p></div>)}</div>
          </div>)}
        </div>}
        {selected&&editorTab==='approval'&&<section className={panel+' space-y-3'}>
          <h3 className="font-semibold">Ready for the marketplace?</h3>
          <p className={muted}>Add a photo and your property authorization evidence. An independent administrator reviews the listing before creators can see it.</p>
          <button type="button" className={button} disabled={busy||!own?.photos?.length} onClick={()=>mutate('host_submit',{id:selected},'Listing submitted for human approval.')}>Submit listing for review</button>
        </section>}
    </HostDialog>}
    <div className={panel+' space-y-3'}>
      <h3 className="flex items-center gap-2 font-semibold"><Settings2 size={18}/>Booking requests from guests</h3>
      {!reservations.length&&<p className={muted}>No pending or past reservation requests.</p>}
      {reservations.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-3 border-b border-[var(--cc-border)] pb-3">
        <div className="space-y-1"><p className="text-sm font-semibold">{dateTime(b.starts_at)} – {dateTime(b.ends_at)}</p><p className="text-xs text-[var(--cc-text-secondary)]">Requested use: {b.requested_use} · Crew: {b.crew_size} · Est. {usd(b.estimated_total)}</p><p className="text-xs text-[var(--cc-text-secondary)]">Guest {b.requester_id} · {b.status}</p><p className="text-sm">{b.notes}</p>
          <button className="mt-2 text-sm text-[var(--cc-text-secondary)]" onClick={()=>setExpandedBooking(expandedBooking===b.id?'':b.id)}>
            {expandedBooking===b.id?'Hide operations':'Agreement, payments, refunds and disputes'}
          </button>
          {expandedBooking===b.id&&<div className="mt-4 max-w-3xl"><HostingBookingOperations bookingId={b.id} userId={user?.id}/></div>}
        </div>
        {b.status==='accepted'&&new Date(b.ends_at)<new Date()&&<button className={button} onClick={()=>completeBooking(b.id)} disabled={busy}>Mark completed</button>}{b.status==='requested'&&<div className="ccx-action-row flex gap-2"><button className={button} disabled={busy} onClick={()=>mutate('host_booking_respond',{id:b.id,status:'accepted'},'Request accepted; no payment charged.')}>Accept</button><button className={secondary} disabled={busy} onClick={()=>mutate('host_booking_respond',{id:b.id,status:'declined'},'Request declined.')}>Decline</button></div>}
      </div>)}
    </div>
    {marketFullscreen?<HostDialog title="Local Market" subtitle="Explore approved nearby properties and compare asking rates." fullscreen onClose={()=>setMarketFullscreen(false)}>
      <HostMarketExplorer onEdit={item=>{setMarketFullscreen(false);void selectListing(item);}} ownedListings={listings}/>
    </HostDialog>:<HostMarketExplorer onEdit={selectListing} ownedListings={listings}/>}
  </>}
  {reviewMode&&isAdmin&&<HostingAdminOperations/>}
 </section>;
}