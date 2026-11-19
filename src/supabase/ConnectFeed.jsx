/** Connect Feed dashboard: one moderated post source for friends, following, discovery.
 * Free verified members can browse, react, save and comment; only Premium
 * can submit posts and reposts. No public media URLs or third-party ad scripts.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Heart,MessageCircle,Repeat2,Share2,Bookmark,ImagePlus,Send,Flag,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
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
 const [busy,setBusy]=useState(false),[repostText,setRepostText]=useState(''),[reposting,setReposting]=useState(false);
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
   if(name==='repost'){setReposting(false);setRepostText('');setNotice('Repost submitted for review.');}
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
 const share=()=>{
  const url=new URL('/Dashboard',window.location.origin);
  url.searchParams.set('ccx_post',post.id);
  const text=url.toString();
  if(navigator.clipboard?.writeText){
   void navigator.clipboard.writeText(text).then(()=>setNotice('Link copied. Recipients must have permission to view this post.'),()=>setNotice('Copy the link from your address bar after opening this post.'));
  }else setNotice('Sharing requires browser clipboard permission.');
 };
 return <article className="ccx-surface min-w-0 space-y-3 rounded-2xl p-4 sm:p-5" data-connect-post={local.id}>
  <header className="flex items-start justify-between gap-3">
   <div className="min-w-0"><p className="font-semibold break-words">{local.author?.display_name||'Member'}</p>
    <p className="text-xs text-[var(--cc-text-secondary)]">{local.author?.role_type||'Professional member'} · {audienceLabels[local.audience]||'Verified community'} · {local.published_at?new Date(local.published_at).toLocaleString():''}</p>
   </div>
   {local.author_id===userId&&<button type="button" className="text-xs underline min-h-11" disabled={busy} onClick={()=>{if(window.confirm('Hide this post and its shared access?'))void mutate('hide');}}>Remove</button>}
  </header>
  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{local.body}</p>
  {local.original&&<div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">
   <p className="text-xs font-semibold">Reposted from {local.original.author_name}</p>
   <p className="mt-2 whitespace-pre-wrap break-words">{local.original.body}</p>
  </div>}
  {local.photos?.length>0&&<div className={'grid gap-2 '+(local.photos.length>1?'grid-cols-2':'grid-cols-1')}>
   {local.photos.map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={'View attached photo '+(photo.caption||'')} className="block overflow-hidden rounded-xl border border-[var(--cc-border)]">
    <img src={photo.url} alt={photo.caption||'Shared professional photo'} loading="lazy" referrerPolicy="no-referrer" className="aspect-square h-auto w-full object-cover"/>
   </a>)}
  </div>}
  <div className="flex flex-wrap items-center gap-1 border-t border-[var(--cc-border)] pt-3">
   <button type="button" className={secondary} disabled={busy} aria-label={local.liked?'Unlike post':'Like post'} onClick={()=>void mutate(local.liked?'unlike':'like')}>
    <Heart size={17} fill={local.liked?'currentColor':'none'}/><span>{local.likes}</span>
   </button>
   <button type="button" className={secondary} disabled={busy} onClick={()=>void loadComments()}><MessageCircle size={17}/>{local.comments} Comments</button>
   {paid&&local.audience==='verified'&&local.allow_repost&&<button type="button" className={secondary} disabled={busy} onClick={()=>setReposting(v=>!v)}><Repeat2 size={17}/>Repost</button>}
   <button type="button" className={secondary} onClick={share}><Share2 size={17}/>Share</button>
   <button type="button" className={secondary} disabled={busy} aria-label={local.saved?'Remove saved post':'Save post'} onClick={()=>void mutate(local.saved?'unsave':'save')}><Bookmark size={17} fill={local.saved?'currentColor':'none'}/></button>
   <button type="button" className={secondary} disabled={busy} onClick={()=>setReporting(v=>!v)}><Flag size={17}/>Report</button>
  </div>
  {reposting&&<form onSubmit={e=>{e.preventDefault();void mutate('repost',{text:repostText||'Sharing this professional update.',audience:'verified'});}} className="space-y-2">
   <label className="block text-xs">Your repost note (requires Premium)
    <textarea className={input+' mt-1'} rows={2} maxLength={3000} value={repostText} onChange={e=>setRepostText(e.target.value)} placeholder="Add context to this repost"/>
   </label>
   <button type="submit" className={primary} disabled={busy}>Submit repost for review</button>
  </form>}
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
 const modeOptions=groupId?[['group','Group posts']]:profileId?[['profile','Posts']]:[['friends','Friends'],['following','Following'],['discover','Discover']];
 const [mode,setMode]=useState(groupId?'group':profileId?'profile':initialMode),[items,setItems]=useState([]),[cursor,setCursor]=useState(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sharedPost,setSharedPost]=useState(null),[sharedError,setSharedError]=useState(''),[loadingShared,setLoadingShared]=useState(false);
 const [text,setText]=useState(''),[audience,setAudience]=useState('verified');
 const [uploadFile,setUploadFile]=useState(null),[rights,setRights]=useState(false),[adultNudity,setAdultNudity]=useState(false),[uploading,setUploading]=useState(false);
 const reqNo=useRef(0),posting=useRef(false);
 const load=useCallback(async(more=false)=>{
  if(more&&!cursor)return;const seq=++reqNo.current;setLoading(true);setError('');
  try{
   const result=await action('feed',{mode:groupId?'group':profileId?'profile':mode,author_id:groupId||profileId||undefined,
    ...(more&&cursor?cursor:{})});
   if(seq!==reqNo.current)return;
   setItems(prior=>more?[...prior,...(result.items||[])]:result.items||[]);
   setCursor(result.cursor||null);
  }catch(e){if(seq===reqNo.current)setError(e.message);}finally{if(seq===reqNo.current)setLoading(false);}
 },[mode,profileId,groupId,cursor?.before,cursor?.before_id]);
 useEffect(()=>{
  reqNo.current++;setCursor(null);setItems([]);
  let alive=true;setLoading(true);setError('');
  void action('feed',{mode:groupId?'group':profileId?'profile':mode,author_id:groupId||profileId||undefined})
   .then(data=>{if(alive){setItems(data.items||[]);setCursor(data.cursor||null);}},e=>{if(alive)setError(e.message);})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;reqNo.current++;};
 },[mode,profileId,groupId,userId]);
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
   setNotice(result.item?.status==='published'?'Your update is live on the Feed. Reports may temporarily hide it for review.':result.note||'Update submitted.');
   if(result.item?.status==='published')void load(false);
  }catch(e){setError(e.message);}finally{posting.current=false;setLoading(false);}
 };
 return <section data-connect-feed="true" className="min-w-0 space-y-4" aria-label={groupId?'Private group posts':profileId?'Profile timeline':'Connect Feed'}>
  {paid&&!preview&&!profileId?<form className="ccx-surface space-y-3 rounded-2xl p-4 sm:p-5" onSubmit={publish}>
   <label className="block text-sm font-semibold">{groupId?'Share in this group':'Share an update'}
    <textarea className={input+' mt-2'} value={text} rows={3} required={!uploadFile} minLength={uploadFile?0:5} maxLength={3000}
     onChange={e=>setText(e.target.value)} placeholder="Share your projects, photos, collaborations or professional updates…"/>
   </label>
   <div className="flex flex-wrap items-center gap-2">
    {!groupId&&<label className="text-xs">Audience
     <select className="ml-2 min-h-11 rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-2" value={audience} onChange={e=>setAudience(e.target.value)}>
      {Object.entries(audienceLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}
     </select>
    </label>}
    <button className={primary} type="submit" disabled={loading||uploading||(!uploadFile&&text.trim().length<5)||Boolean(uploadFile&&!rights)}>{loading?'Publishing…':'Publish update'}</button>
   </div>
   {!groupId&&<div className="space-y-3 rounded-xl border border-[var(--cc-border)] p-3" aria-label="Attach a photo">
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><ImagePlus size={17}/>Add a photo
     <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={e=>{setUploadFile(e.target.files?.[0]||null);setRights(false);}}/>
    </label>
    {uploadFile&&<div className="space-y-2">
     <p className="text-xs">{uploadFile.name} · The image will be resized and stripped of location metadata before upload.</p>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={adultNudity} onChange={e=>setAdultNudity(e.target.checked)}/><span>This photo contains adult nudity. Nudity itself is permitted for verified adults.</span></label>
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/><span>I am 18 or older, I am the only person depicted, I have the right to publish this image, and it contains no sexual act. Other people or sexual activity need separate documented clearance.</span></label>
    </div>}
    <p className="text-xs text-[var(--cc-text-secondary)]">Verified Premium members can post their own photos without routine manual image approval. Reports can temporarily remove posts for review. No IDs or private testing records.</p>
   </div>}
   <p className="text-xs text-[var(--cc-text-secondary)]">Publishing requires Premium. Your Feed post appears after verified self-attestation; comments and group discussions still follow separate moderation. Group posts currently support text only.</p>
  </form>:!profileId&&<div className="ccx-surface rounded-xl p-4 text-sm text-[var(--cc-text-secondary)]">Verified Free members can browse, like, save, share links and submit moderated comments. Premium is required to publish posts, upload photos or repost.</div>}
  {!profileId&&!groupId&&<header className="flex flex-wrap items-center justify-between gap-2">
   <div><h2 className="text-xl font-bold">Feed</h2><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Latest posts from your verified community, friends and following.</p></div>
   <div className="flex flex-wrap gap-2"><button className={secondary} type="button" onClick={()=>onNavigate('groups')}><MessageCircle size={16}/>Groups</button><button className={secondary} disabled={loading} onClick={()=>void load(false)} aria-label="Refresh Connect Feed"><RefreshCw size={16}/>Refresh</button></div>
  </header>}
  {!profileId&&!groupId&&<div className="flex flex-wrap gap-2" role="tablist" aria-label="Connect Feed filter">
   {modeOptions.map(([v,label])=><button key={v} type="button" role="tab" aria-selected={mode===v} className={mode===v?primary:secondary} onClick={()=>setMode(v)}>{label}</button>)}
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
   {mode==='friends'?'Your friends’ approved posts will appear here. Connect with members to build your feed.':mode==='following'?'Follow verified members to see their posts here.':'No approved posts have been published here yet.'}
  </div>}
  {cursor&&<button className={secondary+' w-full'} onClick={()=>void load(true)} disabled={loading}>Load more posts</button>}
  {loading&&<p role="status" className="text-center text-sm text-[var(--cc-text-secondary)]">Loading Connect Feed…</p>}
 </section>;
}