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
const audienceLabels={friends:'Friends',verified:'Verified Community',only_me:'Only me'};
async function action(name,payload={}){
 const {data,error}=await supabase.functions.invoke('connect-feed',{body:{action:name,...payload}});
 if(error||data?.error){
  let msg=data?.error||'Connect Feed is unavailable. Try again.';
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
  const url=new URL(window.location.href);
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
export default function ConnectFeed({userId,paid=false,preview=false,initialMode='friends',profileId=null}){
 const modeOptions=profileId?[['profile','Posts']]:[['friends','Friends'],['following','Following'],['discover','Discover']];
 const [mode,setMode]=useState(profileId?'profile':initialMode),[items,setItems]=useState([]),[cursor,setCursor]=useState(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [text,setText]=useState(''),[audience,setAudience]=useState('friends'),[gallery,setGallery]=useState([]);
 const [mediaIds,setMediaIds]=useState([]),[uploadFile,setUploadFile]=useState(null),[rights,setRights]=useState(false),[uploading,setUploading]=useState(false);
 const reqNo=useRef(0),posting=useRef(false);
 const load=useCallback(async(more=false)=>{
  if(more&&!cursor)return;const seq=++reqNo.current;setLoading(true);setError('');
  try{
   const result=await action('feed',{mode:profileId?'profile':mode,author_id:profileId||undefined,
    ...(more&&cursor?cursor:{})});
   if(seq!==reqNo.current)return;
   setItems(prior=>more?[...prior,...(result.items||[])]:result.items||[]);
   setCursor(result.cursor||null);
  }catch(e){if(seq===reqNo.current)setError(e.message);}finally{if(seq===reqNo.current)setLoading(false);}
 },[mode,profileId,cursor?.before,cursor?.before_id]);
 useEffect(()=>{
  reqNo.current++;setCursor(null);setItems([]);
  let alive=true;setLoading(true);setError('');
  void action('feed',{mode:profileId?'profile':mode,author_id:profileId||undefined})
   .then(data=>{if(alive){setItems(data.items||[]);setCursor(data.cursor||null);}},e=>{if(alive)setError(e.message);})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;reqNo.current++;};
 },[mode,profileId,userId]);
 const photos=async()=>{
  try{const result=await action('my_photos');setGallery(result.items||[]);}catch(e){setError(e.message);}
 };
 const upload=async()=>{
  if(!paid||!uploadFile||!rights||uploading||!userId)return;
  setUploading(true);setError('');setNotice('');
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(uploadFile.type)||uploadFile.size>8*1024*1024)
    throw Error('Use JPG, PNG or WebP photos of no more than 8 MB.');
   const ext=uploadFile.type.split('/')[1];
   const path=userId+'/media/'+crypto.randomUUID()+'.'+ext;
   const {error:failure}=await supabase.storage.from('member-private').upload(path,uploadFile,{
    contentType:uploadFile.type,upsert:false,cacheControl:'0'
   });
   if(failure)throw failure;
   const {data,error:registerError}=await supabase.functions.invoke('media-gateway',{body:{
    action:'register_upload',storage_path:path,mime_type:uploadFile.type,caption:'Connect Feed photo',visibility:audience==='verified'?'verified':'connections',attest_rights:true
   }});
   if(registerError||data?.error)throw Error(data?.error||'Photo review submission failed. Contact support if it persists.');
   setUploadFile(null);setRights(false);
   setNotice('Photo uploaded for moderation. When it is approved, refresh your photo library and attach it to a post.');
  }catch(e){setError(e.message);}finally{setUploading(false);}
 };
 const publish=async event=>{
  event.preventDefault();if(posting.current||!paid||preview)return;
  posting.current=true;setLoading(true);setError('');setNotice('');
  try{
   const result=await action('create',{text,audience,media_ids:mediaIds});
   setText('');setMediaIds([]);
   setNotice(result.note||'Post submitted for moderation.');
  }catch(e){setError(e.message);}finally{posting.current=false;setLoading(false);}
 };
 return <section data-connect-feed="true" className="min-w-0 space-y-4" aria-label={profileId?'Profile timeline':'Connect Feed'}>
  {!profileId&&<header className="flex flex-wrap items-center justify-between gap-2">
   <div><h2 className="text-xl font-bold">Connect Feed</h2><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Updates from your verified professional network.</p></div>
   <button className={secondary} disabled={loading} onClick={()=>void load(false)} aria-label="Refresh Connect Feed"><RefreshCw size={16}/>Refresh</button>
  </header>}
  {paid&&!preview&&!profileId?<form className="ccx-surface space-y-3 rounded-2xl p-4 sm:p-5" onSubmit={publish}>
   <label className="block text-sm font-semibold">Share an update
    <textarea className={input+' mt-2'} value={text} rows={3} required minLength={5} maxLength={3000}
     onChange={e=>setText(e.target.value)} placeholder="Share your projects, photos, collaborations or professional updates…"/>
   </label>
   <div className="flex flex-wrap items-center gap-2">
    <label className="text-xs">Audience
     <select className="ml-2 min-h-11 rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-2" value={audience} onChange={e=>{setAudience(e.target.value);setMediaIds([]);}}>
      {Object.entries(audienceLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}
     </select>
    </label>
    <button className={secondary} type="button" onClick={()=>void photos()}><ImagePlus size={16}/>Approved photos</button>
    <button className={primary} type="submit" disabled={loading||text.trim().length<5}>Submit post</button>
   </div>
   {gallery.length>0&&<div className="space-y-2"><p className="text-xs">Choose up to four approved photos from your media library. Private photos cannot be shared.</p>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{gallery.filter(m=>m.visibility==='verified'||audience!=='verified'&&m.visibility==='connections').map(photo=><button key={photo.id} type="button" aria-pressed={mediaIds.includes(photo.id)} className={'overflow-hidden rounded-xl border-2 '+(mediaIds.includes(photo.id)?'border-[var(--cc-link)]':'border-transparent')} onClick={()=>setMediaIds(v=>v.includes(photo.id)?v.filter(id=>id!==photo.id):v.length<4?[...v,photo.id]:v)}>
     <img src={photo.url} alt={photo.caption||'Approved photo'} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full object-cover"/>
    </button>)}</div>
    <p className="text-xs">{mediaIds.length} of 4 photos selected</p>
   </div>}
   <details className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">
    <summary className="cursor-pointer font-semibold">Upload a new photo for moderation</summary>
    <p className="mt-2 text-xs">New photos must be approved before they can appear in a feed. No explicit media, private ID records, or content without participant rights.</p>
    <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-xs" onChange={e=>setUploadFile(e.target.files?.[0]||null)}/>
    <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/><span>I own the necessary rights and have required participant permissions to share this photo.</span></label>
    <button type="button" className={secondary+' mt-3'} disabled={uploading||!uploadFile||!rights} onClick={()=>void upload()}>{uploading?'Uploading…':'Send photo for approval'}</button>
   </details>
   <p className="text-xs text-[var(--cc-text-secondary)]">Posting and reposting require Premium. All posts and comments remain private until moderation approves them.</p>
  </form>:!profileId&&<div className="ccx-surface rounded-xl p-4 text-sm text-[var(--cc-text-secondary)]">Verified Free members can browse, like, save, share links and submit moderated comments. Premium is required to publish posts, upload photos or repost.</div>}
  {!profileId&&<div className="flex flex-wrap gap-2" role="tablist" aria-label="Connect Feed filter">
   {modeOptions.map(([v,label])=><button key={v} type="button" role="tab" aria-selected={mode===v} className={mode===v?primary:secondary} onClick={()=>setMode(v)}>{label}</button>)}
  </div>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">{notice}</p>}
  <div className="space-y-4">{items.map(post=><FeedPost key={post.id} post={post} paid={paid} userId={userId} onError={setError} onChanged={()=>void load(false)}/>)}</div>
  {!loading&&items.length===0&&<div className="ccx-surface rounded-xl p-6 text-center text-sm text-[var(--cc-text-secondary)]">
   {mode==='friends'?'Your friends’ approved posts will appear here. Connect with members to build your feed.':mode==='following'?'Follow verified members to see their posts here.':'No approved posts have been published here yet.'}
  </div>}
  {cursor&&<button className={secondary+' w-full'} onClick={()=>void load(true)} disabled={loading}>Load more posts</button>}
  {loading&&<p role="status" className="text-center text-sm text-[var(--cc-text-secondary)]">Loading Connect Feed…</p>}
 </section>;
}