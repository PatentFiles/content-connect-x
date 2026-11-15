/**
 * Consent records are independent from paid membership. Users can always withdraw
 * their own recorded consent after authenticating, even if their subscription ends.
 * Withdrawal pauses the collaboration and flags a human follow-up. No third-party
 * content is automatically deleted and no legal rights are inferred here.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const isId=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const current=(sub:any)=>sub&&['active','trial'].includes(sub.status)&&(!sub.period_end||Date.parse(sub.period_end)>Date.now());

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return respond({error:'Service unavailable'},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return respond({error:'Unauthorized'},401);
  const admin=createClient(url,secret),uid=user.id;
  const body=await req.json().catch(()=>({}));
  if(body.action==='list_mine'){
    const {data:members,error:membershipError}=await admin.from('collaboration_members').select('collaboration_id').eq('user_id',uid).limit(100);
    if(membershipError)return respond({error:'Unable to list collaborations'},503);
    const ids=(members||[]).map(m=>m.collaboration_id);
    if(!ids.length)return respond({items:[]});
    const {data,error}=await admin.from('collaborations').select('id,title,status').in('id',ids).order('created_at',{ascending:false});
    if(error)return respond({error:'Unable to list collaborations'},503);
    return respond({items:data||[]});
  }
  if(!isId(body.collaboration_id))return respond({error:'Invalid collaboration'},400);
  if(!['status','grant','revoke'].includes(body.action))return respond({error:'Invalid action'},400);
  const id=body.collaboration_id;
  const {data:member,error:membershipError}=await admin.from('collaboration_members').select('user_id').eq('collaboration_id',id).eq('user_id',uid).maybeSingle();
  if(membershipError||!member)return respond({error:'Collaboration not available'},403);

  if(body.action==='status'){
    const {data,error}=await admin.from('collaboration_consents').select('user_id,participation_consent,recording_consent,distribution_consent,download_consent,recorded_at,revoked_at').eq('collaboration_id',id);
    if(error)return respond({error:'Consent status unavailable'},503);
    return respond({consents:data||[]});
  }

  if(body.action==='grant'){
    const [account,ages,subscription]=await Promise.all([
      admin.from('account_security').select('banned,suspended,admin').eq('user_id',uid).maybeSingle(),
      admin.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
      admin.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
    ]);
    if(account.error||ages.error||subscription.error)return respond({error:'Eligibility not available'},503);
    if(account.data?.banned||account.data?.suspended)return respond({error:'Account restricted'},403);
    const verified=ages.data?.[0]?.status==='approved'&&(!ages.data[0].expires_at||Date.parse(ages.data[0].expires_at)>Date.now());
    if(!verified)return respond({error:'Age verification required'},403);
    if(!account.data?.admin&&!current(subscription.data))return respond({error:'Paid membership required for new collaborations'},403);
    if(body.participation_consent!==true||body.recording_consent!==true)return respond({error:'Explicit participation and recording consent required'},400);
    if(typeof body.distribution_consent!=='boolean'||typeof body.download_consent!=='boolean')return respond({error:'Separate distribution and download choices required'},400);
    const {data:prior,error:priorError}=await admin.from('collaboration_consents').select('revoked_at').eq('collaboration_id',id).eq('user_id',uid).maybeSingle();
    if(priorError)return respond({error:'Unable to check current consent'},503);
    if(prior?.revoked_at)return respond({error:'Revoked consent requires a new reviewed collaboration agreement'},409);
    const scope={
      collaboration_id:id,user_id:uid,participation_consent:true,recording_consent:true,
      distribution_consent:body.distribution_consent,download_consent:body.download_consent,
      recorded_at:new Date().toISOString(),revoked_at:null
    };
    const {data,error}=await admin.from('collaboration_consents').upsert(scope,{onConflict:'collaboration_id,user_id'}).select('collaboration_id,recorded_at').single();
    if(error)return respond({error:'Consent could not be recorded'},503);
    await admin.from('collaboration_consent_events').insert({
      collaboration_id:id,user_id:uid,action:'granted',
      scope_snapshot:{
        participation:scope.participation_consent,recording:scope.recording_consent,
        distribution:scope.distribution_consent,download:scope.download_consent
      }
    });
    return respond({item:data,status:'recorded'});
  }

  // A member's withdrawal must not be restricted by their ability to pay.
  const {data:prior,error:lookupError}=await admin.from('collaboration_consents').select('revoked_at').eq('collaboration_id',id).eq('user_id',uid).maybeSingle();
  if(lookupError)return respond({error:'Consent record unavailable'},503);
  if(!prior)return respond({error:'No recorded consent for this collaboration'},404);
  if(prior.revoked_at)return respond({status:'already_revoked',revoked_at:prior.revoked_at});
  const now=new Date().toISOString();
  const {error:saveError}=await admin.from('collaboration_consents').update({revoked_at:now}).eq('collaboration_id',id).eq('user_id',uid).is('revoked_at',null);
  if(saveError)return respond({error:'Could not update consent'},503);
  const {error:eventError}=await admin.from('collaboration_consent_events').insert({
    collaboration_id:id,user_id:uid,action:'revoked',
    scope_snapshot:{reason:'Member requested withdrawal; human review required'}
  });
  if(eventError)return respond({error:'Consent withdrawal audit could not be confirmed'},503);
  await admin.from('collaborations').update({status:'paused'}).eq('id',id);
  const {data:members}=await admin.from('collaboration_members').select('user_id').eq('collaboration_id',id);
  if(members?.length){
    await admin.from('member_notifications').insert(members.map((m:any)=>({
      recipient_id:m.user_id,kind:'consent_withdrawn',title:'Collaboration paused: consent review needed',
      details:{collaboration_id:id}
    })));
  }
  await admin.from('platform_action_audit').insert({
    actor_id:uid,action:'withdraw_consent',target_type:'collaboration',target_id:id
  });
  return respond({status:'revoked',revoked_at:now,collaboration_paused:true});
});
