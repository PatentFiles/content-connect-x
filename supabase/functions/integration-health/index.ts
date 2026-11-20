/** Authenticated, independently age-verified AAL2 admin diagnostics.
 * Never returns provider secrets. "Configured" never means "tested".
 */
import {OPTIONAL_PROVIDER_SETTINGS,optionalProviderSetting} from './providerConfig.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {PROVIDERS,inspectProvider} from './providerChecks.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
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

  const {data:age,error:ageError}=await db.from('member_admissions')
    .select('admitted_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(ageError||!age?.[0]?.admitted_at)
    return reply({error:'Complete account onboarding first'},403);

  // Collect ONLY configuration presence; neither provider responses nor secrets
  // belong in this administrative diagnostics payload.
  const services:Record<string,unknown>={};
  for(const name of Object.keys(PROVIDERS)){
    const spec=PROVIDERS[name as keyof typeof PROVIDERS];
    const keys=[...spec.required,...spec.approvals];
    const values=Object.fromEntries(keys.map(key=>[key,Object.prototype.hasOwnProperty.call(OPTIONAL_PROVIDER_SETTINGS,key)?optionalProviderSetting(key):(Deno.env.get(key)||'')]));
    services[name]=inspectProvider(name,values);
  }
  const [idvConfig,profiles,verifiedAdults,envelopes,moderation,properties]=await Promise.all([
    db.from('ccx_idv_config').select('enabled,worker_origin,security_approved_at,privacy_approved_at,retention_days').eq('singleton',true).maybeSingle(),
    db.from('member_profiles').select('id',{head:true,count:'exact'}),
    db.from('age_verification_requests').select('id',{head:true,count:'exact'}).eq('status','approved'),
    db.from('signature_envelopes').select('id',{head:true,count:'exact'}),
    db.from('content_moderation_queue').select('id',{head:true,count:'exact'}).eq('status','pending'),
    db.from('properties').select('id',{head:true,count:'exact'}).eq('status','active')
  ]);
  const identity=idvConfig.data;
  const missing=[
    ...(!identity?.worker_origin?['Railway worker origin']:[]),
    ...(!identity?.security_approved_at?['Security review']:[]),
    ...(!identity?.privacy_approved_at?['Biometric privacy review']:[]),
    ...(!identity?.retention_days?['Evidence retention schedule']:[]),
    ...(!identity?.enabled?['Production identity verification activation']:[])
  ];
  services.first_party_identity={configured:missing.length===0,missing,acceptance_verified:false,
    note:'Railway-owned document OCR and independent barcode/MRZ cross-check with live-selfie facial comparison. Real-document and anti-spoof acceptance remain necessary.'};
  services.pass={configured:false,missing:['Approved partner API and agreement'],
    acceptance_verified:false,note:'PASS status sharing needs actual approved partner access.'};

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
