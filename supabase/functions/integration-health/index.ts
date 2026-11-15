/** Administrative integration readiness, with no secret values returned. */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return reply({error:'Service unavailable'},503);
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return reply({error:'Unauthorized'},401);
 const db=createClient(url,secret);
 const {data:account,error:accountError}=await db.from('account_security')
   .select('admin,banned,suspended').eq('user_id',user.id).maybeSingle();
 if(accountError||!account?.admin||account.banned||account.suspended)return reply({error:'Administrator required'},403);
 const {data:age,error:ageError}=await db.from('age_verification_requests')
   .select('status,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
 if(ageError||age?.[0]?.status!=='approved'||(age?.[0]?.expires_at&&Date.parse(age[0].expires_at)<Date.now()))
   return reply({error:'Independent administrator age verification required'},403);
 const has=(keys:string[])=>keys.every(key=>Boolean(Deno.env.get(key)));
 const integrations={
   docusign:{configured:has(['DOCUSIGN_ACCOUNT_ID','DOCUSIGN_INTEGRATION_KEY','DOCUSIGN_CONNECT_HMAC_SECRET']),
      note:'Requires developer account, auth, approved templates, webhook and archive verification'},
   adult_payment_processor:{configured:has(['CCBILL_MERCHANT_ID','CCBILL_SUBACCOUNT_ID','CCBILL_FLEXFORM_ID']),
      note:'No adult-industry billing processor has been activated in the preview'},
   openmoderate:{configured:has(['OPENMODERATE_SERVICE_URL','OPENMODERATE_API_KEY']),
      note:'Requires private self-hosted moderation service and human review'},
   background_screening:{configured:has(['BACKGROUND_SCREENING_PROVIDER_URL','BACKGROUND_SCREENING_SECRET']),
      note:'Optional screening requests are queued; no third-party checks run without consent'},
   health_clearance:{configured:has(['WORK_CLEARANCE_PROVIDER_URL','WORK_CLEARANCE_SECRET']),
      note:'Provider clearance verification must be independently confirmed'},
 };
 const [profiles,users,envelopes,moderation]=await Promise.all([
   db.from('member_profiles').select('id',{head:true,count:'exact'}),
   db.auth.admin.listUsers({page:1,perPage:1}),
   db.from('signature_envelopes').select('id',{head:true,count:'exact'}),
   db.from('content_moderation_queue').select('id',{head:true,count:'exact'}).eq('status','pending'),
 ]);
 return reply({
   services:integrations,
   database:{profiles:profiles.count||0,supabase_auth_accessible:!users.error,
     signature_envelopes:envelopes.count||0,pending_moderation:moderation.count||0},
   client_side_services:{
      sentry:'Configure VITE_SENTRY_DSN in Bolt when ready',
      flagsmith:'Configure VITE_FLAGSMITH_ENVIRONMENT_ID for UI-only experiments'
   },
   note:'Configured does not mean tested. Credential and end-to-end validation required for launch.'
 });
});
