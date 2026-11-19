/** Anonymous text-only safety intake. No read, lookup, login or disclosure actions exist.
 * The database independently enforces the operator activation switch and rate limits.
 * Admin case access uses a separate authenticated, MFA-gated RPC, never this endpoint.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createTrustIntakeHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!secret)throw Error('Server configuration unavailable');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
Deno.serve(createTrustIntakeHandler({
 submit:(payload:unknown,rateKey:string,idempotency:string)=>db.rpc('ccx_trust_submit',{p_payload:payload,p_rate_key:rateKey,p_idempotency:idempotency}),
 rateKey:async(req:Request)=>{
  // An edge-provided network hint is a rate signal, never authentication or identity.
  // It is keyed and rotated by day; raw IPs are not added to request records or logs.
  const hint=(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim().slice(0,100);
  const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode('ccx-trust:'+new Date().toISOString().slice(0,10)+':'+hint));
  return Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
 }
}));
