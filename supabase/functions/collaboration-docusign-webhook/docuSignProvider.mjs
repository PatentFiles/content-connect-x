/** DocuSign service authentication and document generation for individual collaborators.
 * Provider credentials may live in Supabase Edge secrets or the existing encrypted Vault.
 * Only this server module sees the credentials or handles contract bytes.
 */
import {PDFDocument,StandardFonts,rgb} from 'npm:pdf-lib@1.17.1';
const raw=(v)=>typeof v==='string'?v.trim():'';
const b64=(data)=>btoa(String.fromCharCode(...data));
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
async function authToken(cfg){
 if(!cfg.accountId||!cfg.integrationKey||!cfg.userId||!cfg.privateKey)
  throw Error('DocuSign credentials are incomplete. Add your DocuSign account, integration key, user ID, and private key.');
 const domain=raw(Deno.env.get('DOCUSIGN_OAUTH_HOST'))||'account-d.docusign.com';
 if(!['account-d.docusign.com','account.docusign.com'].includes(domain))throw Error('Unapproved DocuSign OAuth domain');
 const pem=cfg.privateKey.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const epoch=Math.floor(Date.now()/1000);
 const header=url64(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const payload=url64(JSON.stringify({iss:cfg.integrationKey,sub:cfg.userId,aud:domain,iat:epoch,exp:epoch+3500,scope:'signature impersonation'}));
 const unsigned=header+'.'+payload;
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
 const form=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(signature).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')});
 const res=await fetch('https://'+domain+'/oauth/token',{method:'POST',body:form,signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('DocuSign OAuth failed HTTP '+res.status);
 const value=await res.json();
 if(!value.access_token)throw Error('DocuSign returned no access token');
 return value.access_token;
}
export async function providerFetch(db,path,options={}){
 const cfg=await config(db),token=await authToken(cfg);
 const base=raw(Deno.env.get('DOCUSIGN_API_BASE'))||'https://demo.docusign.net/restapi/v2.1';
 const parsed=new URL(base);
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.docusign.net')||parsed.pathname!=='/restapi/v2.1')throw Error('DocuSign API host is not authorized');
 const target=base+'/accounts/'+encodeURIComponent(cfg.accountId)+path;
 const res=await fetch(target,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(options.headers||{})},signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error('DocuSign API HTTP '+res.status);
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
