/** Monthly membership hosted checkout. Price and role originate in the database. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {membershipVaultConfig} from '../_shared/ccbillVaultConfig.mjs';
import {recurringCheckout} from '../_shared/ccbillPolicy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(v:unknown,status=200)=>Response.json(v,{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key||!service)return out({error:'Billing unavailable'},503);
 try{
  const auth=createClient(url,key,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(authError||!user)return out({error:'Sign in required'},401);
  const db=createClient(url,service),uid=user.id,body=await req.json().catch(()=>({}));
  const [security,admission,provider,subscription]=await Promise.all([
   db.from('account_security').select('banned,suspended').eq('user_id',uid).maybeSingle(),
   db.from('member_admissions').select('admitted_at').eq('user_id',uid).maybeSingle(),
   db.from('ccx_integrations').select('enabled').eq('provider','ccbill').maybeSingle(),
   db.from('member_subscriptions').select('status,period_end,plan_id,billing_provider,provider_subscription_id').eq('user_id',uid).maybeSingle()
  ]);
  if([security,admission,provider,subscription].some(x=>x.error))return out({error:'Billing status unavailable'},503);
  if(!security.data||security.data.banned||security.data.suspended||!admission.data?.admitted_at)return out({error:'Complete account onboarding first'},403);
  const cfg=await membershipVaultConfig(db),ready=cfg.ready&&provider.data?.enabled===true;
  if(body.action==='status'){
   let cancelAtEnd=false;
   if(subscription.data?.provider_subscription_id){
    const {data,error}=await db.from('ccx_membership_contracts').select('cancel_at_period_end').eq('subscription_id',subscription.data.provider_subscription_id).eq('user_id',uid).maybeSingle();
    if(error)return out({error:'Subscription status unavailable'},503);cancelAtEnd=data?.cancel_at_period_end===true;
   }
   const {data:review,error:reviewError}=await db.from('ccx_membership_payment_events').select('event_id').eq('user_id',uid).eq('status','reconciliation_required').limit(1);
   if(reviewError)return out({error:'Payment status unavailable'},503);
   return out({ready,subscription:subscription.data,cancel_at_period_end:cancelAtEnd,reconciliation_required:Boolean(review?.length),
    manage_url:'https://support.ccbill.com',note:ready?'Checkout is handled securely by CCBill.':'Membership billing awaits provider configuration and approval.'});
  }
  if(body.action==='cancel_at_period_end'){
   // Do not mark a subscription cancelled locally until the processor confirms
   // recurring rebills have been stopped. Existing paid-through access remains.
   const sub=subscription.data;
   if(sub?.billing_provider!=='ccbill'||!sub.provider_subscription_id)return out({error:'No CCBill subscription to cancel'},409);
   const {data:contract,error:contractError}=await db.from('ccx_membership_contracts')
    .select('subscription_id,account,subaccount,user_id,status,cancel_at_period_end,period_end')
    .eq('user_id',uid).eq('subscription_id',sub.provider_subscription_id).maybeSingle();
   if(contractError||!contract)return out({error:'Active subscription contract could not be verified'},409);
   if(contract.cancel_at_period_end)return out({cancel_at_period_end:true,period_end:contract.period_end,already_cancelled:true});
   if(!['active','past_due'].includes(contract.status))return out({error:'Subscription is no longer renewable'},409);
   const dataLinkUser=Deno.env.get('CCBILL_DATALINK_USERNAME');
   const dataLinkPassword=Deno.env.get('CCBILL_DATALINK_PASSWORD');
   if(!dataLinkUser||!dataLinkPassword)return out({error:'In-app cancellation is not configured. Use CCBill subscription support to stop renewal.',manage_url:'https://support.ccbill.com'},503);
   if(!/^\\d{6}$/.test(contract.account)||!/^\\d{4}$/.test(contract.subaccount)||!/^[a-zA-Z0-9-]{1,80}$/.test(contract.subscription_id))
    return out({error:'Stored processor subscription details are invalid'},409);
   // CCBill Data Link credentials must remain exclusively server-side.
   const endpoint=new URL('https://datalink.ccbill.com/utils/subscriptionManagement.cgi');
   for(const [name,value] of Object.entries({clientAccnum:contract.account,clientSubacc:contract.subaccount,
     subscriptionId:contract.subscription_id,username:dataLinkUser,password:dataLinkPassword,
     action:'cancelSubscription',returnXML:'1'}))endpoint.searchParams.set(name,value);
   let providerResponse:Response;
   try{providerResponse=await fetch(endpoint.toString(),{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Accept':'application/xml'}});}
   catch{return out({error:'Processor cancellation could not be confirmed. Verify the subscription with CCBill before retrying.',manage_url:'https://support.ccbill.com'},502);}
   const result=await providerResponse.text();
   if(!providerResponse.ok||result.length>2000||!/<results>\\s*1\\s*<\\/results>/.test(result))
    return out({error:'CCBill did not confirm cancellation. Please use CCBill subscription support.',manage_url:'https://support.ccbill.com'},502);
   const {data:updated,error:updateError}=await db.from('ccx_membership_contracts')
    .update({cancel_at_period_end:true,updated_at:new Date().toISOString()})
    .eq('subscription_id',contract.subscription_id).eq('user_id',uid).select('period_end,cancel_at_period_end').single();
   if(updateError||!updated)return out({error:'CCBill accepted cancellation but account synchronization requires support review. Future rebilling has been stopped at the processor.',manage_url:'https://support.ccbill.com'},503);
   return out({cancel_at_period_end:true,period_end:updated.period_end,
    note:'Renewal has been stopped at CCBill. Premium access continues through the existing paid-through date. No prorated refund is issued.'});
  }
  if(body.action!=='create_checkout'||typeof body.plan_code!=='string')return out({error:'Invalid billing action'},400);
  if(!ready)return out({error:'CCBill recurring membership approval, hosted form and signed webhooks must be configured first'},503);
  const {data:attempt,error}=await db.rpc('ccx_start_membership_checkout',{p_user:uid,p_plan:body.plan_code,p_account:cfg.account,p_subaccount:cfg.subaccount});
  if(error)return out({error:error.message||'Checkout cannot be started'},409);
  const checkout=recurringCheckout({...cfg,cents:attempt.amount_cents,nonce:attempt.checkout_nonce,days:attempt.period_days});
  return out({checkout_url:checkout,amount_cents:attempt.amount_cents,currency:'USD',period_days:30,
   expires_at:attempt.expires_at,note:'A return redirect never activates membership; a verified payment callback is required.'},201);
 }catch{return out({error:'Billing is temporarily unavailable. No membership changes were applied.'},503);}
});
