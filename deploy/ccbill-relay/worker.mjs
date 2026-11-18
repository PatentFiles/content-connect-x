/** Deploy to Cloudflare Workers, where cf-connecting-ip is set by Cloudflare.
 * Do not transplant this trust check to a generic server that accepts spoofed headers.
 * CCBill IP source ranges: https://ccbill.com/doc/webhooks-user-guide
 * The full body AND query are HMAC authenticated before forwarding to Supabase.
 */
export const allowedSource=ip=>/^64\.38\.(212|215|240|241)\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(ip||'');
const json=(error,status)=>Response.json({error},{status});
export default {async fetch(request,env){
 if(request.method!=='POST')return json('Method not allowed',405);
 if(!request.cf||!allowedSource(request.headers.get('cf-connecting-ip')))return json('Source not allowed',403);
 const url=new URL(request.url),scope=url.pathname.slice(1);
 if(!['membership','rental'].includes(scope))return json('Unknown endpoint',404);
 if(!env.CCBILL_WEBHOOK_RELAY_SECRET||env.CCBILL_WEBHOOK_RELAY_SECRET.length<32)return json('Not configured',503);
 const base=new URL(env.SUPABASE_ORIGIN||'https://invalid.example');
 if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co')||base.username||base.password||base.pathname!=='/')return json('Invalid backend',503);
 const type=(request.headers.get('content-type')||'').split(';')[0];
 if(!['application/json','application/x-www-form-urlencoded'].includes(type))return json('Unsupported content type',415);
 const reader=request.body?.getReader();if(!reader)return json('Body required',400);
 let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return json('Payload too large',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
 const body=new TextDecoder().decode(bytes);url.searchParams.sort();const query=url.searchParams.toString();
 if(query.length>2000)return json('Query too large',413);
 const ts=String(Math.floor(Date.now()/1000)),message=['ccx-ccbill-v1',scope,ts,query,type,body].join('\n');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CCBILL_WEBHOOK_RELAY_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))),x=>x.toString(16).padStart(2,'0')).join('');
 try{
  const response=await fetch(new URL('/functions/v1/'+(scope==='membership'?'membership-ccbill-webhook':'hosting-ccbill-webhook'),base),{
   method:'POST',body,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':type,
    'x-ccx-timestamp':ts,'x-ccx-signature':sig,'x-ccx-query':query}});
  // Preserve failure codes so CCBill can retry; never return success on upstream failure.
  return new Response(response.ok?'OK':'Callback not accepted',{status:response.status,headers:{'content-type':'text/plain','cache-control':'no-store'}});
 }catch{return json('Backend temporarily unavailable',503);}
}};
