/** Authenticated, image-first profile gallery. No public asset URLs.
 * Media Gateway enforces adult verification, Premium actions, visibility,
 * blocks, rights attestation and owner opt-in for reposting.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Heart,MessageCircle,Repeat2,ImagePlus,ShieldCheck,RefreshCw} from 'lucide-react';
import GalleryAlbumManager from './GalleryAlbumManager';
import {supabase} from '@/api/supabaseClient';

async function action(name,body={}){
 const {data,error}=await supabase.functions.invoke('media-gateway',{body:{action:name,...body}});
 if(error||data?.error)throw Error(data?.error||error?.message||'Gallery request failed.');
 return data;
}
const ctl='inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--cc-border)] px-3 py-2 text-xs font-semibold disabled:opacity-45';
const field='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm';

export default function ProfileGallery({ownerId,viewerId,paid=false,mode='photos',onNavigate}){
 const own=ownerId===viewerId;
 const [items,setItems]=useState([]),[pending,setPending]=useState([]),[pendingUrls,setPendingUrls]=useState({});
 const [albums,setAlbums]=useState([]),[selectedAlbum,setSelectedAlbum]=useState(''),[uploadAlbumId,setUploadAlbumId]=useState('');
 const [captionEdits,setCaptionEdits]=useState({}),[visibilityEdits,setVisibilityEdits]=useState({}),[assignEdits,setAssignEdits]=useState({});
 const [busy,setBusy]=useState(''),[opened,setOpened]=useState(null),[comments,setComments]=useState({});
 const [draft,setDraft]=useState({}),[composer,setComposer]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [file,setFile]=useState(null),[caption,setCaption]=useState(''),[rights,setRights]=useState(false),[visibility,setVisibility]=useState('premium'),[repostAllowed,setRepostAllowed]=useState(false);
 const load=useCallback(async()=>{
  try{
   const [approved,mine,ownAlbums]=await Promise.all([
    action('gallery',{owner_id:ownerId}),
    own&&paid?action('my_media'):Promise.resolve({items:[]}),
    own&&paid?action('list_albums'):Promise.resolve({items:[]})
   ]);
   setItems(approved.items||[]);
   setAlbums(own&&paid?ownAlbums.items||[]:approved.albums||[]);
   const review=(mine.items||[]).filter(x=>x.status==='pending'&&((mode==='videos')===x.mime_type?.startsWith('video/')));
   setPending(review);
   if(review.length){
    const previews=await Promise.all(review.slice(0,24).map(async entry=>{
     try{const r=await action('view',{id:entry.id});return [entry.id,r.url||null];}
     catch{return [entry.id,null];}
    }));
    setPendingUrls(Object.fromEntries(previews));
   }else setPendingUrls({});
  }catch(e){setError(e.message||'Gallery unavailable.');}
 },[ownerId,own,paid,mode]);
 useEffect(()=>{void load();},[load]);
 const run=async(key,callback)=>{
  if(busy)return;setBusy(key);setError('');setMessage('');
  try{await callback();}catch(e){setError(e.message||'Action failed');}finally{setBusy('');}
 };
 const files=items.filter(item=>(mode==='videos')===item.mime_type?.startsWith('video/')&&(!selectedAlbum||item.album_id===selectedAlbum));
 const pendingItems=pending.filter(item=>!selectedAlbum||item.album_id===selectedAlbum);
 const albumSelected=albums.find(a=>a.id===uploadAlbumId);
 const uploadAudience=albumSelected?.visibility||visibility;
 const saveMedia=async item=>run('edit-'+item.id,async()=>{
  await action('edit_media',{media_id:item.id,caption:captionEdits[item.id]??item.caption??'',
    visibility:item.album_id?undefined:(visibilityEdits[item.id]??item.visibility)});
  setMessage('Media details updated.');await load();
 });
 const assign=async item=>run('assign-'+item.id,async()=>{
  await action('assign_album',{media_id:item.id,album_id:assignEdits[item.id]??item.album_id??null});
  setMessage('Album updated.');await load();
 });
 const comment=async item=>run('comment-'+item.id,async()=>{
  const text=String(draft[item.id]||'').trim();
  if(text.length<2)return;
  await action('gallery_comment',{media_id:item.id,comment:text});
  setDraft(old=>({...old,[item.id]:''}));
  const result=await action('gallery_comments',{media_id:item.id});
  setComments(old=>({...old,[item.id]:result.items||[]}));
  await load();
 });
 const viewComments=async item=>{
  if(composer===item.id){setComposer('');return;}
  if(!paid){onNavigate?.('membership');return;}
  await run('comments-'+item.id,async()=>{
   const result=await action('gallery_comments',{media_id:item.id});
   setComments(old=>({...old,[item.id]:result.items||[]}));
   setComposer(item.id);
  });
 };
 const upload=async e=>{
  e.preventDefault();if(!own||!paid||!file||!rights)return;
  await run('upload',async()=>{
   if(file.size>20*1024*1024||!['image/png','image/jpeg','image/webp','video/mp4'].includes(file.type))
    throw Error('Choose a JPEG, PNG, WebP or MP4 file up to 20 MB.');
   const path=viewerId+'/media/'+crypto.randomUUID()+'.'+(file.type==='video/mp4'?'mp4':file.type.split('/')[1]);
   const {error:uploadError}=await supabase.storage.from('member-private').upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   if(uploadAudience==='groups'&&!albumSelected)throw Error('Choose a group-restricted album first.');
   await action('register_upload',{storage_path:path,mime_type:file.type,caption,visibility:uploadAudience,
    album_id:uploadAlbumId||undefined,attest_rights:true,
    allow_repost:uploadAudience==='premium'&&repostAllowed});
   setFile(null);setCaption('');setRights(false);setRepostAllowed(false);setMessage('Uploaded.');
   await load();
  });
 };
 return <section className="space-y-5" aria-label={mode==='videos'?'Profile videos':'Profile photos'} data-profile-media-gallery={mode}>
  {own&&paid&&<GalleryAlbumManager albums={albums} request={action} onRefresh={load}
   selectedAlbum={selectedAlbum} onSelectAlbum={id=>{setSelectedAlbum(id);setUploadAlbumId(id);}} onError={setError}/>}
  {!own&&albums.length>0&&<div className="flex flex-wrap gap-2" aria-label="Photo and video albums">
   <button type="button" className={ctl} aria-pressed={!selectedAlbum} onClick={()=>setSelectedAlbum('')}>All</button>
   {albums.map(album=><button key={album.id} type="button" className={ctl}
    aria-pressed={selectedAlbum===album.id} onClick={()=>setSelectedAlbum(album.id)}>{album.title}</button>)}
  </div>}
  {own&&paid&&<form onSubmit={e=>void upload(e)} className="ccx-surface space-y-3 rounded-2xl p-4">
   <h3 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus size={18}/>Add {mode==='videos'?'video':'photos'}</h3>
   <div className="flex flex-wrap items-end gap-3">
    <label className="min-w-[180px] flex-1 text-xs">Choose {mode==='videos'?'an MP4 video':'a photo'}
     <input key={mode} type="file" accept={mode==='videos'?'video/mp4':'image/jpeg,image/png,image/webp'} className={field+' mt-1'} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <label className="min-w-[190px] flex-1 text-xs">Caption<input className={field+' mt-1'} maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
    <label className="min-w-[140px] flex-1 text-xs">Who can view<select className={field+' mt-1'} value={visibility} onChange={e=>setVisibility(e.target.value)}>
     <option value="verified">Verified members</option><option value="connections">Connections</option><option value="private">Only me</option>
    </select></label>
   </div>
   <div className="flex flex-wrap items-center gap-4">
    <label className="flex max-w-xl items-start gap-2 text-xs"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/><span>I own or have rights to share this media, and all people depicted are consenting adults with required releases.</span></label>
    {visibility==='verified'&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={repostAllowed} onChange={e=>setRepostAllowed(e.target.checked)}/>Allow others to repost after approval</label>}
   </div>
   <button className="ccx-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm" disabled={!file||!rights||Boolean(busy)}><ShieldCheck size={16}/>{busy==='upload'?'Uploading…':'Add to gallery'}</button>
  </form>}
  {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {message&&<p role="status" className="text-sm text-[var(--cc-text-secondary)]">{message}</p>}
  <div className="flex justify-end">
   <button className={ctl} onClick={()=>void load()} type="button" aria-label="Refresh gallery"><RefreshCw size={15}/>Refresh</button>
  </div>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-profile-photo-grid="true">
   {!files.length&&!pending.length&&Array.from({length:8},(_,i)=><div key={'empty-'+i} aria-hidden="true" className="aspect-square rounded-xl border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]"/>)}
   {files.map(item=><article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)]">
    <div className="relative aspect-square overflow-hidden bg-[var(--cc-surface-subtle)]">
     {item.url?(mode==='videos'?
      <video preload="metadata" controls className="h-full w-full object-contain" src={item.url}/>:
      <button type="button" className="h-full w-full" aria-label={'View '+(item.caption||'photo')} onClick={()=>setOpened(item)}>
       <img src={item.url} alt={item.caption||'Gallery photo'} loading="lazy" className="h-full w-full object-cover"/>
      </button>):
      <button type="button" className="h-full w-full" onClick={()=>void load()}>Refresh image</button>}
    </div>
    <div className="space-y-2 p-2.5">
     {item.caption&&<p className="line-clamp-2 break-words text-xs">{item.caption}</p>}
     <div className="flex flex-wrap gap-1">
      <button type="button" className={ctl+' '+(item.liked?'text-red-600':'')} disabled={Boolean(busy)}
       onClick={()=>paid?void run('like-'+item.id,async()=>{await action('gallery_like',{media_id:item.id});await load();}):onNavigate?.('membership')}>
       <Heart size={15} fill={item.liked?'currentColor':'none'}/>{item.likes||0}</button>
      <button type="button" className={ctl} disabled={Boolean(busy)} onClick={()=>void viewComments(item)}><MessageCircle size={15}/>{item.comments||0}</button>
      <button type="button" className={ctl} disabled={Boolean(busy)||!item.allow_repost||item.visibility!=='verified'}
       title={!item.allow_repost?'Reposting disabled by the owner':'Share to community'}
       onClick={()=>paid?void run('repost-'+item.id,async()=>{const r=await action('gallery_repost',{media_id:item.id});setMessage(r.already_reposted?'Already shared to Feed.':'Shared to Feed.');await load();}):onNavigate?.('membership')}>
       <Repeat2 size={15}/>{item.reposts||0}</button>
     </div>
     {own&&paid&&item.visibility==='verified'&&<label className="flex items-center gap-2 text-[10px] text-[var(--cc-text-secondary)]"><input type="checkbox" checked={item.allow_repost===true} onChange={e=>void run('allow-'+item.id,async()=>{await action('gallery_repost_permission',{media_id:item.id,allow_repost:e.target.checked});await load();})}/>Allow reposting</label>}
     {composer===item.id&&<div className="space-y-2">
      {(comments[item.id]||[]).map(c=><p key={c.id} className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-[11px]"><strong>{c.author_name}</strong> {c.body}</p>)}
      <form className="flex gap-1" onSubmit={e=>{e.preventDefault();void comment(item);}}>
       <input className={field} aria-label="Write a comment" maxLength={600} value={draft[item.id]||''} onChange={e=>setDraft(old=>({...old,[item.id]:e.target.value}))} placeholder="Comment…"/>
       <button type="submit" className={ctl} disabled={Boolean(busy)||!(draft[item.id]||'').trim()}>Post</button>
      </form>
     </div>}
     <a href={'/trust/content-removal?locator='+encodeURIComponent('gallery-media:'+item.id)} className="block text-[10px] text-[var(--cc-text-secondary)] underline">Report</a>
    </div>
   </article>)}
   {own&&pending.map(item=><article key={item.id} className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]">
    {pendingUrls[item.id]&&(mode==='videos'
     ?<video preload="metadata" controls className="h-full w-full object-contain" src={pendingUrls[item.id]}/>
     :<img src={pendingUrls[item.id]} alt={item.caption||'Your uploaded photo'} className="h-full w-full object-cover"/>)}
    <span className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-2 text-center text-[11px] font-semibold text-white">Under review</span>
   </article>)}
  </div>
  {opened&&<div role="dialog" aria-modal="true" aria-label="Gallery photo" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-5" onClick={()=>setOpened(null)}>
   <div className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-3" onClick={e=>e.stopPropagation()}>
    <button type="button" className="self-end rounded-lg bg-white px-4 py-2 text-sm text-black" onClick={()=>setOpened(null)}>Close</button>
    <img src={opened.url} alt={opened.caption||'Gallery photo'} className="max-h-[80vh] w-full object-contain"/>
   </div>
  </div>}
 </section>;
}
