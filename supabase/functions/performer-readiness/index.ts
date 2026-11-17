/**
 * Privacy-first performer work-clearance and optional background screening.
 * No STI diagnoses or criminal history in the database or responses.
 * All handlers use authenticated Supabase users and server-side role checks.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const headers={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...headers,'content-type':'application/json'},
});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isActive=(v:any)=>v&&['active','trial'].includes(v.status)&&(!v.period_end||Date.parse(v.period_end)>Date.now());


Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return reply({error:'Backend unavailable'},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return reply({error:'Unauthorized'},401);
  const admin=createClient(url,secret);
  const uid=user.id;
  const [status,age,subscription]=await Promise.all([
    admin.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
    admin.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    admin.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  ]);
  if(status.error||age.error||subscription.error)return reply({error:'Unable to verify eligibility'},503);
  if(status.data?.banned||status.data?.suspended)return reply({error:'Account unavailable'},403);
  if(!(Boolean(age.data?.[0]?.admitted_at)))
    return reply({error:'Complete account onboarding first'},403);
  const body=await req.json().catch(()=>({}));
  const action=body?.action;
  const adminUser=status.data?.admin===true;
  const paid=adminUser||isActive(subscription.data);
  if(!paid&&action!=='my_status')return reply({error:'Premium membership required'},403);

  if(action==='my_status'){
    const [clearance,screening]=await Promise.all([
      admin.from('performer_work_clearances').select('clearance_confirmed,provider,confirmed_at,expires_at').eq('user_id',uid).maybeSingle(),
      admin.from('background_screening_requests').select('id,request_status,consent_at,provider,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    ]);
    if(clearance.error||screening.error)return reply({error:'Status unavailable'},503);
    const c=clearance.data;
    return reply({
      work_clearance:{confirmed:Boolean(c?.clearance_confirmed&&c.expires_at&&Date.parse(c.expires_at)>Date.now()),expires_at:c?.expires_at||null,source:c?.provider||'unverified'},
      background_screening:screening.data?.[0]||null,
      note:'Work clearance is a time-limited provider status, not a medical diagnosis or guarantee of safety.',
    });
  }

  if(action==='check_collaboration_clearance'){
    if(!uuid(body.collaboration_id))return reply({error:'Collaboration required'},400);
    const {data:membership}=await admin.from('collaboration_members').select('user_id')
      .eq('collaboration_id',body.collaboration_id).eq('user_id',uid).maybeSingle();
    if(!membership)return reply({error:'Not a collaboration participant'},403);
    const {data:members,error:memberError}=await admin.from('collaboration_members')
      .select('user_id').eq('collaboration_id',body.collaboration_id);
    if(memberError)return reply({error:'Cannot verify collaborators'},503);
    const ids=(members||[]).map((v:any)=>v.user_id);
    if(!ids.length)return reply({members:[],ready:false});
    const [shares,clearances]=await Promise.all([
     admin.from('ccx_clearance_share_consents').select('user_id,revoked_at')
      .eq('collaboration_id',body.collaboration_id).in('user_id',ids),
     admin.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at')
      .in('user_id',ids)
    ]);
    if(shares.error||clearances.error)return reply({error:'Clearance check currently unavailable'},503);
    const allowed=new Set((shares.data||[]).filter((s:any)=>!s.revoked_at).map((s:any)=>s.user_id));
    const items=ids.map((person:string)=>{
      const value=(clearances.data||[]).find((x:any)=>x.user_id===person);
      const consented=allowed.has(person);
      const current=Boolean(value?.clearance_confirmed&&value.expires_at&&Date.parse(value.expires_at)>Date.now());
      return {user_id:person,shared:consented,
       clearance_status:consented?(current?'current':'not_current'):'not_shared',
       clearance_confirmed:consented&&current};
    });
    return reply({members:items,ready:items.every((v:any)=>v.clearance_confirmed),
      checked_at:new Date().toISOString(),
      note:'Only consented binary work-clearance status is shared. No private lab results or diagnoses.'});
  }

  if(action==='request_background_screening'){
    // This is an opt-in request queue, NOT a completed background check.
    if(body.consent!==true)return reply({error:'Explicit screening consent is required'},400);
    const scope='Optional professional collaboration background screening';
    const {data:existing,error:priorError}=await admin.from('background_screening_requests').select('id,request_status').eq('user_id',uid).order('created_at',{ascending:false}).limit(1);
    if(priorError)return reply({error:'Unable to check prior request'},503);
    if(existing?.[0]&&['awaiting_provider','pending'].includes(existing[0].request_status))return reply({id:existing[0].id,status:existing[0].request_status,already_requested:true});
    const {data,error}=await admin.from('background_screening_requests').insert({
      user_id:uid,consent_at:new Date().toISOString(),consent_scope:scope,request_status:'awaiting_provider'
    }).select('id,request_status').single();
    if(error)return reply({error:'Unable to save request'},503);
    await admin.from('platform_action_audit').insert({actor_id:uid,action:'request_background_screening',target_type:'screening_request',target_id:data.id});
    return reply({id:data.id,status:data.request_status,note:'No third-party screening is performed until a provider is configured and required disclosures are completed.'},201);
  }

  if(action==='admin_record_provider_clearance'){
    if(!adminUser)return reply({error:'Administrator required'},403);
    const target=body.user_id;
    const reference=typeof body.provider_reference==='string'?body.provider_reference.trim():null;
    const provider=typeof body.provider==='string'?body.provider.trim():null;
    if(!uuid(target)||!reference||reference.length>120||!provider||provider.length>80)return reply({error:'Valid verified provider reference required'},400);
    if(body.confirmed_by_provider!==true)return reply({error:'External work clearance must first be confirmed'},400);
    const now=new Date();
    const expires=new Date(body.expires_at);
    if(!Number.isFinite(expires.getTime())||expires<=now||expires.getTime()>now.getTime()+14*86400000)
      return reply({error:'Expiry must fall within the next 14 days'},400);
    const {data,error}=await admin.from('performer_work_clearances').upsert({
      user_id:target,provider,provider_reference:reference,clearance_confirmed:true,
      confirmed_at:now.toISOString(),expires_at:expires.toISOString(),reviewed_by:uid,updated_at:now.toISOString()
    },{onConflict:'user_id'}).select('user_id,expires_at').single();
    if(error)return reply({error:'Could not record confirmation'},503);
    await admin.from('platform_action_audit').insert({
      actor_id:uid,action:'confirm_provider_clearance',target_type:'work_clearance',target_id:target,
      metadata:{provider,expires_at:expires.toISOString()}
    });
    return reply({user_id:data.user_id,clearance_confirmed:true,expires_at:data.expires_at});
  }
  return reply({error:'Unsupported action'},404);
});
