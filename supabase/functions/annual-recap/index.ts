/** Authenticated, least-privilege annual recap API.
 * No wildcard member searches, direct table exposure, automatic public posts,
 * identity or medical data, or third-party analytics.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {normalizeRecap,recapAchievements,recapShareText,RECAP_ROLES} from './recapPolicy.mjs';
import {renderRecapPdf} from './pdfReport.mjs';
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'
};
const out=(body,status=200)=>Response.json(body,{status,headers:cors});
const allowedActions=new Set(['list','view','download_pdf','share_feed','hide_feed']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 if(Number(req.headers.get('content-length')||0)>4096)return out({error:'Request is too large'},413);
 const url=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),
  secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publicKey||!secret)return out({error:'Annual recap unavailable'},503);
 const authHeader=req.headers.get('authorization')||'';
 const caller=createClient(url,publicKey,{global:{headers:{Authorization:authHeader}}});
 const auth=await caller.auth.getUser().catch(()=>({data:{user:null},error:true}));
 const user=auth.data?.user;
 if(auth.error||!user||user.is_anonymous)return out({error:'Sign in required'},401);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object'||Array.isArray(body)||!allowedActions.has(body.action))
  return out({error:'Unsupported recap request'},400);
 if(JSON.stringify(body).length>4096)return out({error:'Request is too large'},413);
 const db=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}}),uid=user.id;
 // Gate even owner-read exports on current account permission. Revoked members
 // must not download or publish a private report after suspension.
 const [security,admission,profile]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_admissions').select('id,admitted_at').eq('user_id',uid).not('admitted_at','is',null)
   .order('admitted_at',{ascending:false}).limit(1),
  db.from('member_profiles').select('display_name,role_type').eq('id',uid).maybeSingle()
 ]);
 if(security.error||admission.error||profile.error)return out({error:'Account verification unavailable'},503);
 if(!security.data||security.data.banned||security.data.suspended||!admission.data?.length||
  !profile.data||!Object.hasOwn(RECAP_ROLES,profile.data.role_type))
  return out({error:'An active, admitted professional account is required'},403);
 const fields='id,user_id,report_year,role_type,metrics,generated_at,notified_at,feed_post_id,shared_at,feed_hidden_at';
 try{
  if(body.action==='list'){
   const {data,error}=await db.from('ccx_annual_recaps').select(fields)
    .eq('user_id',uid).order('report_year',{ascending:false}).limit(15);
   if(error)throw Error('Listing unavailable');
   return out({items:(data||[]).map(row=>({
    ...normalizeRecap(row),generated_at:row.generated_at,
    notified_at:row.notified_at,shared_at:row.shared_at
   }))});
  }
  const year=body.year;
  if(!Number.isInteger(year)||year<2026||year>=new Date().getUTCFullYear())
   return out({error:'Choose a completed reporting year'},400);
  const {data:report,error}=await db.from('ccx_annual_recaps').select(fields)
   .eq('user_id',uid).eq('report_year',year).maybeSingle();
  if(error)throw Error('Recap lookup unavailable');
  if(!report)return out({error:'This year has not been prepared yet. Eligible recaps become available on January 1.'},404);
  const safe=normalizeRecap(report);
  if(body.action==='view')return out({report:{
   ...safe,displayName:profile.data.display_name||'Professional member',
   generated_at:report.generated_at,notified_at:report.notified_at,shared_at:report.shared_at,
   achievements:recapAchievements(report),share_text:recapShareText(report)
  }});
  if(body.action==='download_pdf'){
   // Generate first, then write an append-only audit event. No PDF is sent if
   // the audit append fails. PDF bytes are never persisted or publicly cached.
   const pdf=await renderRecapPdf(report,profile.data.display_name);
   const audited=await db.from('ccx_annual_recap_events').insert({
    recap_id:report.id,actor_id:uid,action:'pdf_exported',
    metadata:{year,format:'pdf',bytes:pdf.length}
   });
   if(audited.error)throw Error('Audit unavailable');
   return new Response(pdf,{status:200,headers:{...cors,
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="ContentConnectX-'+year+'-YearInReview.pdf"'}});
  }
  const rpc=body.action==='share_feed'?'ccx_annual_recap_feed_share':'ccx_annual_recap_feed_hide';
  const {data,error:operationError}=await db.rpc(rpc,{p_recap:report.id,p_actor:uid});
  if(operationError)throw Error('Sharing operation was not completed');
  return out({result:data});
 }catch{
  // No raw Postgres detail, identifiers, token, or sensitive records in errors.
  return out({error:'Year in Review is temporarily unavailable. Retry or contact support.'},503);
 }
});