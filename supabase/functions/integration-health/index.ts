/** Authenticated, independently age-verified AAL2 admin diagnostics.
 * Never returns provider secrets. "Configured" never means "tested".
 */
import {OPTIONAL_PROVIDER_SETTINGS,optionalProviderSetting} from './providerConfig.mjs';
import {verifiedAal2} from '../_shared/verifiedAdminAal.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {PROVIDERS,inspectProvider,scopeProvider} from './providerChecks.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
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
  // Only inspect AAL2 after independently validating this exact caller token.
  if(!verifiedAal2(token,user.id))return reply({error:'Administrator two-factor verification required'},403);
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
  const {data:providerRows,error:providerError}=await db.from('ccx_integrations').select('provider,enabled');
  if(providerError)return reply({error:'Provider settings unavailable'},503);
  const selected=new Set((providerRows||[]).filter(p=>p.enabled===true).map(p=>p.provider));
  const optionalSelection:Record<string,string>={transactional_email:'email',web_push:'webpush',map_routing:'maps',openmoderate:'openmoderate'};
  for(const name of Object.keys(PROVIDERS)){
    const spec=PROVIDERS[name as keyof typeof PROVIDERS];
    const keys=[...spec.required,...spec.approvals];
    const values=Object.fromEntries(keys.map(key=>[key,Object.prototype.hasOwnProperty.call(OPTIONAL_PROVIDER_SETTINGS,key)?optionalProviderSetting(key):(Deno.env.get(key)||'')]));
    // These checks describe optional legacy hosting/provider channels, not core deployment.
    // Configured or enabled services still expose their real outstanding setup.
    const inspected=inspectProvider(name,values);
    const requested=selected.has(optionalSelection[name]||'')||inspected.configured;
    services[name]=scopeProvider(inspected,{selected:requested});
  }
  // Canonical membership/signing credentials can already be stored through the administrator Vault UI.
  // Read only presence and activation, never echo secret material.
  const present=async(envName:string,vaultName:string)=>{
    if((Deno.env.get(envName)||'').trim())return true;
    const {data,error}=await db.rpc('ccx_secret_get',{p_name:vaultName});
    return !error&&typeof data==='string'&&Boolean(data.trim());
  };
  const manual=async(provider:string,fields:string[][],note:string)=>{
    const missing=(await Promise.all(fields.map(async([envName,vaultName,label])=>await present(envName,vaultName)?null:label))).filter(Boolean);
    if(!selected.has(provider))missing.push('Review and activate this integration in provider settings');
    return scopeProvider({configured:missing.length===0,missing,note,acceptance_verified:false},{required:true});
  };
  services.ccbill_membership=await manual('ccbill',[
    ['CCBILL_CLIENT_ACCNUM','ccbill_client_account','Merchant account'],['CCBILL_MEMBERSHIP_SUBACC','ccbill_subaccount','Membership subaccount'],
    ['CCBILL_MEMBERSHIP_FLEX_ID','ccbill_flex_id','FlexForm ID'],['CCBILL_MEMBERSHIP_SALT','ccbill_salt','Merchant salt'],
    ['CCBILL_WEBHOOK_RELAY_SECRET','ccbill_relay_secret','Webhook relay credential'],['CCBILL_EVENT_TIMEZONE','ccbill_event_timezone','Provider event time zone']
  ],'Connect once in provider settings. Membership callbacks and merchant acceptance still require real verification.');
  services.docusign_collaboration=await manual('docusign',[
    ['DOCUSIGN_ACCOUNT_ID','docusign_account_id','Account ID'],['DOCUSIGN_INTEGRATION_KEY','docusign_integration_key','Integration key'],
    ['DOCUSIGN_USER_ID','docusign_user_id','User ID'],['DOCUSIGN_PRIVATE_KEY','docusign_private_key','RSA private key'],
    ['DOCUSIGN_CONNECT_HMAC_SECRET','docusign_hmac','Connect HMAC credential']
  ],'Connect once in provider settings. Signed agreement and callback acceptance must be verified.');
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
  services.first_party_identity=scopeProvider({configured:missing.length===0,missing,acceptance_verified:false,
    note:'Built-in Railway document and live-selfie verification; no vendor API key is needed. Real-document, privacy and anti-spoof acceptance remain necessary.'},{required:true});
  services.pass=scopeProvider({configured:false,missing:['Approved partner API and agreement'],
    acceptance_verified:false,note:'Optional partner automation. Independent work-clearance confirmation remains required when applicable.'},{selected:selected.has('pass')});

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
      {name:'Core booking-request and notification workflows; optional provider acceptance only if activated',status:'not_verified'},
      {name:'Backup restoration, mobile accessibility and incident simulation',status:'not_verified'}
    ],
    client_side_services:{
      sentry:'Optional hosted diagnostics can be configured in the administrator provider settings.',
      flagsmith:'Optional remote experiments; no remote key is required for local feature controls.',
      map_tiles:'Optional interactive tiles and routing require an approved provider. Property lists and city search do not.'
    },
    note:'This is configuration diagnostics only. Manual E2E evidence and formal release approval are required.'
  });
});
