/** Scheduled, consent-gated transcription. Storage stays private and the
 * queue carries recording identifiers only. No sensitive audio or text logs.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {validId,canTranscribe,retryAfter} from './transcriptionPolicy.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const constantTime=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64||!/^[a-f0-9]{128}$/i.test(a+b))return false;
 let difference=0;for(let i=0;i<64;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
};
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!service)return reply({error:'Worker unavailable'},503);
 const db=createClient(url,service);
 const {data:secret,error:secretError}=await db.rpc('ccx_secret_get',{p_name:'ccx_transcription_worker_key'});
 if(secretError||!constantTime(secret,req.headers.get('x-ccx-worker-key')))return reply({error:'Unauthorized'},401);
 const {data:apiKey,error:apiError}=await db.rpc('ccx_secret_get',{p_name:'openai_api_key'});
 const key=!apiError&&apiKey?apiKey:Deno.env.get('OPENAI_API_KEY');
 if(!key)return reply({configured:false,processed:0,note:'OpenAI transcription provider is not configured'});
 const {data:jobs,error:claimError}=await db.rpc('ccx_transcription_claim',{p_limit:3});
 if(claimError)return reply({error:'Transcription queue unavailable'},503);
 let done=0,skipped=0,failed=0,retries=0;
 for(const job of Array.isArray(jobs)?jobs:[]){
  const id=job.recording_id;
  if(!validId(id)||!Number.isSafeInteger(Number(job.msg_id)))continue;
  const finish=async(outcome,reason=null)=>{
   const {data,error}=await db.rpc('ccx_transcription_finish',{
    p_recording_id:id,p_msg_id:job.msg_id,p_outcome:outcome,
    p_reason:reason,p_retry_seconds:retryAfter(job.read_ct||1)
   });
   if(error)throw Error('Transcription checkpoint unavailable');
   return data;
  };
  try{
   const {data:r,error:recordError}=await db.from('ccx_meeting_recordings')
    .select('id,scope,scope_id,recorded_by,content_type,storage_path,transcript,transcript_status')
    .eq('id',id).maybeSingle();
   if(recordError)throw Error('Recording lookup unavailable');
   if(!r){await finish('skipped');skipped++;continue;}
   if(r.transcript_status==='completed'&&r.transcript){await finish('completed');done++;continue;}
   if(!['audio/webm','audio/mp4'].includes(r.content_type)||r.transcript_status!=='pending'){
    await finish('skipped');skipped++;continue;
   }
   const base={scope:r.scope,scope_id:r.scope_id};
   let members,collabConsents=null;
   if(r.scope==='collaboration'){
    const [people,collab]=await Promise.all([
     db.from('collaboration_members').select('user_id').eq('collaboration_id',r.scope_id).limit(251),
     db.from('collaboration_consents').select('user_id,recording_consent,revoked_at').eq('collaboration_id',r.scope_id).limit(251)
    ]);
    if(people.error||collab.error)throw Error('Collaboration permission unavailable');
    members=people.data;collabConsents=collab.data||[];
   }else if(r.scope==='conversation'){
    const people=await db.from('conversation_members').select('user_id').eq('conversation_id',r.scope_id).limit(251);
    if(people.error)throw Error('Conversation permission unavailable');
    members=people.data;
   }else if(r.scope==='group'){
    const people=await db.from('ccx_social_group_members').select('user_id').eq('group_id',r.scope_id).eq('status','active').limit(251);
    if(people.error)throw Error('Group permission unavailable');
    members=people.data;
   }else{await finish('skipped');skipped++;continue;}
   const ids=(members||[]).map(x=>x.user_id);
   const consents=await db.from('ccx_meeting_recording_consents')
    .select('user_id,approved').eq('scope',r.scope).eq('scope_id',r.scope_id).limit(251);
   if(consents.error)throw Error('Recording permission unavailable');
   if(!ids.includes(r.recorded_by)||!canTranscribe(ids,consents.data,collabConsents)){
    await finish('skipped','Recording/transcription consent absent');skipped++;continue;
   }
   const securePrefix='meetings/'+r.scope+'/'+r.scope_id+'/'+r.recorded_by+'/';
   if(typeof r.storage_path!=='string'||!r.storage_path.startsWith(securePrefix)){
    await finish('failed','Invalid protected recording path');failed++;continue;
   }
   const {data:audio,error:storageError}=await db.storage.from('ccx-collab-recordings').download(r.storage_path);
   if(storageError||!audio)throw Error('Private recording temporarily unavailable');
   if(audio.size>24*1024*1024){await finish('failed','Audio segment exceeds transcription limit');failed++;continue;}
   const payload=new FormData();
   payload.append('model','gpt-4o-mini-transcribe');
   payload.append('file',new File([audio],r.content_type==='audio/mp4'?'segment.mp4':'segment.webm',{type:r.content_type}));
   const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
    method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key},body:payload,
    signal:AbortSignal.timeout(48000)
   });
   if(!response.ok)throw Error('Transcription provider unavailable');
   const data=await response.json().catch(()=>({}));
   const transcript=typeof data.text==='string'?data.text.trim().slice(0,30000):'';
   if(!transcript){await finish('failed','No transcript returned');failed++;continue;}
   const saved=await db.from('ccx_meeting_recordings').update({
    transcript,transcript_status:'completed'
   }).eq('id',id).eq('transcript_status','pending').select('id');
   if(saved.error)throw Error('Transcript storage unavailable');
   await finish('completed');done++;
  }catch{
   try{const result=await finish('retry','Temporary transcription failure');
    if(result?.status==='failed')failed++;else retries++;
   }catch{/* PGMQ visibility timeout safely restores the claim. */}
  }
 }
 return reply({completed:done,skipped,failed,retries,note:'Only expressly consented private recordings were processed'});
});
