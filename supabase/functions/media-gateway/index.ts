/**
 * OpenModerate-compatible private media workflow.
 *
 * Private files never become public objects. Server checks 18+ and memberships,
 * performs optional scans against a configured self-hosted OpenModerate endpoint,
 * and requires human review before any viewer receives a short-lived URL.
 * The moderation model is NOT an age/consent/identity verification system.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const plain=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
// The JWT has already been validated by Supabase Auth.getUser before this is used.
const assurance=(header:string)=>{
  try {
    const jwt=header.replace(/^Bearer\s+/i,'');
    const payload=jwt.split('.')[1];
    const base64=payload.replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'=')));
    return claims?.aal==='aal2'?'aal2':'aal1';
  } catch {return 'aal1';}
};

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return reply({error:'Backend unavailable'},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return reply({error:'Unauthorized'},401);
  const db=createClient(url,secret),uid=user.id;
  const [sec,age,sub,flag]=await Promise.all([
    db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
    db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
    db.from('product_feature_flags').select('enabled,allowed_tiers').eq('key','media_gallery').maybeSingle()
  ]);
  if(sec.error||age.error||sub.error||flag.error)return reply({error:'Account status unavailable'},503);
  if(sec.data?.banned||sec.data?.suspended)return reply({error:'Account unavailable'},403);
  const latest=age.data?.[0];
  if(latest?.status!=='approved'||(latest.expires_at&&Date.parse(latest.expires_at)<Date.now()))
    return reply({error:'Age verification required'},403);
  const admin=sec.data?.admin===true;
  const paid=admin||['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now());
  if(!flag.data?.enabled)return reply({error:'Media gallery is disabled'},403);
  const allowed=flag.data?.allowed_tiers||[];
  if(!allowed.includes(paid?'premium':'free'))return reply({error:'Media gallery unavailable to this membership'},403);
  const body=await req.json().catch(()=>({}));
  const action=body.action;
  if(admin&&String(action).startsWith('admin_')&&assurance(req.headers.get('Authorization')||'')!=='aal2')return reply({error:'Administrator MFA required'},403);
  const bucket=db.storage.from('member-private');
  const audit=async(event:string,target:string,details:Record<string,unknown>={})=>{
    await db.from('platform_action_audit').insert({actor_id:uid,action:event,target_type:'media',target_id:target,metadata:details});
  };
  try{
    if(action==='register_upload'){
      if(!paid)return reply({error:'Premium membership required for uploads'},403);
      if(body.attest_rights!==true)return reply({error:'Confirm your authority and all required participant permissions before uploading'},400);
      const path=plain(body.storage_path,500),type=plain(body.mime_type,90);
      const prefix=uid+'/media/';
      if(!path.startsWith(prefix)||path.includes('..')||!/^[-\w./]+$/.test(path))
        return reply({error:'Invalid private media path'},400);
      if(!['image/jpeg','image/png','image/webp','video/mp4'].includes(type))
        return reply({error:'Unsupported media type'},400);
      const meta=await bucket.info(path);
      if(meta.error||!meta.data)return reply({error:'Upload media to your private account folder first'},400);
      if(meta.data.metadata?.mimetype&&meta.data.metadata.mimetype!==type)
        return reply({error:'MIME type mismatch'},400);
      const {count,error:rateError}=await db.from('member_media_assets').select('id',{count:'exact',head:true})
        .eq('owner_id',uid).gte('created_at',new Date(Date.now()-86400000).toISOString());
      if(rateError)return reply({error:'Upload limit unavailable'},503);
      if((count||0)>=10)return reply({error:'Daily media submission limit reached'},429);
      const visibility=['verified','connections','private'].includes(body.visibility)?body.visibility:'verified';
      const {data,error}=await db.from('member_media_assets').insert({
        owner_id:uid,storage_path:path,mime_type:type,caption:plain(body.caption,500),
        status:'pending',visibility,uploader_rights_attested:true,rights_attested_at:new Date().toISOString()
      }).select('id,status').single();
      if(error)return reply({error:'Media could not be registered'},400);
      const {error:queueError}=await db.from('content_moderation_queue').insert({
        content_type:'media',content_id:data.id,submitter_id:uid,status:'pending'
      });
      if(queueError){
        await db.from('member_media_assets').delete().eq('id',data.id);
        return reply({error:'Moderation queue unavailable'},503);
      }
      await audit('media_submitted',data.id);
      return reply({item:data,note:'Media is private until approved by a moderator'},201);
    }
    if(action==='my_media'){
      const {data,error}=await db.from('member_media_assets')
        .select('id,caption,status,visibility,mime_type,created_at').eq('owner_id',uid)
        .order('created_at',{ascending:false}).limit(60);
      if(error)throw error;
      return reply({items:data||[]});
    }
    if(action==='gallery'){
      const target=uuid(body.owner_id)?body.owner_id:uid;
      let q=db.from('member_media_assets')
        .select('id,owner_id,caption,status,mime_type,visibility,created_at')
        .eq('owner_id',target).eq('status','approved').order('created_at',{ascending:false}).limit(50);
      const {data,error}=await q;if(error)throw error;
      const [ownerAge,ownerSecurity]=await Promise.all([
        db.from('age_verification_requests').select('status,expires_at').eq('user_id',target)
          .order('created_at',{ascending:false}).limit(1),
        db.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle()
      ]);
      if(ownerAge.error||ownerSecurity.error||ownerSecurity.data?.banned||
        ownerSecurity.data?.suspended||ownerAge.data?.[0]?.status!=='approved'||
        (ownerAge.data?.[0]?.expires_at&&Date.parse(ownerAge.data[0].expires_at)<Date.now()))
        return reply({items:[]});
      const {data:blocks,error:blockError}=await db.from('member_blocks').select('blocker_id')
        .or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1);
      if(blockError)throw blockError;
      if(blocks?.length)return reply({items:[]});
      const {data:connections,error:connectError}=await db.from('member_connection_requests')
        .select('id').eq('status','accepted')
        .or(`and(requester_id.eq.${uid},recipient_id.eq.${target}),and(requester_id.eq.${target},recipient_id.eq.${uid})`).limit(1);
      if(connectError)throw connectError;
      const connected=Boolean(connections?.length);
      const filtered=(data||[]).filter((m:any)=>
        m.owner_id===uid||m.visibility==='verified'||m.visibility==='connections'&&connected
      );
      return reply({items:filtered});
    }
    if(action==='view'){
      if(!uuid(body.id))return reply({error:'Invalid media'},400);
      const {data:asset,error}=await db.from('member_media_assets')
        .select('id,owner_id,storage_path,status,visibility,mime_type').eq('id',body.id).maybeSingle();
      if(error||!asset)return reply({error:'Media not found'},404);
      if(asset.owner_id!==uid&&asset.status!=='approved')return reply({error:'Media not available'},403);
      if(asset.owner_id!==uid){
        const [ownerAge,ownerSecurity]=await Promise.all([
          db.from('age_verification_requests').select('status,expires_at')
            .eq('user_id',asset.owner_id).order('created_at',{ascending:false}).limit(1),
          db.from('account_security').select('banned,suspended')
            .eq('user_id',asset.owner_id).maybeSingle()
        ]);
        if(ownerAge.error||ownerSecurity.error||ownerSecurity.data?.banned||
          ownerSecurity.data?.suspended||ownerAge.data?.[0]?.status!=='approved'||
          (ownerAge.data?.[0]?.expires_at&&Date.parse(ownerAge.data[0].expires_at)<Date.now()))
          return reply({error:'Media unavailable'},403);
        if(asset.visibility==='private')return reply({error:'Private media'},403);
        const {data:blocks,error:blockError}=await db.from('member_blocks').select('blocker_id')
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${asset.owner_id}),and(blocker_id.eq.${asset.owner_id},blocked_id.eq.${uid})`).limit(1);
        if(blockError||blocks?.length)return reply({error:'Media unavailable'},403);
        if(asset.visibility==='connections'){
          const {data:connection,error:cError}=await db.from('member_connection_requests')
            .select('id').eq('status','accepted')
            .or(`and(requester_id.eq.${uid},recipient_id.eq.${asset.owner_id}),and(requester_id.eq.${asset.owner_id},recipient_id.eq.${uid})`).limit(1);
          if(cError||!connection?.length)return reply({error:'Connection required'},403);
        }
      }
      const {data:link,error:linkError}=await bucket.createSignedUrl(asset.storage_path,60);
      if(linkError)return reply({error:'Media URL unavailable'},503);
      return reply({url:link.signedUrl,expires_in:60,mime_type:asset.mime_type});
    }
    if(action==='admin_queue'){
      if(!admin)return reply({error:'Administrator required'},403);
      const {data,error}=await db.from('member_media_assets')
        .select('id,owner_id,caption,status,mime_type,created_at,uploader_rights_attested')
        .eq('status','pending').order('created_at').limit(70);
      if(error)throw error;
      return reply({items:data||[]});
    }
    if(action==='admin_scan'){
      if(!admin)return reply({error:'Administrator required'},403);
      if(!uuid(body.id))return reply({error:'Invalid asset'},400);
      const endpoint=Deno.env.get('OPENMODERATE_SERVICE_URL'),key=Deno.env.get('OPENMODERATE_API_KEY');
      if(!endpoint||!key)return reply({error:'Self-hosted OpenModerate service is not configured'},503);
      const target=new URL(endpoint);
      if(target.protocol!=='https:'||!target.pathname.endsWith('/v1/moderate'))
        return reply({error:'Only a configured HTTPS OpenModerate endpoint is permitted'},503);
      const {data:media,error}=await db.from('member_media_assets')
        .select('id,storage_path,mime_type').eq('id',body.id).maybeSingle();
      if(error||!media)return reply({error:'Media not found'},404);
      if(media.mime_type==='video/mp4')
        return reply({error:'Video scanning requires a dedicated processing worker; manual moderation remains required'},503);
      const {data:file,error:downloadError}=await bucket.download(media.storage_path);
      if(downloadError||!file)return reply({error:'Media unavailable'},503);
      const form=new FormData();
      form.append('file',file,media.id+(media.mime_type==='video/mp4'?'.mp4':'.jpg'));
      const response=await fetch(target.toString(),{
        method:'POST',headers:{'X-API-Key':key},body:form,signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)return reply({error:'Moderation service unavailable'},503);
      const result=await response.json();
      // An adult platform must not reject consensual adult nudity automatically.
      // Human review remains mandatory, and AI cannot certify legal age.
      const signals=Array.isArray(result?.violations)?
        result.violations.filter((v:any)=>['violence','weapons','hate_symbols','drugs'].includes(v.name))
          .map((v:any)=>({category:String(v.name),confidence:Number(v.confidence)||0})):[];
      await audit('media_scanned',media.id,{signals:signals.map(v=>v.category)});
      return reply({human_review_required:true,signals,
        note:'Model observations are advisory only. Verify content rights, age and consent independently.'});
    }
    if(action==='admin_review'){
      if(!admin)return reply({error:'Administrator required'},403);
      if(!uuid(body.id)||!['approved','rejected'].includes(body.status))
        return reply({error:'Invalid review'},400);
      const {data:asset,error}=await db.from('member_media_assets')
        .select('id,status,uploader_rights_attested').eq('id',body.id).maybeSingle();
      if(error||asset?.status!=='pending')return reply({error:'Media already reviewed'},409);
      if(!asset.uploader_rights_attested)return reply({error:'Uploader rights attestation required'},403);
      if(body.status==='approved' && Deno.env.get('ADULT_MEDIA_PUBLICATION_READY')!=='true')
        return reply({error:'Publication is paused until releases, retention and content-review policies are approved'},503);
      if(body.manual_review_confirmed!==true)return reply({error:'Human content and consent review is required'},400);
      const {data,error:saveError}=await db.from('member_media_assets').update({
        status:body.status,reviewed_by:uid,reviewed_at:new Date().toISOString()
      }).eq('id',body.id).eq('status','pending').select('id,status').maybeSingle();
      if(saveError||!data)return reply({error:'Moderation conflict'},409);
      await db.from('content_moderation_queue').update({
        status:body.status==='approved'?'approved':'rejected',
        reviewer_id:uid,reviewed_at:new Date().toISOString()
      }).eq('content_type','media').eq('content_id',body.id);
      await audit('media_reviewed',data.id,{status:data.status});
      return reply({item:data});
    }
    return reply({error:'Unknown action'},404);
  }catch(e){
    console.error('media-gateway',action,e);
    return reply({error:'Unable to process media action'},500);
  }
});
