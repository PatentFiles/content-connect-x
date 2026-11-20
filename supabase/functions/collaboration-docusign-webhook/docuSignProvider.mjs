/** DocuSign service authentication and document generation for individual collaborators.
 * Provider credentials may live in Supabase Edge secrets or the existing encrypted Vault.
 * Only this server module sees the credentials or handles contract bytes.
 */
import {PDFDocument,StandardFonts,rgb} from 'npm:pdf-lib@1.17.1';
import {createPrivateKey,sign as rsaSign} from 'node:crypto';
const raw=(v)=>typeof v==='string'?v.trim():'';
const b64=(data)=>{
 let binary='';
 // Avoid exceeding JavaScript's function argument limit on multipage PDFs.
 for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
 return btoa(binary);
};
const url64=(s)=>b64(new TextEncoder().encode(s)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function config(db){
 const mapping={accountId:['DOCUSIGN_ACCOUNT_ID','docusign_account_id'],
  integrationKey:['DOCUSIGN_INTEGRATION_KEY','docusign_integration_key'],
  userId:['DOCUSIGN_USER_ID','docusign_user_id'],
  privateKey:['DOCUSIGN_PRIVATE_KEY','docusign_private_key'],
  hmac:['DOCUSIGN_CONNECT_HMAC_SECRET','docusign_hmac']};
 const out={};
 for(const [k,[env,vault]] of Object.entries(mapping)){
  let value=raw(Deno.env.get(env));
  if(!value){
   const result=await db.rpc('ccx_secret_get',{p_name:vault});
   value=raw(result.data);
  }
  out[k]=value;
 }
 return out;
}
export async function providerSettings(db){return await config(db);}
/** Resolve DocuSign's OAuth environment and regional REST API from the
 * service user's actual authorized account. Sandbox and production differ:
 * hard-coding demo.docusign.net breaks production merchants.
 */
export function resolveDocuSignRestBase(profile,accountId){
 if(typeof accountId!=='string'||!accountId.trim())throw Error('DocuSign account ID is required');
 const row=(Array.isArray(profile?.accounts)?profile.accounts:[]).find(x=>String(x.account_id||'')===accountId);
 if(!row)throw Error('The configured DocuSign account is not authorized for this integration user');
 let parsed;try{parsed=new URL(row.base_uri);}catch{throw Error('DocuSign returned an invalid account API URL');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash||
   parsed.pathname!=='/'&&!['','/'].includes(parsed.pathname)||
   !/^(?:[a-z0-9-]+\.)+docusign\.net$/.test(parsed.hostname))
  throw Error('DocuSign returned an untrusted API host');
 return parsed.origin+'/restapi/v2.1';
}
async function authToken(cfg){
 if(!cfg.accountId||!cfg.integrationKey||!cfg.userId||!cfg.privateKey)
  throw Error('DocuSign credentials are incomplete. Add the account, integration key, user ID, and RSA private key');
 const explicit=raw(Deno.env.get('DOCUSIGN_OAUTH_HOST'));
 const allowed=['account-d.docusign.com','account.docusign.com'];
 if(explicit&&!allowed.includes(explicit))throw Error('Unapproved DocuSign OAuth domain');
 const hosts=explicit?[explicit]:allowed;
 const pem=cfg.privateKey.replace(/\\n/g,'\n');
 const signatureKey=createPrivateKey(pem);
 for(const host of hosts){
  const now=Math.floor(Date.now()/1000);
  const unsigned=url64(JSON.stringify({typ:'JWT',alg:'RS256'}))+'.'+url64(JSON.stringify({
   iss:cfg.integrationKey,sub:cfg.userId,aud:host,iat:now,exp:now+3500,scope:'signature impersonation'
  }));
  const signature=rsaSign('RSA-SHA256',Buffer.from(unsigned),signatureKey).toString('base64url');
  const form=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
   assertion:unsigned+'.'+signature});
  const res=await fetch('https://'+host+'/oauth/token',{method:'POST',body:form,
   redirect:'error',signal:AbortSignal.timeout(15000)});
  if(res.ok){
   const response=await res.json();
   if(typeof response.access_token!=='string'||!response.access_token)throw Error('DocuSign did not return an access token');
   return {token:response.access_token,oauthHost:host};
  }
  // A test account may live in demo while an approved integration lives in
  // production. Only try the other official hostname when the token is rejected.
  if(![400,401,403].includes(res.status))throw Error('DocuSign OAuth temporarily unavailable (HTTP '+res.status+')');
 }
 throw Error('DocuSign JWT consent or credentials were not accepted. Approve impersonation consent for this integration user.');
}
export async function providerFetch(db,path,options={}){
 const cfg=await config(db),credentials=await authToken(cfg);
 const info=await fetch('https://'+credentials.oauthHost+'/oauth/userinfo',{
  headers:{Authorization:'Bearer '+credentials.token,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(15000)
 });
 if(!info.ok)throw Error('DocuSign could not resolve the configured signer account');
 const base=resolveDocuSignRestBase(await info.json(),cfg.accountId);
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))throw Error('Invalid DocuSign API path');
 const target=base+'/accounts/'+encodeURIComponent(cfg.accountId)+path;
 const res=await fetch(target,{...options,headers:{Authorization:'Bearer '+credentials.token,Accept:'application/json',...(options.headers||{})},
  redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error('DocuSign API request returned HTTP '+res.status);
 return res;
}
/** Build a readable PDF for every participant. Reviewer changes occur before sending. */
export async function buildAgreementPdf(contract,participants){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page=doc.addPage([612,792]),y=744;
 const line=(content,b=false)=>{
  if(y<75){page=doc.addPage([612,792]);y=740;}
  // Helvetica WinAnsi can't encode some Unicode input; drop unsupported codepoints.
  const text=String(content||'').normalize('NFKD').replace(/[^\x20-\x7e]/g,' ').slice(0,300);
  page.drawText(text,{x:48,y,size:b?12:10,font:b?bold:font,color:rgb(.15,.17,.22)});y-=b?22:15;
 };
 const block=(text)=>{
  const words=String(text||'').replace(/\s+/g,' ').split(' ');let lineText='';
  for(const word of words){
   if((lineText+' '+word).length>91){line(lineText);lineText=word;}
   else lineText+=(lineText?' ':'')+word;
  }
  if(lineText)line(lineText);y-=8;
 };
 line('CONTENT CONNECT X - COLLABORATION AGREEMENT',true);
 line('Document title: '+contract.title);line('Agreement ID: '+contract.id);
 line('Generated: '+new Date().toISOString().slice(0,19)+' UTC');y-=10;
 line('PARTICIPANTS AND INDIVIDUAL ROLES',true);
 for(const p of participants)block((p.name||'Participant')+' - '+p.role+' - '+p.member_id);
 line('TERMS',true);
 const content=contract.content||{};
 if(content.ai_draft){block(content.ai_draft);}
 else for(const [key,value] of Object.entries(content)){
  if(value===null||value===undefined)continue;
  line(String(key).replaceAll('_',' ').toUpperCase(),true);
  block(typeof value==='string'?value:JSON.stringify(value));
 }
 line('INDIVIDUAL ACKNOWLEDGEMENT',true);
 block('Each signer independently confirms the terms applicable to them. Collaboration consent, rights grants and any changes remain individually determined and recorded separately.');
 for(const p of participants.filter(x=>x.role!=='viewer')){
  page=doc.addPage([612,792]);y=735;
  line('INDIVIDUAL SIGNATURE PAGE',true);
  line('Agreement: '+contract.title);line('Participant: '+p.name);line('Role: '+p.role);
  line('This signature represents only this participant, not other parties.');
  y=590;
  line('Please review and sign on the indicated line:',true);
  line('SIGN_HERE_'+p.member_id);
  line('Date: __________________________');
 }
 const bytes=await doc.save();
 return b64(bytes);
}
