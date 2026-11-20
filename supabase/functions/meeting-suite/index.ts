/** Context-scoped video conferencing across collaborations, community groups and DMs.
 * Auth, membership, consent, notes, video credentials and media storage are all server-side.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {livekitUrl,livekitJoinToken} from './livekitToken.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(value,status=200)=>Response.json(value,{status,headers:cors});
const text=(value,len=300)=>typeof value==='string'?value.trim().slice(0,len):'';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const utc=()=>new Date().toISOString();
const allowedScope=new Set(['collaboration','conversation','group']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return out({error:'Backend configuration unavailable'},503);
 const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return out({error:'Sign in required'},401);
 const db=createClient(url,service),uid=user.id;
 const [{data:security,error:securityError},{data:admission,error:ageError}]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_admissions').select('admitted_at').eq('user_id',uid).not('admitted_at','is',null).limit(1)
 ]);
 if(securityError||ageError)return out({error:'Unable to verify account'},503);
 if(!security||security.banned||security.suspended||!admission?.length)return out({error:'Verified active account required'},403);
 const admin=security.admin===true;
 const body=await req.json().catch(()=>null);
 if(!body||JSON.stringify(body).length>24000)return out({error:'Invalid request'},400);
 const action=text(body.action,60),scope=text(body.scope,24),scopeId=body.scope_id;
 const vault=async(name,env)=>{
  const {data,error}=await db.rpc('ccx_secret_get',{p_name:name});
  if(!error&&typeof data==='string'&&data.trim())return data.trim();
  return Deno.env.get(env)||'';
 };
 const settings=async()=>({
  url:await vault('livekit_server_url','LIVEKIT_URL'),
  key:await vault('livekit_api_key','LIVEKIT_API_KEY'),
  secret:await vault('livekit_api_secret','LIVEKIT_API_SECRET')
 });
 const participants=async()=>{
  if(!allowedScope.has(scope)||!uuid(scopeId))throw Error('Select an eligible meeting');
  let members,errors;
  if(scope==='collaboration'){
   const [collab,people]=await Promise.all([
    db.from('collaborations').select('id,title,status').eq('id',scopeId).maybeSingle(),
    db.from('collaboration_members').select('user_id').eq('collaboration_id',scopeId).limit(500)
   ]);
   if(collab.error||people.error||!collab.data||['cancelled'].includes(collab.data.status))throw Error('Collaboration unavailable');
   members=people.data;
  }else if(scope==='conversation'){
   const [chat,people]=await Promise.all([
    db.from('conversations').select('id,kind,title').eq('id',scopeId).maybeSingle(),
    db.from('conversation_members').select('user_id').eq('conversation_id',scopeId).limit(500)
   ]);
   if(chat.error||people.error||!chat.data)throw Error('Conversation unavailable');
   members=people.data;
  }else{
   const [group,people]=await Promise.all([
    db.from('ccx_social_groups').select('id,state').eq('id',scopeId).maybeSingle(),
    db.from('ccx_social_group_members').select('user_id').eq('group_id',scopeId).eq('status','active').limit(500)
   ]);
   if(group.error||people.error||!group.data||group.data.state!=='active')throw Error('Group unavailable');
   members=people.data;
  }
  const ids=[...new Set((members||[]).map(p=>p.user_id))];
  if(!ids.includes(uid))throw Error('You are not an active participant in this meeting');
  if(ids.length>250)throw Error('This group exceeds the room participant limit');
  const {data:blocks,error:blockError}=await db.from('member_blocks')
   .select('blocker_id,blocked_id').or('blocker_id.eq.'+uid+',blocked_id.eq.'+uid).limit(500);
  if(blockError)throw Error('Unable to verify contact permissions');
  const blocked=new Set((blocks||[]).map(row=>row.blocker_id===uid?row.blocked_id:row.blocker_id));
  if(ids.some(id=>id!==uid&&blocked.has(id)))throw Error('A blocked relationship prevents this shared meeting');
  return ids;
 };
 const validConsents=async ids=>{
  const {data,error}=await db.from('ccx_meeting_recording_consents').select('user_id,approved')
   .eq('scope',scope).eq('scope_id',scopeId);
  if(error)throw error;
  const approved=new Set((data||[]).filter(x=>x.approved===true).map(x=>x.user_id));
  if(!ids.every(id=>approved.has(id)))throw Error('Every participant must explicitly approve meeting recording');
  if(scope==='collaboration'){
   const {data:original,error:consentError}=await db.from('collaboration_consents')
    .select('user_id,recording_consent,revoked_at').eq('collaboration_id',scopeId);
   if(consentError)throw consentError;
   if(!ids.every(id=>(original||[]).some(x=>x.user_id===id&&x.recording_consent===true&&!x.revoked_at)))
    throw Error('Every collaboration member must also approve recording in collaboration consent');
  }
 };
 const conditions=()=>db.from('ccx_meeting_notes').select('scope,scope_id,body,version,updated_at,updated_by')
  .eq('scope',scope).eq('scope_id',scopeId);
 try{
 if(action==='config_status'){
  if(!admin)return out({error:'Administrator required'},403);
  const s=await settings();
  return out({configured:Boolean(s.url&&s.key&&s.secret),server_url:s.url||'',has_key:Boolean(s.key),has_secret:Boolean(s.secret)});
 }
 if(action==='config_save'){
  if(!admin)return out({error:'Administrator required'},403);
  let urlValue;
  try{urlValue=livekitUrl(body.server_url);}catch(e){return out({error:e.message},400);}
  const key=text(body.api_key,100),secret=text(body.api_secret,300);
  if(!/^[A-Za-z0-9_-]{3,80}$/.test(key)||secret.length<12)return out({error:'Enter the LiveKit API key and secret'},400);
  for(const [name,value] of [['livekit_server_url',urlValue],['livekit_api_key',key],['livekit_api_secret',secret]]){
   const {error}=await db.rpc('ccx_secret_set',{p_name:name,p_secret:value});
   if(error)throw Error('Unable to save encrypted LiveKit configuration');
  }
  return out({configured:true});
 }
 const ids=await participants();
 if(action==='details'){
  const [names,consents]=await Promise.all([
   db.from('member_profiles').select('id,display_name').in('id',ids),
   db.from('ccx_meeting_recording_consents').select('user_id,approved').eq('scope',scope).eq('scope_id',scopeId)
  ]);
  if(names.error||consents.error)throw Error('Unable to read participants');
  const granted=new Set((consents.data||[]).filter(x=>x.approved).map(x=>x.user_id));
  return out({participants:ids.map(id=>({user_id:id,display_name:(names.data||[]).find(x=>x.id===id)?.display_name||'Member',recording_approved:granted.has(id)})),
   recording_ready:ids.every(id=>granted.has(id)),scope,scope_id:scopeId});
 }
 if(action==='room_ticket'){
  const config=await settings();
  if(!config.url||!config.key||!config.secret)return out({error:'LiveKit video credentials are not configured in Admin → Video meetings.'},503);
  const roomName='ccx-'+scope+'-'+scopeId;
  const {data:profile}=await db.from('member_profiles').select('display_name').eq('id',uid).maybeSingle();
  const token=await livekitJoinToken(config.key,config.secret,roomName,uid,profile?.display_name||'Verified member');
  return out({server_url:livekitUrl(config.url),participant_token:token,room_name:roomName,
   expires_in_seconds:3600,participant_id:uid});
 }
 if(action==='invite'){
  const {data:recent,error}=await db.from('ccx_meeting_invites').select('id').eq('scope',scope).eq('scope_id',scopeId)
   .eq('invited_by',uid).gte('created_at',new Date(Date.now()-5*60000).toISOString()).limit(1);
  if(error)throw error;
  if(recent?.length)return out({error:'Meeting invitations were recently sent. Use the existing invitation or wait a few minutes.'},429);
  const {error:insertError}=await db.from('ccx_meeting_invites').insert({scope,scope_id:scopeId,invited_by:uid});
  if(insertError)throw insertError;
  for(const recipient of ids.filter(id=>id!==uid)){
   await db.from('member_notifications').insert({
    recipient_id:recipient,kind:'meeting_invitation',title:'Invitation to a private video meeting',
    details:{scope,scope_id:scopeId,invited_by:uid}
   });
  }
  return out({invited:ids.length-1});
 }
 if(action==='consent_set'){
  const approved=body.approved===true;
  const {error}=await db.from('ccx_meeting_recording_consents').upsert({
   scope,scope_id:scopeId,user_id:uid,approved,updated_at:utc()
  },{onConflict:'scope,scope_id,user_id'});
  if(error)throw error;return out({ok:true,approved});
 }
 if(action==='recording_check'){
  await validConsents(ids);
  return out({ready:true});
 }
 if(action==='notes_get'){
  const {data,error}=await conditions().maybeSingle();
  if(error)throw error;
  return out({item:data||{body:'',version:0}});
 }
 if(action==='notes_save'){
  const version=Number(body.version),note=text(body.body,20000);
  if(!Number.isInteger(version)||version<0||typeof body.body!=='string'||body.body.length>20000)
   return out({error:'Invalid notes version or body'},400);
  let result;
  if(version===0)result=await db.from('ccx_meeting_notes').insert({scope,scope_id:scopeId,body:note,updated_by:uid}).select('version').maybeSingle();
  else result=await db.from('ccx_meeting_notes').update({body:note,version:version+1,updated_by:uid,updated_at:utc()})
   .eq('scope',scope).eq('scope_id',scopeId).eq('version',version).select('version').maybeSingle();
  if(result.error||!result.data)return out({error:'Notes changed since you opened them. Refresh and retry to avoid overwriting another member.'},409);
  const {error:audit}=await db.from('ccx_meeting_note_events').insert({
   scope,scope_id:scopeId,version:result.data.version,actor_id:uid,body:note
  });
  if(audit)throw audit;
  return out({version:result.data.version});
 }
 if(action==='recording_ticket'){
  await validConsents(ids);
  const type=text(body.content_type,30);
  if(!['audio/webm','audio/mp4','video/webm','video/mp4'].includes(type))return out({error:'Unsupported meeting recording format'},400);
  const path='meetings/'+scope+'/'+scopeId+'/'+uid+'/'+crypto.randomUUID()+'.'+(type.endsWith('webm')?'webm':'mp4');
  const {data,error}=await db.storage.from('ccx-collab-recordings').createSignedUploadUrl(path);
  if(error)throw error;return out({bucket:'ccx-collab-recordings',path,token:data.token});
 }
 if(action==='recording_finish'){
  await validConsents(ids);
  const type=text(body.content_type,30),path=text(body.path,300);
  const prefix='meetings/'+scope+'/'+scopeId+'/'+uid+'/';
  if(!path.startsWith(prefix)||!['audio/webm','audio/mp4','video/webm','video/mp4'].includes(type))return out({error:'Invalid recording'},400);
  const parts=path.split('/'),file=parts.at(-1);
  const {data:existing,error:storageError}=await db.storage.from('ccx-collab-recordings').list(parts.slice(0,-1).join('/'),{search:file,limit:10});
  if(storageError||!existing?.some(item=>item.name===file))throw Error('Recording upload not found');
  const {data,error}=await db.from('ccx_meeting_recordings').insert({scope,scope_id:scopeId,recorded_by:uid,storage_path:path,content_type:type,transcript_status:type.startsWith('audio/')?'pending':'not_requested'}).select('id').single();
  if(error)throw error;
  return out({item:data});
 }
 if(action==='recordings_list'){
  const {data,error}=await db.from('ccx_meeting_recordings').select('id,recorded_by,content_type,storage_path,transcript_status,transcript,created_at')
   .eq('scope',scope).eq('scope_id',scopeId).order('created_at',{ascending:false}).limit(120);
  if(error)throw error;
  const items=[];
  for(const entry of data||[]){
   const {data:signed}=await db.storage.from('ccx-collab-recordings').createSignedUrl(entry.storage_path,600);
   items.push({id:entry.id,recorded_by:entry.recorded_by,content_type:entry.content_type,created_at:entry.created_at,
    transcript_status:entry.transcript_status,transcript:entry.transcript||null,url:signed?.signedUrl||null});
  }
  return out({items});
 }
 if(action==='transcribe'){
  const id=body.recording_id;if(!uuid(id))return out({error:'Recording identifier required'},400);
  const {data:entry,error}=await db.from('ccx_meeting_recordings').select('*').eq('id',id).eq('scope',scope).eq('scope_id',scopeId).maybeSingle();
  if(error||!entry||!entry.content_type.startsWith('audio/'))return out({error:'Audio recording not found'},404);
  if(entry.transcript_status==='completed'&&entry.transcript)return out({transcript:entry.transcript});
  const key=await vault('openai_api_key','OPENAI_API_KEY');
  if(!key)return out({error:'OpenAI key is not configured in administrator AI settings.'},503);
  const {data:blob,error:storageError}=await db.storage.from('ccx-collab-recordings').download(entry.storage_path);
  if(storageError||!blob||blob.size>24*1024*1024)return out({error:'Audio recording not available for transcription'},413);
  const form=new FormData();
  form.append('model','gpt-4o-mini-transcribe');
  form.append('file',new File([blob],entry.content_type==='audio/mp4'?'meeting.mp4':'meeting.webm',{type:entry.content_type}));
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
   method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.timeout(50000)
  });
  if(!response.ok)throw Error('Audio transcription failed (HTTP '+response.status+')');
  const transcript=text((await response.json()).text,30000);
  if(!transcript)return out({error:'Transcription returned no words'},502);
  const {error:saveError}=await db.from('ccx_meeting_recordings').update({transcript,transcript_status:'completed'}).eq('id',id);
  if(saveError)throw saveError;
  return out({transcript});
 }
 return out({error:'Unknown meeting action'},400);
 }catch(error){return out({error:text(error?.message||'Meeting unavailable',320)},400);}
});