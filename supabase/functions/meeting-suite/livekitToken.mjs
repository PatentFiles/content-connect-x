/** LiveKit HS256 participant JWTs, signed only on a trusted Edge Function.
 * Pure crypto helper so CI can verify token scope and expiry without provider keys.
 */
const encoder=new TextEncoder();
export function livekitUrl(value){
 if(typeof value!=='string')throw Error('LiveKit URL is required');
 const url=new URL(value.trim());
 if(url.protocol!=='wss:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.'))
  throw Error('Enter a secure wss:// LiveKit server URL');
 return url.origin.replace(/^https:/,'wss:').replace(/\/$/,'');
}
function b64url(value){
 const bytes=typeof value==='string'?encoder.encode(value):value;
 let output='';
 for(let i=0;i<bytes.length;i+=8192)output+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(output).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function livekitJoinToken(apiKey,apiSecret,room,userId,displayName,issuedAt=Math.floor(Date.now()/1000)){
 if(!/^[a-zA-Z0-9_-]{3,80}$/.test(apiKey)||typeof apiSecret!=='string'||apiSecret.length<12)
  throw Error('LiveKit API credentials are missing or invalid');
 if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^ccx-(collaboration|conversation|group)-[0-9a-f-]{36}$/i.test(room))
  throw Error('Invalid private room or participant');
 const header=b64url(JSON.stringify({typ:'JWT',alg:'HS256'}));
 const claims=b64url(JSON.stringify({
  iss:apiKey,sub:userId,iat:issuedAt,nbf:issuedAt-10,exp:issuedAt+3600,
  name:String(displayName||'Verified member').slice(0,100),
  video:{roomJoin:true,room,canPublish:true,canSubscribe:true,canPublishData:true}
 }));
 const unsigned=header+'.'+claims;
 const key=await crypto.subtle.importKey('raw',encoder.encode(apiSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(unsigned)));
 return unsigned+'.'+b64url(signature);
}
