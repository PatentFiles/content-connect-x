/** Connect Feed dashboard: one moderated post source for friends, following, discovery.
 * Free verified members can browse, react, save and comment; only Premium
 * can submit posts and reposts. No public media URLs or third-party ad scripts.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Heart,MessageCircle,Repeat2,Bookmark,ImagePlus,Send,Flag,RefreshCw,X,Settings2} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {loadFeedPreferences} from './feedDisplayPreferences.mjs';
const secondary='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)]';
const audienceLabels={verified:'Entire community',friends:'Friends only',only_me:'Only me'};
async function action(name,payload={}){
 const {data,error}=await supabase.functions.invoke('connect-feed',{body:{action:name,...payload}});
 if(error||data?.error){
  let msg=data?.error||'Feed is unavailable. Try again.';
  if(error?.context?.json)try{const result=await error.context.json();msg=result?.error||msg;}catch{}
  throw Error(msg);
 }
 return data;
}
function FeedPost({post,paid,userId,onChanged,onError}){
 const [comments,setComments]=useState(null),[commentText,setCommentText]=useState('');
 const [busy,setBusy]=useState(false);
 const [revealedPhotos,setRevealedPhotos]=useState([]);
 const [reporting,setReporting]=useState(false),[reportReason,setReportReason]=useState('unsafe');
 const [local,setLocal]=useState(post),[notice,setNotice]=useState('');
 useEffect(()=>{setLocal(post);},[post]);
 const mutate=async (name,args={})=>{
  if(busy)return;setBusy(true);setNotice('');
  try{
   const result=await action(name,{post_id:post.id,...args});
   if(name==='like'||name==='unlike')setLocal(previous=>({...previous,liked:result.liked,likes:Math.max(0,previous.likes+(result.liked?1:-1))}));
   if(name==='save'||name==='unsave')setLocal(previous=>({...previous,saved:result.saved}));
   if(name==='comment'){setCommentText('');setNotice('Comment submitted for moderation; it will appear after approval.');}
   if(name==='repost'){setNotice(result?.item?.status==='published'?'Added to your Reposts.':'Repost submitted for review.');onChanged?.();}
   if(name==='report'){setReporting(false);setNotice(result.note||'Post report recorded.');}
   if(name==='hide'){onChanged();}
  }catch(error){onError(error.message);}finally{setBusy(false);}
 };
 const loadComments=async()=>{
  if(busy)return;
  if(comments){setComments(null);return;}
  setBusy(true);
  try{const result=await action('comments',{post_id:post.id});setComments(result.items||[]);}catch(e){onError(e.message);}finally{setBusy(false);}
 };
 const isRepost=Boolean(local.repost_of&&local.original);
 const repostNote=isRepost&&!['Sharing this professional update.','Reposted this update.'].includes(String(local.body||'').trim())?local.body:null;
 return <article className="ccx-surface min-w-0 space-y-3 rounded-2xl p-4 sm:p-5" data-connect-post={local.id}>
  <header className="flex items-start justify-between gap-3">
   <div className="min-w-0">
    {isRepost?<p className="flex flex-wrap items-center gap-2 text-sm font-semibold" data-repost-attribution="true"><span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--cc-border)]"><Repeat2 size={16}/></span>{local.author?.display_name||'Member'} reposted</p>:<p className="font-semibold break-words">{local.author?.display_name||'Member'}</p>}
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{local.author?.role_type||'Professional member'} · {audienceLabels[local.audience]||'Verified community'} · {local.published_at?new Date(local.published_at).toLocaleString():''}</p>
   </div>
   {local.author_id===userId&&<button type="button" className="text-xs underline min-h-11" disabled={busy} onClick={()=>{if(window.confirm('Hide this post and its shared access?'))void mutate('hide');}}>Remove</button>}
  </header>
  {!isRepost&&<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{local.body}</p>}
  {repostNote&&<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{repostNote}</p>}
  {local.original&&<div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">
   <p className="text-xs font-semibold">{local.original.author_name||'Member'}</p>
   <p className="mt-2 whitespace-pre-wrap break-words">{local.original.body}</p>
  </div>}
  {local.photos?.length>0&&<div className={'grid gap-2 '+(local.photos.length>1?'grid-cols-2':'grid-cols-1')}>
   {local.photos.map(photo=>{
    const concealed=photo.content_label==='adult_nudity'&&!revealedPhotos.includes(photo.id);
    return <div key={photo.id} className="relative overflow-hidden rounded-xl border border-[var(--cc-border)]">
     <a href={concealed?undefined:photo.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
      aria-label={'View attached photo '+(photo.caption||'')} className="block">
      <img src={photo.url} alt={concealed?'Adult image concealed until revealed':photo.caption||'Shared professional photo'}
       loading="lazy" referrerPolicy="no-referrer" className={'aspect-square h-auto w-full object-cover '+(concealed?'blur-2xl':'')}/>
     </a>
     {concealed&&<button type="button" className="absolute inset-0 flex items-center justify-center bg-black/40 px-4 text-center text-sm font-semibold text-white"
      onClick={()=>setRevealedPhotos(v=>[...v,photo.id])}>Adult nudity — click to reveal</button>}
    </div>;
   })}
  </div>}
  <div className="flex flex-wrap items-center gap-1 border-t border-[var(--cc-border)] pt-3">
   <button type="button" className={secondary} disabled={busy} aria-label={local.liked?'Unlike post':'Like post'} onClick={()=>void mutate(local.liked?'unlike':'like')}>
    <Heart size={17} fill={local.liked?'currentColor':'none'}/><span>{local.likes}</span>
   </button>
   <button type="button" className={secondary} disabled={busy} onClick={()=>void loadComments()}><MessageCircle size={17}/>{local.comments} Comments</button>
   {paid&&!local.repost_of&&local.audience==='verified'&&local.allow_repost&&<button type="button" className={secondary} disabled={busy} aria-label="Repost to your profile" onClick={()=>void mutate('repost',{text:'Reposted this update.',audience:'verified'})}><span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--cc-border)]"><Repeat2 size={17}/></span>Repost</button>}
   <button type="button" className={secondary} disabled={busy} aria-label={local.saved?'Remove saved post':'Save post'} onClick={()=>void mutate(local.saved?'unsave':'save')}><Bookmark size={17} fill={local.saved?'currentColor':'none'}/></button>
   <button type="button" className={secondary} disabled={busy} onClick={()=>setReporting(v=>!v)}><Flag size={17}/>Report</button>
  </div>
  {reporting&&<form onSubmit={e=>{e.preventDefault();void mutate('report',{reason:reportReason});}} className="space-y-2">
   <p className="text-xs">Post reporting does not dispatch emergency services.</p>
   <label className="block text-xs">Reason
    <select className={input+' mt-1'} value={reportReason} onChange={e=>setReportReason(e.target.value)}>
     {[['unsafe','Safety concern'],['rights','Image or content rights'],['privacy','Privacy concern'],['harassment','Harassment'],['other','Other']].map(([v,label])=><option value={v} key={v}>{label}</option>)}
    </select>
   </label><button className={primary} type="submit" disabled={busy}>Submit report</button>
  </form>}
  {comments&&<section className="space-y-3" aria-label="Approved comments">
   {comments.length?comments.map(c=><div key={c.id} className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">
    <strong>{c.author_name}</strong><p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
   </div>):<p className="text-sm text-[var(--cc-text-secondary)]">No approved comments yet.</p>}
   <form onSubmit={e=>{e.preventDefault();void mutate('comment',{text:commentText});}} className="flex flex-wrap gap-2">
    <input value={commentText} minLength={2} maxLength={2000} required onChange={e=>setCommentText(e.target.value)} placeholder="Write a respectful comment…" className={input+' flex-1 min-w-40'}/>
    <button type="submit" className={primary} disabled={busy||commentText.trim().length<2}><Send size={16}/>Comment</button>
   </form>
  </section>}
  {notice&&<p role="status" className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-xs">{notice}</p>}
 </article>;
}
/** Re-encoding strips EXIF/GPS before any picture leaves the browser. */
async function safePhotoBlob(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)
  throw Error('Choose a JPG, PNG or WebP image smaller than 12 MB.');
 if(typeof createImageBitmap!=='function')throw Error('This browser cannot safely prepare images. Please use an updated browser.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>30000000)throw Error('Image dimensions are too large.');
  const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Cannot process this photo.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
  if(!blob||blob.size>8*1024*1024)throw Error('Compressed photo exceeds the 8 MB limit.');
  return blob;
 }finally{bitmap.close();}
}
export default function ConnectFeed({userId,paid=false,preview=false,initialMode='discover',profileId=null,groupId=null,onNavigate=(_tab)=>{}}){
 const [mode,setMode]=useState(groupId?'group':initialMode),[items,setItems]=useState([]),[cursor,setCursor]=useState(null);
 const [activityTab,setActivityTab]=useState('posts');
 const [preferencesReady,setPreferencesReady]=useState(Boolean(groupId||profileId));
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sharedPost,setSharedPost]=useState(null),[sharedError,setSharedError]=useState(''),[loadingShared,setLoadingShared]=useState(false);
 const [text,setText]=useState(''),[audience,setAudience]=useState('verified');
 const [uploadFile,setUploadFile]=useState(null),[rights,setRights]=useState(false),[adultNudity,setAdultNudity]=useState(false),[uploading,setUploading]=useState(false);
 const reqNo=useRef(0),posting=useRef(false),photoPicker=useRef(null);
 const feedMode=groupId?'group':profileId?(activityTab==='reposts'?'profile_reposts':'profile_posts'):activityTab==='reposts'?'my_reposts':mode;
 useEffect(()=>{
  if(groupId||profileId){setPreferencesReady(true);return;}
  let live=true;setPreferencesReady(false);
  void loadFeedPreferences(supabase,userId)
   .then(saved=>{if(live){setMode(saved.feed_view);setAudience(saved.default_audience);}})
   .catch(()=>{if(live){setMode(initialMode);setAudience('verified');}})
   .finally(()=>{if(live)setPreferencesReady(true);});
  return()=>{live=false;};
 },[userId,groupId,profileId,initialMode]);
 useEffect(()=>{
  if(groupId||profileId)return;
  const update=event=>{
   if(event.detail?.user_id!==userId)return;
   setMode(event.detail.feed_view);
   setAudience(event.detail.default_audience);
  };
  window.addEventListener('ccx-feed-display-preferences-changed',update);
  return()=>window.removeEventListener('ccx-feed-display-preferences-changed',update);
 },[userId,groupId,profileId]);
 const load=useCallback(async(more=false)=>{
  if(more&&!cursor)return;const seq=++reqNo.current;setLoading(true);setError('');
  try{
   const result=await action('feed',{mode:feedMode,author_id:groupId||profileId||undefined,
    ...(more&&cursor?cursor:{})});
   if(seq!==reqNo.current)return;
   setItems(prior=>more?[...prior,...(result.items||[])]:result.items||[]);
   setCursor(result.cursor||null);
  }catch(e){if(seq===reqNo.current)setError(e.message);}finally{if(seq===reqNo.current)setLoading(false);}
 },[feedMode,profileId,groupId,cursor?.before,cursor?.before_id]);
 useEffect(()=>{
  if(!preferencesReady)return;
  reqNo.current++;setCursor(null);setItems([]);
  let alive=true;setLoading(true);setError('');
  void action('feed',{mode:feedMode,author_id:groupId||profileId||undefined})
   .then(data=>{if(alive){setItems(data.items||[]);setCursor(data.cursor||null);}},e=>{if(alive)setError(e.message);})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;reqNo.current++;};
 },[feedMode,profileId,groupId,userId,preferencesReady]);
 useEffect(()=>{
  if(profileId||groupId)return;
  const value=new URLSearchParams(window.location.search).get('ccx_post');
  if(!value)return;
  let active=true;setSharedPost(null);setSharedError('');setLoadingShared(true);
  void action('post',{post_id:value}).then(result=>{
   if(active)setSharedPost(result.post||null);
  },e=>{if(active)setSharedError(e.message);}).finally(()=>{if(active)setLoadingShared(false);});
  return()=>{active=false;};
 },[userId,profileId,groupId]);
 const clearShared=()=>{
  const url=new URL(window.location.href);
  url.searchParams.delete('ccx_post');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  setSharedPost(null);setSharedError('');
 };
 const uploadPhoto=async()=>{
  if(!uploadFile||!rights||!userId)throw Error('Confirm the photo depicts only you and you own all publishing rights.');
  setUploading(true);
  try{
   const image=await safePhotoBlob(uploadFile);
   const path=userId+'/media/'+crypto.randomUUID()+'.jpg';
   const {error:uploadError}=await supabase.storage.from('member-private').upload(path,image,{
    upsert:false,contentType:'image/jpeg',cacheControl:'0'
   });
   if(uploadError)throw Error('Private photo upload failed: '+uploadError.message);
   const {data,error}=await supabase.functions.invoke('media-gateway',{body:{
    action:'register_self_feed_photo',storage_path:path,mime_type:'image/jpeg',caption:text.slice(0,500),
    visibility:audience==='verified'?'verified':'connections',
    content_label:adultNudity?'adult_nudity':'professional',
    attest_rights:true,attest_self_only:true,attest_no_sex_act:true
   }});
   if(error||data?.error||!data?.item?.id)throw Error(data?.error||'The photo was not accepted. Your text remains available; retry or contact support.');
   return data.item.id;
  }finally{setUploading(false);}
 };
 const publish=async event=>{
  event.preventDefault();
  if(posting.current||!paid||preview)return;
  if(uploadFile&&!rights)return setError('Confirm that the photo depicts only you, and that you own its rights.');
  posting.current=true;setLoading(true);setError('');setNotice('');
  try{
   const mediaIds=(!groupId&&uploadFile)?[await uploadPhoto()]:[];
   const message=text.trim().length>=5?text:'Shared a photo';
   const result=await action('create',{text:message,audience,media_ids:mediaIds,group_id:groupId||undefined});
   setText('');setUploadFile(null);setRights(false);setAdultNudity(false);
   if(photoPicker.current)photoPicker.current.value='';
   setNotice(result.item?.status==='published'?'Your update is live on the Feed. Reports may temporarily hide it for review.':result.note||'Update submitted.');
   if(result.item?.status==='published')void load(false);
  }catch(e){setError(e.message);}finally{posting.current=false;setLoading(false);}
 };
 return <section data-connect-feed="true" className="min-w-0 space-y-4" aria-label={groupId?'Private group posts':profileId?'Profile timeline':'Connect Feed'}>
  {paid&&!preview&&!profileId&&<form className="ccx-surface space-y-2 rounded-2xl p-3 sm:p-4" onSubmit={publish} aria-label={groupId?'Group post composer':'Share an update'}>
   <div className="relative rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]" data-feed-composer="true">
    <label htmlFor="ccx-feed-update" className="sr-only">{groupId?'Share in this group':'Share an update'}</label>
    <textarea id="ccx-feed-update" className="block min-h-[110px] w-full resize-y rounded-xl bg-transparent px-3 pt-3 pb-14 text-sm text-[var(--cc-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-focus)]"
     value={text} rows={3} required={!uploadFile} minLength={uploadFile?0:5} maxLength={3000}
     onChange={e=>setText(e.target.value)} placeholder={groupId?'Write to your group…':'Share an update…'}/>
    {!groupId&&<>
     <input ref={photoPicker} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
      tabIndex={-1} aria-label="Choose a photo to attach" onChange={e=>{setUploadFile(e.target.files?.[0]||null);setRights(false);setAdultNudity(false);}}/>
     <button type="button" title="Attach photo" aria-label="Attach a photo"
      onClick={()=>photoPicker.current?.click()} disabled={uploading||loading}
      className="absolute bottom-2 left-2 grid h-11 w-11 place-items-center rounded-lg text-[var(--cc-link)] hover:bg-[var(--cc-surface-hover)] disabled:opacity-50"><ImagePlus size={21}/></button>
    </>}
    <button type="submit" title={groupId?'Submit group post for moderation':'Publish update'}
     aria-label={groupId?'Submit group post for moderation':'Publish update'}
     className="ccx-primary absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-xl p-0 disabled:opacity-50"
     disabled={loading||uploading||(!uploadFile&&text.trim().length<5)||Boolean(uploadFile&&!rights)}>
     <Send size={19} aria-hidden="true"/>
    </button>
   </div>
   {!groupId&&uploadFile&&<div className="space-y-2 rounded-xl border border-[var(--cc-border)] p-3 text-xs" data-feed-photo-details="true">
    <div className="flex items-center justify-between gap-3">
     <span className="min-w-0 truncate font-medium">{uploadFile.name}</span>
     <button type="button" title="Remove photo" aria-label="Remove attached photo" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--cc-border)]"
      onClick={()=>{setUploadFile(null);setRights(false);setAdultNudity(false);if(photoPicker.current)photoPicker.current.value='';}}><X size={16}/></button>
    </div>
    <label className="flex items-start gap-2"><input type="checkbox" checked={adultNudity} onChange={e=>setAdultNudity(e.target.checked)} className="mt-0.5"/><span>Contains adult nudity</span></label>
    <label className="flex items-start gap-2"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)} className="mt-0.5"/><span>I am 18+, the only person depicted, have publishing rights, and this photo shows no sexual act.</span></label>
   </div>}
  </form>}
  {!profileId&&!groupId&&<header className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="text-xl font-bold">Feed</h2>
   <div className="flex gap-2">
    <button className={secondary} type="button" title="Groups" aria-label="Groups" onClick={()=>onNavigate('groups')}><MessageCircle size={17}/></button>
    <button className={secondary} type="button" title="Feed settings" aria-label="Feed settings" onClick={()=>onNavigate('settings')}><Settings2 size={17}/></button>
    <button className={secondary} type="button" title="Refresh Feed" disabled={loading} onClick={()=>void load(false)} aria-label="Refresh Feed"><RefreshCw size={17}/></button>
   </div>
  </header>}
  {!groupId&&<div role="tablist" aria-label={profileId?'Profile activity':'Dashboard feed activity'} className="ccx-surface flex items-center gap-2 rounded-xl p-2" data-feed-activity-tabs="true">
   <button type="button" role="tab" aria-selected={activityTab==='posts'} className={'min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold '+(activityTab==='posts'?'ccx-primary':'ccx-secondary')} onClick={()=>setActivityTab('posts')}>{profileId?'Posts':'Feed'}</button>
   <button type="button" role="tab" aria-selected={activityTab==='reposts'} className={'min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold '+(activityTab==='reposts'?'ccx-primary':'ccx-secondary')} onClick={()=>setActivityTab('reposts')}><Repeat2 size={17} className="mr-2 inline" aria-hidden="true"/>Reposts</button>
  </div>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">{notice}</p>}
  {!profileId&&!groupId&&(loadingShared||sharedPost||sharedError)&&<section className="space-y-3 rounded-xl border-2 border-[var(--cc-border)] p-3" aria-label="Shared post">
   <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Shared post</h3><button type="button" className={secondary} onClick={clearShared}>Close shared post</button></div>
   {loadingShared&&<p role="status" className="text-sm">Checking your permission to view this post…</p>}
   {sharedError&&<p role="alert" className="text-sm">This post is not available to your account. It may be private, removed, or shared with a different audience.</p>}
   {sharedPost&&<FeedPost post={sharedPost} paid={paid} userId={userId} onError={setError} onChanged={clearShared}/>}
  </section>}
  <div className="space-y-4">{items.map(post=><FeedPost key={post.id} post={post} paid={paid} userId={userId} onError={setError} onChanged={()=>void load(false)}/>)}</div>
  {!loading&&items.length===0&&<div className="ccx-surface rounded-xl p-6 text-center text-sm text-[var(--cc-text-secondary)]">
   {activityTab==='reposts'?'No approved reposts to display yet.':profileId?'No original posts shared with your account yet.':mode==='friends'?'Your friends’ approved posts will appear here. Connect with members to build your feed.':mode==='following'?'Follow verified members to see their posts here.':'No approved posts have been published here yet.'}
  </div>}
  {cursor&&<button className={secondary+' w-full'} onClick={()=>void load(true)} disabled={loading}>Load more posts</button>}
  {loading&&<p role="status" className="text-center text-sm text-[var(--cc-text-secondary)]">Loading Connect Feed…</p>}
 </section>;
}