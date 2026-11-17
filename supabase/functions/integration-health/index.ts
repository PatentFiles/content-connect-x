/** Authenticated, independently age-verified AAL2 admin diagnostics.
 * Never returns provider secrets. "Configured" never means "tested".
 */
import {OPTIONAL_PROVIDER_SETTINGS,optionalProviderSetting} from './providerConfig.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {PROVIDERS,inspectProvider,trustedOrigin} from './providerChecks.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const assurance=(header:string)=>{
  try{
    const jwt=header.replace(/^Bearer\s+/i,'');
    const p=jwt.split('.')[1];
    const decoded=atob(p.replace(/-/g,'+').replace(/_/g,'/')
      .padEnd(Math.ceil(p.length/4)*4,'='));
    return JSON.parse(decoded)?.aal==='aal2';
  }catch{return false;}
};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
    secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),token=req.headers.get('Authorization')||'';
  if(!url||!anon||!secret)return reply({error:'Service unavailable'},503);
  const auth=createClient(url,anon,{global:{headers:{Authorization:token}}});
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user)return reply({error:'Unauthorized'},401);
  const db=createClient(url,secret);
  const {data:account,error:accountError}=await db.from('account_security')
    .select('admin,banned,suspended').eq('user_id',user.id).maybeSingle();
  if(accountError||!account?.admin||account.banned||account.suspended)
    return reply({error:'Administrator required'},403);
  if(!assurance(token))return reply({error:'Administrator MFA required'},403);
  const {data:age,error:ageError}=await db.from('age_verification_requests')
    .select('status,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(ageError||age?.[0]?.status!=='approved'||
    (age?.[0]?.expires_at&&Date.parse(age[0].expires_at)<Date.now()))
    return reply({error:'Independent administrator age verification required'},403);

  // Collect ONLY configuration presence; neither provider responses nor secrets
  // belong in this administrative diagnostics payload.
  const services:Record<string,unknown>={};
  for(const name of Object.keys(PROVIDERS)){
    const spec=PROVIDERS[name as keyof typeof PROVIDERS];
    const keys=[...spec.required,...spec.approvals];
    const values=Object.fromEntries(keys.map(key=>[key,Object.prototype.hasOwnProperty.call(OPTIONAL_PROVIDER_SETTINGS,key)?optionalProviderSetting(key):(Deno.env.get(key)||'')]));
    services[name]=inspectProvider(name,values);
  }
  const [yotiSettings,yotiToken,yotiSdk,profiles,verifiedAdults,envelopes,
    moderation,properties]=await Promise.all([
    db.from('ccx_integrations').select('enabled,callback_origin,secondary_origin')
      .eq('provider','yoti').maybeSingle(),
    db.rpc('ccx_secret_get',{p_name:'yoti_token'}),
    db.rpc('ccx_secret_get',{p_name:'yoti_sdk_id'}),
    db.from('member_profiles').select('id',{head:true,count:'exact'}),
    db.from('age_verification_requests').select('id',{head:true,count:'exact'}).eq('status','approved'),
    db.from('signature_envelopes').select('id',{head:true,count:'exact'}),
    db.from('content_moderation_queue').select('id',{head:true,count:'exact'}).eq('status','pending'),
    db.from('properties').select('id',{head:true,count:'exact'}).eq('status','active')
  ]);
  const setting=yotiSettings.data;
  const yotiMissing=[
    ...(!yotiToken.data?['Yoti API token in Vault']:[]),
    ...(!yotiSdk.data?['Yoti SDK ID in Vault']:[]),
    ...(!setting?.enabled?['Yoti provider activation']:[]),
    ...(!trustedOrigin(setting?.callback_origin)?['Trusted Content Connect X callback origin']:[]),
    ...(!trustedOrigin(setting?.secondary_origin)?['Trusted OnlyHost callback origin']:[])
  ];
  services.yoti={configured:yotiMissing.length===0,missing:yotiMissing,
    acceptance_verified:false,note:'Age results require provider sandbox checks; independent performer identity approval is a separate process.'};
  services.pass={configured:false,missing:['Approved partner API and agreement'],
    acceptance_verified:false,note:'PASS partner API access has not been independently established; status-sharing currently uses private approval records.'};

  const database={
    member_profiles:profiles.error?null:profiles.count,
    approved_age_records:verifiedAdults.error?null:verifiedAdults.count,
    agreement_envelopes:envelopes.error?null:envelopes.count,
    pending_moderation:moderation.error?null:moderation.count,
    active_host_listings:properties.error?null:properties.count
  };
  return reply({
    checked_at:new Date().toISOString(),
    services,database,
    release_tests:[
      {name:'Independently verified multi-account authorization',status:'not_verified'},
      {name:'DocuSign provider-signed envelope and certificate',status:'not_verified'},
      {name:'Merchant event, refund, chargeback and actual payout reconciliation',status:'not_verified'},
      {name:'Real two-way calendar, email/push and provider routing',status:'not_verified'},
      {name:'Backup restoration, mobile accessibility and incident simulation',status:'not_verified'}
    ],
    client_side_services:{
      sentry:'Set VITE_SENTRY_DSN in the frontend build and verify redacted production events.',
      flagsmith:'Set VITE_FLAGSMITH_ENVIRONMENT_ID for UI experiments, never permissions.',
      map_tiles:'Set VITE_HOSTING_MAP_TILE_URL with an approved HTTPS tile contract and attribution.'
    },
    note:'This is configuration diagnostics only. Manual E2E evidence and formal release approval are required.'
  });
});
