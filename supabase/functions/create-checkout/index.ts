import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

// Creates a Stripe subscription Checkout session only after verified age.
// The price IDs are configured on the server; users cannot submit amounts.
Deno.serve(async (req) => {
  const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const answer = (data,status=200) => Response.json(data,{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return answer({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripe=Deno.env.get('STRIPE_SECRET_KEY'),origin=Deno.env.get('CONTENT_CONNECT_APP_URL');
  if(!url||!anon||!role)return answer({error:'Account service unavailable'},503);
  // No processing for an adult platform without verified merchant approval.
  if(Deno.env.get('STRIPE_ADULT_BUSINESS_APPROVED')!=='true')return answer({error:'Adult-industry merchant onboarding required'},503);
  if(!stripe||!origin)return answer({error:'Subscription checkout is not yet configured'},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return answer({error:'Unauthorized'},401);
  const admin=createClient(url,role);
  const [s,v,p]=await Promise.all([
    admin.from('account_security').select('banned,suspended').eq('user_id',user.id).maybeSingle(),
    admin.from('age_verification_requests').select('status,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
    admin.from('member_subscriptions').select('status,period_end').eq('user_id',user.id).maybeSingle()
  ]);
  if(s.error||v.error||p.error)return answer({error:'Unable to verify eligibility'},503);
  if(s.data?.banned||s.data?.suspended)return answer({error:'Account unavailable'},403);
  const age=v.data?.[0];
  if(age?.status!=='approved'||(age.expires_at&&Date.parse(age.expires_at)<Date.now()))return answer({error:'Age verification required first'},403);
  const sub=p.data;
  if(sub&&['active','trial'].includes(sub.status)&&(!sub.period_end||Date.parse(sub.period_end)>Date.now()))return answer({error:'Already subscribed'},409);
  const body=await req.json().catch(()=>null);
  if(!body||!['monthly','yearly'].includes(body.cycle))return answer({error:'Invalid billing cycle'},400);
  const price=body.cycle==='monthly'?Deno.env.get('STRIPE_PRICE_MEMBER_MONTHLY'):Deno.env.get('STRIPE_PRICE_MEMBER_YEARLY');
  if(!price)return answer({error:'Plan is not yet available'},503);
  let base;
  try{base=new URL(origin);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error();}catch{return answer({error:'Checkout return URL not configured'},503);}
  const params=new URLSearchParams({
    mode:'subscription',
    'line_items[0][price]':price,'line_items[0][quantity]':'1',
    client_reference_id:user.id,customer_email:user.email||'',
    'metadata[user_id]':user.id,
    'subscription_data[metadata][user_id]':user.id,
    success_url:new URL('/?checkout=complete',base).toString(),
    cancel_url:new URL('/?checkout=cancelled',base).toString()
  });
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+stripe,'Content-Type':'application/x-www-form-urlencoded'},body:params});
  if(!response.ok)return answer({error:'Secure checkout unavailable'},502);
  const result=await response.json();
  return answer({url:result.url});
});
