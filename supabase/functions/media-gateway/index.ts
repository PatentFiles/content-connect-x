import {optionalProviderSetting} from './providerConfig.mjs';
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
  'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const plain=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:200,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return reply({error:'Backend unavailable'},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return reply({error:'Unauthorized'},401);
  const db=createClient(url,secret),uid=user.id;
  const [sec,age,sub,flag]=await Promise.all([
    db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
    db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
    db.from('product_feature_flags').select('enabled,allowed_tiers').eq('key','media_gallery').maybeSingle()
  ]);
  if(sec.error||age.error||sub.error||flag.error)return reply({error:'Account status unavailable'},503);
  if(sec.data?.banned||sec.data?.suspended)return reply({error:'Account unavailable'},403);
  const latest=age.data?.[0];
  if(!latest?.admitted_at)
    return reply({error:'Complete account onboarding first'},403);
  const admin=sec.data?.admin===true;
  const paid=admin||['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now());
  if(!flag.data?.enabled)return reply({error:'Media gallery is disabled'},403);
  const allowed=flag.data?.allowed_tiers||[];
  if(!allowed.includes(paid?'premium':'free'))return reply({error:'Media gallery unavailable to this membership'},403);
  const body=await req.json().catch(()=>({}));
  const action=body.action;
  if(String(action).startsWith('admin_')&&!admin)return reply({error:'Administrator access required'},403);
  const bucket=db.storage.from('member-private');
  const audit=async(event:string,target:string,details:Record<string,unknown>={})=>{
    await db.from('platform_action_audit').insert({actor_id:uid,action:event,target_type:'media',target_id:target,metadata:details});
  };
  try{
    if(action==='register_self_feed_photo'){
      // Solo images only: account verification is NOT verification of other performers.
      if(!paid)return reply({error:'Premium membership is required to publish photos'},403);
      if(body.attest_self_only!==true||body.attest_rights!==true||body.attest_no_sex_act!==true)
        return reply({error:'Confirm that the photo depicts only you, you control the rights, and no sexual act is shown.'},400);
      const path=plain(body.storage_path,500),type=plain(body.mime_type,90);
      const prefix=uid+'/media/';
      const fileName=path.startsWith(prefix)?path.slice(prefix.length):'';
      if(!uuid(fileName.split('.')[0])||fileName.split('.').length!==2||!['jpg','jpeg','png','webp'].includes(fileName.split('.')[1]))
        return reply({error:'Invalid private photo path'},400);
      if(!['image/jpeg','image/png','image/webp'].includes(type))
        return reply({error:'Only JPG, PNG and WebP photos are supported'},400);
      const contentLabel=body.content_label==='adult_nudity'?'adult_nudity':'professional';
      const info=await bucket.info(path);
      if(info.error||!info.data)return reply({error:'Upload the photo to your private account first'},400);
      if(info.data.metadata?.mimetype&&info.data.metadata.mimetype!==type)
        return reply({error:'The stored photo has a different MIME type'},400);
      const storedSize=Number(info.data.metadata?.size||info.data.size);
      if(!Number.isSafeInteger(storedSize)||storedSize<16||storedSize>8*1024*1024)
        return reply({error:'Photo size must be between 16 bytes and 8 MB'},400);
      const {data:file,error:downloadError}=await bucket.download(path);
      if(downloadError||!file)return reply({error:'Photo verification unavailable'},503);
      const bytes=new Uint8Array(await file.arrayBuffer());
      const magicOk=type==='image/jpeg'
        ?bytes[0]===255&&bytes[1]===216&&bytes[2]===255
        :type==='image/png'
          ?bytes.slice(0,8).every((b,i)=>b===[137,80,78,71,13,10,26,10][i])
          :String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if(!magicOk)return reply({error:'Unsupported or invalid photo content'},400);
      const {count,error:rateError}=await db.from('member_media_assets')
        .select('id',{count:'exact',head:true}).eq('owner_id',uid)
        .gte('created_at',new Date(Date.now()-86400000).toISOString());
      if(rateError)return reply({error:'Media rate limit unavailable'},503);
      if((count||0)>=10)return reply({error:'Daily media upload limit reached'},429);
      const visibility=body.visibility==='connections'?'connections':'verified';
      const {data:asset,error:saveError}=await db.from('member_media_assets').insert({
        owner_id:uid,storage_path:path,mime_type:type,caption:plain(body.caption,500),
        status:'approved',visibility,uploader_rights_attested:true,rights_attested_at:new Date().toISOString(),
        approval_origin:'verified_self_attestation',self_only_attested:true,content_label:contentLabel
      }).select('id,status,content_label').single();
      if(saveError||!asset)return reply({error:'Photo registration failed'},409);
      const {error:auditError}=await db.from('platform_action_audit').insert({
        actor_id:uid,action:'media_self_published',target_type:'media',target_id:asset.id,
        metadata:{publication_basis:'verified_solo_attestation',content_label:contentLabel}
      });
      if(auditError){
        await db.from('member_media_assets').update({status:'hidden'})
          .eq('id',asset.id).eq('owner_id',uid);
        return reply({error:'Publishing audit unavailable. Photo was not published.'},503);
      }
      return reply({item:asset,note:'Photo is ready to share. Rights and safety reports can temporarily remove it.'},201);
    }
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
      let albumId:string|null=null;
      if(uuid(body.album_id)){
        const {data:album}=await db.from('member_media_albums').select('id').eq('id',body.album_id).eq('owner_id',uid).maybeSingle();
        if(album)albumId=album.id;
      }
      const {data,error}=await db.from('member_media_assets').insert({
        owner_id:uid,storage_path:path,mime_type:type,caption:plain(body.caption,500),
        status:'pending',visibility,album_id:albumId,allow_repost:visibility==='verified'&&body.allow_repost===true,
        uploader_rights_attested:true,rights_attested_at:new Date().toISOString()
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
        .select('id,caption,status,visibility,mime_type,album_id,created_at').eq('owner_id',uid)
        .order('created_at',{ascending:false}).limit(60);
      if(error)throw error;
      return reply({items:data||[]});
    }
    if(action==='list_albums'){
      const {data,error}=await db.from('member_media_albums')
        .select('id,title,created_at,updated_at').eq('owner_id',uid)
        .order('created_at',{ascending:false});
      if(error)throw error;
      const albums=(data||[]).map((a:any)=>({...a,count:0}));
      if(albums.length){
        const {data:counts}=await db.from('member_media_assets')
          .select('album_id').in('album_id',albums.map((a:any)=>a.id));
        const map:Record<string,number>={};
        for(const c of counts||[]){if(c.album_id)map[c.album_id]=(map[c.album_id]||0)+1;}
        for(const a of albums)a.count=map[a.id]||0;
      }
      return reply({items:albums});
    }
    if(action==='create_album'){
      if(!paid)return reply({error:'Premium membership required for albums'},403);
      const title=plain(body.title,120);
      if(!title)return reply({error:'Album title is required'},400);
      const {count}=await db.from('member_media_albums').select('id',{count:'exact',head:true}).eq('owner_id',uid);
      if((count||0)>=20)return reply({error:'Album limit reached (20)'},429);
      const {data,error}=await db.from('member_media_albums').insert({owner_id:uid,title})
        .select('id,title,created_at').single();
      if(error)return reply({error:'Could not create album'},400);
      return reply({item:data},201);
    }
    if(action==='update_album'){
      if(!uuid(body.album_id))return reply({error:'Invalid album'},400);
      const title=plain(body.title,120);
      if(!title)return reply({error:'Album title is required'},400);
      const {data,error}=await db.from('member_media_albums').update({title,updated_at:new Date().toISOString()})
        .eq('id',body.album_id).eq('owner_id',uid).select('id,title').maybeSingle();
      if(error||!data)return reply({error:'Album not found'},404);
      return reply({item:data});
    }
    if(action==='delete_album'){
      if(!uuid(body.album_id))return reply({error:'Invalid album'},400);
      const {error}=await db.from('member_media_albums').delete().eq('id',body.album_id).eq('owner_id',uid);
      if(error)return reply({error:'Could not delete album'},400);
      return reply({ok:true});
    }
    if(action==='assign_album'){
      if(!uuid(body.media_id))return reply({error:'Invalid media'},400);
      let albumId:string|null=null;
      if(uuid(body.album_id)){
        const {data:album}=await db.from('member_media_albums').select('id').eq('id',body.album_id).eq('owner_id',uid).maybeSingle();
        if(!album)return reply({error:'Album not found'},404);
        albumId=album.id;
      }
      const {error}=await db.from('member_media_assets').update({album_id:albumId})
        .eq('id',body.media_id).eq('owner_id',uid);
      if(error)return reply({error:'Could not assign album'},400);
      return reply({ok:true});
    }
    if(action==='gallery'){
      const target=uuid(body.owner_id)?body.owner_id:uid;
      let q=db.from('member_media_assets')
        .select('id,owner_id,caption,status,mime_type,storage_path,visibility,album_id,allow_repost,created_at')
        .eq('owner_id',target).eq('status','approved').order('created_at',{ascending:false}).limit(50);
      if(uuid(body.album_id))q=q.eq('album_id',body.album_id);
      const {data,error}=await q;if(error)throw error;
      const [ownerAge,ownerSecurity]=await Promise.all([
        db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',target)
          .order('created_at',{ascending:false}).limit(1),
        db.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle()
      ]);
      if(ownerAge.error||ownerSecurity.error||ownerSecurity.data?.banned||
        ownerSecurity.data?.suspended||!ownerAge.data?.[0]?.admitted_at)
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
      const ids=filtered.map((m:any)=>m.id);
      const [likes,comments,reposts]=await Promise.all([
        ids.length?db.from('ccx_gallery_likes').select('media_id,user_id').in('media_id',ids):Promise.resolve({data:[],error:null}),
        ids.length?db.from('ccx_gallery_comments').select('media_id').in('media_id',ids).eq('status','published'):Promise.resolve({data:[],error:null}),
        ids.length?db.from('ccx_gallery_reposts').select('media_id').in('media_id',ids):Promise.resolve({data:[],error:null})
      ]);
      if(likes.error||comments.error||reposts.error)return reply({error:'Gallery activity temporarily unavailable'},503);
      const count=(rows:any[],id:string)=>rows.filter(x=>x.media_id===id).length;
      const publicItems=await Promise.all(filtered.map(async(m:any)=>{
        const {data:link,error:linkError}=await bucket.createSignedUrl(m.storage_path,300);
        return {id:m.id,owner_id:m.owner_id,caption:m.caption,mime_type:m.mime_type,
          visibility:m.visibility,album_id:m.album_id,created_at:m.created_at,
          allow_repost:m.allow_repost===true,url:linkError?null:link?.signedUrl||null,
          likes:count(likes.data||[],m.id),comments:count(comments.data||[],m.id),
          reposts:count(reposts.data||[],m.id),
          liked:(likes.data||[]).some(x=>x.media_id===m.id&&x.user_id===uid)};
      }));
      return reply({items:publicItems});
    }
    if(action==='view'){
      if(!uuid(body.id))return reply({error:'Invalid media'},400);
      const {data:asset,error}=await db.from('member_media_assets')
        .select('id,owner_id,storage_path,status,visibility,mime_type').eq('id',body.id).maybeSingle();
      if(error||!asset)return reply({error:'Media not found'},404);
      if(asset.owner_id!==uid&&asset.status!=='approved')return reply({error:'Media not available'},403);
      if(asset.owner_id!==uid){
        const [ownerAge,ownerSecurity]=await Promise.all([
          db.from('member_admissions').select('id,user_id,admitted_at,source,created_at')
            .eq('user_id',asset.owner_id).order('created_at',{ascending:false}).limit(1),
          db.from('account_security').select('banned,suspended')
            .eq('user_id',asset.owner_id).maybeSingle()
        ]);
        if(ownerAge.error||ownerSecurity.error||ownerSecurity.data?.banned||
          ownerSecurity.data?.suspended||!ownerAge.data?.[0]?.admitted_at)
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
    // All gallery engagement is server-authorized. Private storage URLs and
    // declined/unapproved media never enter comments, reactions or the feed.
    if(['gallery_comments','gallery_like','gallery_comment','gallery_repost','gallery_repost_permission'].includes(action)){
      if(!uuid(body.media_id))return reply({error:'Select a valid gallery item'},400);
      const {data:asset,error:assetError}=await db.from('member_media_assets')
        .select('id,owner_id,status,visibility,mime_type,storage_path,allow_repost,uploader_rights_attested')
        .eq('id',body.media_id).maybeSingle();
      if(assetError||!asset||asset.status!=='approved'||!asset.uploader_rights_attested)
        return reply({error:'Gallery item not available'},404);
      const owner=asset.owner_id===uid;
      if(!owner){
        const [admission,security,blocking]=await Promise.all([
          db.from('member_admissions').select('id,admitted_at').eq('user_id',asset.owner_id).not('admitted_at','is',null).limit(1),
          db.from('account_security').select('banned,suspended').eq('user_id',asset.owner_id).maybeSingle(),
          db.from('member_blocks').select('blocker_id')
            .or(`and(blocker_id.eq.${uid},blocked_id.eq.${asset.owner_id}),and(blocker_id.eq.${asset.owner_id},blocked_id.eq.${uid})`).limit(1)
        ]);
        if(admission.error||security.error||blocking.error||!admission.data?.length||
            security.data?.banned||security.data?.suspended||blocking.data?.length)
          return reply({error:'Gallery item not available'},403);
        if(asset.visibility==='private')return reply({error:'Private media'},403);
        if(asset.visibility==='connections'){
          const {data:connections,error}=await db.from('member_connection_requests').select('id').eq('status','accepted')
            .or(`and(requester_id.eq.${uid},recipient_id.eq.${asset.owner_id}),and(requester_id.eq.${asset.owner_id},recipient_id.eq.${uid})`).limit(1);
          if(error||!connections?.length)return reply({error:'Connection required'},403);
        }
      }
      if(action==='gallery_repost_permission'){
        if(!owner||!paid)return reply({error:'Owner Premium membership required'},403);
        const {error}=await db.from('member_media_assets').update({allow_repost:body.allow_repost===true})
          .eq('id',asset.id).eq('owner_id',uid);
        if(error)throw error;
        if(body.allow_repost!==true){
          // Revoke future sharing AND hide previously cross-posted feed entries.
          // Keep the audit trail without leaving unauthorized media visible.
          const {data:shared,error:shareError}=await db.from('ccx_gallery_reposts')
            .select('post_id').eq('media_id',asset.id);
          if(shareError)throw shareError;
          const ids=(shared||[]).map((row:any)=>row.post_id).filter(Boolean);
          if(ids.length){
            const {error:hideError}=await db.from('community_posts')
              .update({hidden_at:new Date().toISOString()}).in('id',ids);
            if(hideError)throw hideError;
          }
          const {error:delError}=await db.from('ccx_gallery_reposts').delete().eq('media_id',asset.id);
          if(delError)throw delError;
        }
        return reply({ok:true,allow_repost:body.allow_repost===true});
      }
      if(!paid)return reply({error:'Premium membership required for gallery interactions'},403);
      if(action==='gallery_comments'){
        const {data:rows,error}=await db.from('ccx_gallery_comments')
          .select('id,media_id,user_id,body,created_at').eq('media_id',asset.id)
          .eq('status','published').order('created_at',{ascending:false}).limit(40);
        if(error)throw error;
        const users=[...new Set((rows||[]).map((v:any)=>v.user_id))];
        const {data:members,error:peopleError}=users.length
          ?await db.from('member_profiles').select('id,display_name').in('id',users)
          :{data:[],error:null};
        if(peopleError)throw peopleError;
        const names=new Map((members||[]).map((m:any)=>[m.id,m.display_name]));
        return reply({items:(rows||[]).map((r:any)=>({id:r.id,body:r.body,created_at:r.created_at,
         author_name:names.get(r.user_id)||'Member',is_mine:r.user_id===uid}))});
      }
      if(action==='gallery_like'){
        const {data:existing,error:readError}=await db.from('ccx_gallery_likes')
          .select('media_id').eq('media_id',asset.id).eq('user_id',uid).maybeSingle();
        if(readError)throw readError;
        if(existing){const {error}=await db.from('ccx_gallery_likes').delete().eq('media_id',asset.id).eq('user_id',uid);if(error)throw error;}
        else{const {error}=await db.from('ccx_gallery_likes').insert({media_id:asset.id,user_id:uid});if(error&&error.code!=='23505')throw error;}
        return reply({liked:!existing});
      }
      if(action==='gallery_comment'){
        const bodyText=plain(body.comment,600);
        if(bodyText.length<2)return reply({error:'Write a comment first'},400);
        const {count,error:limitError}=await db.from('ccx_gallery_comments').select('id',{head:true,count:'exact'})
          .eq('user_id',uid).gte('created_at',new Date(Date.now()-86400000).toISOString());
        if(limitError)throw limitError;
        if((count||0)>=40)return reply({error:'Daily comment limit reached'},429);
        const {error}=await db.from('ccx_gallery_comments')
          .insert({media_id:asset.id,user_id:uid,body:bodyText,status:'published'});
        if(error)throw error;
        return reply({ok:true});
      }
      if(action==='gallery_repost'){
        if(asset.visibility!=='verified'||asset.allow_repost!==true)
          return reply({error:'The owner has not enabled reposting for this media'},403);
        if(asset.mime_type!=='video/mp4'&&!asset.mime_type.startsWith('image/'))
          return reply({error:'Unsupported media'},400);
        const {data:prior,error:priorError}=await db.from('ccx_gallery_reposts')
          .select('post_id').eq('media_id',asset.id).eq('user_id',uid).maybeSingle();
        if(priorError)throw priorError;
        if(prior)return reply({already_reposted:true,post_id:prior.post_id});
        const {data:author}=await db.from('member_profiles').select('display_name').eq('id',asset.owner_id).maybeSingle();
        const message='Shared approved gallery media by '+plain(author?.display_name||'a community member',90);
        const {data:post,error:postError}=await db.from('community_posts')
          .insert({author_id:uid,body:message,status:'published',published_at:new Date().toISOString(),audience:'verified',allow_repost:true})
          .select('id').single();
        if(postError||!post)return reply({error:'Could not create repost'},503);
        const link=await db.from('ccx_feed_post_media').insert({post_id:post.id,media_id:asset.id,ordinal:0});
        if(link.error){await db.from('community_posts').delete().eq('id',post.id).eq('author_id',uid);throw link.error;}
        const record=await db.from('ccx_gallery_reposts').insert({media_id:asset.id,user_id:uid,post_id:post.id});
        if(record.error){await db.from('community_posts').delete().eq('id',post.id).eq('author_id',uid);throw record.error;}
        await audit('gallery_repost',asset.id,{post_id:post.id});
        return reply({ok:true,post_id:post.id});
      }
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
      const endpoint=optionalProviderSetting('OPENMODERATE_SERVICE_URL'),key=Deno.env.get('OPENMODERATE_API_KEY');
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
      if(body.status==='approved' && optionalProviderSetting('ADULT_MEDIA_PUBLICATION_READY')!=='true')
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
