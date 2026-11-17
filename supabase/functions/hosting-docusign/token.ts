import {optionalProviderSetting} from './providerConfig.mjs';
/** DocuSign service-account JWT OAuth, private-key material never reaches the client. */
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const encoder=new TextEncoder();
const bytes=(text:string)=>encoder.encode(text);
export function docuSignConfigured(){
 return ['DOCUSIGN_ACCOUNT_ID','DOCUSIGN_INTEGRATION_KEY','DOCUSIGN_USER_ID','DOCUSIGN_PRIVATE_KEY',
   'DOCUSIGN_LOCATION_TEMPLATE_ID'].every(k=>Boolean(Deno.env.get(k))) &&
   optionalProviderSetting('DOCUSIGN_ADULT_BUSINESS_APPROVED')==='true';
}
export async function docuSignToken(){
 if(!docuSignConfigured())throw Error('Docusign is not approved or configured');
 const oauth=optionalProviderSetting('DOCUSIGN_OAUTH_HOST')||'account-d.docusign.com';
 if(!['account-d.docusign.com','account.docusign.com'].includes(oauth))throw Error('Invalid OAuth host');
 const raw=(Deno.env.get('DOCUSIGN_PRIVATE_KEY')||'').replace(/\\n/g,'\n')
   .replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s+/g,'');
 const binary=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',binary,
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const epoch=Math.floor(Date.now()/1000);
 const header=base64url(bytes(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const payload=base64url(bytes(JSON.stringify({
  iss:Deno.env.get('DOCUSIGN_INTEGRATION_KEY'),
  sub:Deno.env.get('DOCUSIGN_USER_ID'),aud:oauth,iat:epoch,exp:epoch+3500,
  scope:'signature impersonation'
 })));
 const signingInput=header+'.'+payload;
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes(signingInput))));
 const body=new URLSearchParams({
  grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:signingInput+'.'+signature
 });
 const result=await fetch('https://'+oauth+'/oauth/token',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)throw Error('DocuSign OAuth authentication failed: HTTP '+result.status);
 const json=await result.json();
 if(!json.access_token)throw Error('DocuSign did not provide an access token');
 return json.access_token as string;
}
export function docuSignBase(){
 const url=optionalProviderSetting('DOCUSIGN_API_BASE')||'https://demo.docusign.net/restapi/v2.1';
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.docusign.net')||!parsed.pathname.startsWith('/restapi/v2.1'))
   throw Error('DocuSign API base must be an approved HTTPS docusign.net host');
 return url.replace(/\/$/,'')+'/accounts/'+encodeURIComponent(Deno.env.get('DOCUSIGN_ACCOUNT_ID')||'');
}
export async function docuSignFetch(path:string,options:RequestInit={}){
 const token=await docuSignToken();
 const result=await fetch(docuSignBase()+path,{
  ...options,headers:{'authorization':'Bearer '+token,'accept':'application/json',...(options.headers||{})},
  signal:AbortSignal.timeout(20000)
 });
 if(!result.ok)throw Error('DocuSign API error '+result.status);
 return result;
}
export async function sha256(value:Uint8Array){
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',value));
 return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
