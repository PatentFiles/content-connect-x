/** Curated retailer-fulfilled shop. No checkout, payments, prices or fake referrals. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(value,status=200)=>Response.json(value,{status,headers:cors});
const clean=v=>typeof v==='string'?v.trim():'';
const allowedUrl=value=>{
 if(!value)return null;
 try{const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost'||!u.hostname.includes('.')||/^\d+[.\d]*$/.test(u.hostname)||u.href.length>1500)throw Error();
  return u.toString();
 }catch{throw Error('Affiliate links must be full, public HTTPS URLs');}
};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publicKey||!secret)return out({error:'Service unavailable'},503);
 const auth=createClient(url,publicKey,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return out({error:'Sign in required'},401);
 const db=createClient(url,secret);
 const [security,admission]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle(),
  db.from('member_admissions').select('admitted_at').eq('user_id',user.id).not('admitted_at','is',null).limit(1)
 ]);
 if(security.error||admission.error||!security.data||security.data.banned||security.data.suspended||!admission.data?.length)
  return out({error:'Verified active member required'},403);
 const admin=security.data.admin===true,body=await req.json().catch(()=>({}));
 if(body.action==='list'){
  const {data,error}=await db.from('ccx_shop_partners').select('slug,name,official_url,affiliate_url,categories,description,partner_status,shipping_by_partner')
   .order('name',{ascending:true}).limit(100);
  if(error)return out({error:'Shop directory unavailable'},503);
  // No invented tracking links; public listings link to the verified official
  // retailer when approved affiliate tracking has not been added yet.
  return out({items:(data||[]).filter(x=>admin||Boolean(x.official_url))
   .map(x=>({...x,
    affiliate_url:admin?x.affiliate_url:undefined,
    purchase_url:x.partner_status==='approved'&&x.affiliate_url?x.affiliate_url:x.official_url,
    tracked:x.partner_status==='approved'&&Boolean(x.affiliate_url)
   }))});
 }
 if(body.action==='save_partner'){
  if(!admin)return out({error:'Administrator required'},403);
  const slug=clean(body.slug),status=clean(body.partner_status);
  if(!/^[a-z0-9-]{2,60}$/.test(slug)||!['prospect','approved','paused'].includes(status))
   return out({error:'Invalid partner configuration'},400);
  const {data:previous,error:fetchError}=await db.from('ccx_shop_partners').select('slug,official_url').eq('slug',slug).maybeSingle();
  if(fetchError||!previous)return out({error:'Partner not found'},404);
  try{
   const affiliate=allowedUrl(clean(body.affiliate_url));
   if(status==='approved'&&!affiliate)throw Error('Add an approved affiliate tracking link before enabling commission mode');
   const {error}=await db.from('ccx_shop_partners').update({
    affiliate_url:affiliate,partner_status:status,updated_at:new Date().toISOString(),updated_by:user.id
   }).eq('slug',slug);
   if(error)throw error;
   return out({saved:true});
  }catch(e){return out({error:e.message},400);}
 }
 return out({error:'Unknown shop action'},400);
});