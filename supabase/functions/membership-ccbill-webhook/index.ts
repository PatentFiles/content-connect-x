/** Only the authenticated relay may report provider events; never a browser redirect. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {membershipConfig} from '../_shared/membershipBillingConfig.mjs';
import {readCallbackBody,verifyRelay,parseEvent,membershipEvent,hexHash} from '../_shared/ccbillPolicy.mjs';
const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return out({error:'POST required'},405);
 const cfg=membershipConfig(name=>Deno.env.get(name));
 if(!cfg.ready)return out({error:'Recurring billing is not enabled'},503);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return out({error:'Service unavailable'},503);
 try{
  const body=await readCallbackBody(req);if(body.length>65536)return out({error:'Payload too large'},413);
  if(!await verifyRelay(req,body,'membership',cfg.relaySecret))return out({error:'Untrusted payment callback'},401);
  const parsed=parseEvent(body,req.headers.get('content-type')||'',req.headers.get('x-ccx-query')||'');
  const event=membershipEvent(parsed,cfg,cfg.timeZone);
  const db=createClient(url,key);
  const {data:provider,error:providerError}=await db.from('ccx_integrations').select('enabled').eq('provider','ccbill').maybeSingle();
  if(providerError||!provider?.enabled)return out({error:'Provider is disabled'},503);
  // The normalized ledger excludes addresses, emails, names and card fields.
  const {data,error}=await db.rpc('ccx_apply_membership_event',{p_event:event,p_hash:hexHash(JSON.stringify(event))});
  if(error)return out({error:'Event requires retry or merchant reconciliation'},503);
  return out(data,data.status==='reconciliation_required'?202:200);
 }catch{return out({error:'Callback signature, scope or payment data did not validate'},400);}
});
