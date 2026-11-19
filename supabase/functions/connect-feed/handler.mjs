/** Connect Feed: browser requests are never trusted to choose actor or audience.
 * All post visibility is enforced by service-only PostgreSQL procedures.
 * Photos are served from private Storage via short-lived viewer-authorized URLs.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const modes=new Set(['friends','following','discover','profile']);
const flags=new Set(['unsafe','rights','privacy','harassment','other']);
const actions=new Set(['feed','create','repost','like','unlike','comment','comments','save','unsave','report','hide','my_photos']);
const clientErrorCodes={
 FEED_PREMIUM_REQUIRED:[403,'Premium membership is required to publish or repost.'],
 FEED_NOT_VERIFIED:[403,'Complete verified adult onboarding to use the feed.'],
 FEED_INVALID_QUERY:[400,'Invalid feed request.'],
 FEED_INVALID_POST:[400,'Add a post of 5–3,000 characters and at most four approved photos.'],
 FEED_POST_UNAVAILABLE:[404,'This post is not available to your account.'],
 FEED_REPOST_UNAVAILABLE:[403,'This post cannot be reposted.'],
 FEED_MEDIA_NOT_APPROVED:[409,'Select only photos that have passed review and are shared with the selected audience.'],
 FEED_DUPLICATE_MEDIA:[400,'Choose distinct photos.'],
 FEED_INVALID_COMMENT:[400,'Comments must contain 2–2,000 characters.'],
 FEED_INVALID_REPORT:[403,'This report cannot be recorded.'],
 FEED_RATE_LIMIT:[429,'Your daily community activity limit has been reached.'],
 FEED_INVALID_ACTION:[400,'Unsupported feed action.']
};
async function boundedBody(req){
 if(Number(req.headers.get('content-length')||0)>20000)throw Error('TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)return null;
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000)throw Error('TOO_LARGE');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
async function resultOrThrow(task){
 const {data,error}=await task;
 if(error){const code=Object.keys(clientErrorCodes).find(k=>String(error.message).includes(k));throw Object.assign(new Error(code||'DATABASE_ERROR'),{code:code||'DATABASE_ERROR'});}
 return data;
}
export function createConnectFeedHandler({authenticate,db,storage}){
 const rpc=(name,args)=>resultOrThrow(db.rpc(name,args));
 const allowed=async(user,post)=>rpc('ccx_feed_can_view',{p_actor:user,p_post:post});
 const mediaUrl=async(path)=>{
  if(typeof path!=='string'||!path.startsWith('/')){/* paths are bucket-relative */}
  if(typeof path!=='string'||!/^[-\w/\.]+$/.test(path)||path.includes('..'))return null;
  const {data,error}=await storage.from('member-private').createSignedUrl(path,180);
  return error?null:data?.signedUrl||null;
 };
 const decorate=async items=>Promise.all(items.map(async post=>{
  const photos=await Promise.all((post.media||[]).slice(0,4).map(async media=>{
   const url=await mediaUrl(media.path);
   return url?{id:media.id,url,caption:media.caption||'',mime_type:media.mime_type}:null;
  }));
  const original=post.original?{id:post.original.id,body:post.original.body,author_id:post.original.author_id,
   author_name:post.original.author_name||'Member',created_at:post.original.created_at}:null;
  return {id:post.id,author_id:post.author_id,author:{display_name:post.display_name||'Member',role_type:post.role_type||''},
   body:post.body,audience:post.audience,repost_of:post.repost_of||null,allow_repost:post.allow_repost===true,
   published_at:post.published_at,photos:photos.filter(Boolean),likes:Number(post.likes)||0,liked:post.liked===true,
   comments:Number(post.comments)||0,saved:post.saved===true,reposts:Number(post.reposts)||0,original};
 }));
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const user=await authenticate(req);
   if(!user?.id||user.is_anonymous)return reply({error:'Sign in to access Connect Feed.'},401);
   const body=await boundedBody(req);
   if(!body||typeof body!=='object'||Array.isArray(body)||!actions.has(body.action))
    return reply({error:'Invalid feed action.'},400);
   const who=user.id,action=body.action;
   if(action==='feed'){
    const mode=modes.has(body.mode)?body.mode:'friends';
    const author=mode==='profile'&&uuid(body.author_id)?body.author_id:null;
    if(mode==='profile'&&!author)return reply({error:'Select a valid profile.'},400);
    const before=typeof body.before==='string'&&Number.isFinite(Date.parse(body.before))?body.before:null;
    const beforeId=uuid(body.before_id)?body.before_id:null;
    const limit=16;
    const raw=await rpc('ccx_feed_page',{p_actor:who,p_mode:mode,p_author:author,
      p_before:before,p_before_id:beforeId,p_limit:limit});
    const items=await decorate(raw?.items||[]);
    const last=items.at(-1);
    return reply({items,cursor:items.length===limit?{before:last.published_at,before_id:last.id}:null,
      posting_requires_premium:true});
   }
   if(action==='my_photos'){
    const rows=await resultOrThrow(db.from('member_media_assets')
      .select('id,caption,mime_type,storage_path,visibility').eq('owner_id',who)
      .eq('status','approved').eq('uploader_rights_attested',true)
      .in('mime_type',['image/jpeg','image/png','image/webp']).order('created_at',{ascending:false}).limit(30));
    const items=await Promise.all((rows||[]).map(async media=>{
     const url=await mediaUrl(media.storage_path);
     return url?{id:media.id,caption:media.caption,url,visibility:media.visibility}:null;
    }));
    return reply({items:items.filter(Boolean)});
   }
   if(action==='create'||action==='repost'){
    if(typeof body.text!=='string'||body.text.trim().length<5||body.text.length>3000)
      return reply({error:'Write 5–3,000 characters before submitting.'},400);
    const media=Array.isArray(body.media_ids)&&body.media_ids.length<=4&&body.media_ids.every(uuid)?body.media_ids:[];
    if(Array.isArray(body.media_ids)&&(media.length!==body.media_ids.length))
      return reply({error:'Choose up to four approved photos.'},400);
    const audience=['verified','friends','only_me'].includes(body.audience)?body.audience:'friends';
    const id=action==='repost'&&uuid(body.post_id)?body.post_id:null;
    if(action==='repost'&&!id)return reply({error:'Select a valid post to repost.'},400);
    const out=await rpc('ccx_feed_create',{p_actor:who,p_body:body.text,p_audience:audience,
      p_media:media,p_repost:id});
    return reply({item:out,note:'Submitted for moderation. Your update is not visible to friends until approved.'},201);
   }
   if(!uuid(body.post_id))return reply({error:'Select a valid post.'},400);
   if(action==='hide'){
    const ok=await rpc('ccx_feed_hide',{p_actor:who,p_post:body.post_id});
    return reply({hidden:ok===true});
   }
   if(action==='report'){
    if(!flags.has(body.reason))return reply({error:'Select a reporting category.'},400);
    const out=await rpc('ccx_feed_report',{p_actor:who,p_post:body.post_id,p_reason:body.reason});
    return reply({received:out?.received===true,reference:out?.reference,
      note:'Report received for moderation. This does not confirm a removal or emergency response.'});
   }
   const readable=await allowed(who,body.post_id);
   if(!readable)return reply({error:'This post is not available to your account.'},404);
   if(action==='comments'){
    const rows=await resultOrThrow(db.from('community_comments')
      .select('id,author_id,body,created_at').eq('post_id',body.post_id).eq('status','published')
      .order('created_at',{ascending:true}).limit(80));
    const blocked=await resultOrThrow(db.from('member_blocks').select('blocker_id,blocked_id')
      .or('blocker_id.eq.'+who+',blocked_id.eq.'+who).limit(500));
    const hidden=new Set((blocked||[]).map(b=>b.blocker_id===who?b.blocked_id:b.blocker_id));
    const visible=(rows||[]).filter(r=>!hidden.has(r.author_id));
    const ids=[...new Set(visible.map(r=>r.author_id))];
    const profiles=ids.length?await resultOrThrow(db.from('member_profiles')
      .select('id,display_name').in('id',ids)):[];
    return reply({items:visible.map(r=>({id:r.id,author_id:r.author_id,body:r.body,
      created_at:r.created_at,author_name:(profiles||[]).find(p=>p.id===r.author_id)?.display_name||'Member'}))});
   }
   if(action==='comment'){
    if(typeof body.text!=='string'||body.text.length>2000)return reply({error:'Enter a valid comment.'},400);
    const out=await rpc('ccx_feed_interact',{p_actor:who,p_post:body.post_id,p_action:'comment',p_text:body.text});
    return reply({status:out?.status,note:'Comment submitted for moderation.'},201);
   }
   if(['like','unlike','save','unsave'].includes(action)){
    const out=await rpc('ccx_feed_interact',{p_actor:who,p_post:body.post_id,p_action:action,p_text:null});
    return reply(out);
   }
   return reply({error:'Unsupported feed action.'},400);
  }catch(error){
   if(error?.message==='TOO_LARGE')return reply({error:'Feed request is too large.'},413);
   const detail=clientErrorCodes[error?.code];
   if(detail)return reply({error:detail[1]},detail[0]);
   // Never log user posts, image paths, credentials or other private fields.
   return reply({error:'Connect Feed could not complete this request. Check your connection and try again.'},503);
  }
 };
}