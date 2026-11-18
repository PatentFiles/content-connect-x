/** CCBill hosted-form and verified-relay contracts. No cardholder data is retained. */
import {createHash} from 'node:crypto';
export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const hexHash=v=>createHash('sha256').update(v,'utf8').digest('hex');
export function moneyCents(value){
 const v=String(value??'');if(!/^\d{1,7}\.\d{2}$/.test(v))throw Error('Invalid provider amount');
 const [whole,fraction]=v.split('.');return Number(whole)*100+Number(fraction);
}
export function recurringCheckout({account,subaccount,flexId,salt,cents,nonce,days=30}){
 if(!/^\d{6}$/.test(account)||!/^\d{4}$/.test(subaccount)||!uuid(flexId)||!uuid(nonce)||
   typeof salt!=='string'||salt.length<8||!Number.isSafeInteger(cents)||cents<300||cents>1000000||days!==30)
  throw Error('Invalid or unapproved recurring checkout configuration');
 const price=(cents/100).toFixed(2),period=String(days),rebills='99';
 const digest=createHash('md5').update(price+period+price+period+rebills+'840'+salt,'utf8').digest('hex');
 const url=new URL('https://api.ccbill.com/wap-frontflex/flexforms/'+flexId);
 for(const [k,v] of Object.entries({clientAccnum:account,clientSubacc:subaccount,initialPrice:price,initialPeriod:period,
  recurringPrice:price,recurringPeriod:period,numRebills:rebills,currencyCode:'840',formDigest:digest,'X-ccx_membership':nonce}))url.searchParams.set(k,v);
 return url.href;
}
export function canonicalQuery(query){
 const p=new URLSearchParams(query);p.sort();return p.toString();
}
export function relayMessage(scope,timestamp,query,contentType,body){
 if(!['membership','rental'].includes(scope))throw Error('Invalid callback scope');
 return ['ccx-ccbill-v1',scope,timestamp,canonicalQuery(query),contentType,body].join('\n');
}
export async function relaySignature(secret,message){
 if(typeof secret!=='string'||secret.length<32)throw Error('Webhook relay is not configured');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifyRelay(req,body,scope,secret,now=Date.now()){
 const ts=req.headers.get('x-ccx-timestamp')||'',sig=req.headers.get('x-ccx-signature')||'';
 if(!/^\d{10}$/.test(ts)||!/^\w{64}$/.test(sig)||!/^[a-f0-9]+$/.test(sig)||Math.abs(now-Number(ts)*1000)>300000)return false;
 const query=req.headers.get('x-ccx-query')||'',type=(req.headers.get('content-type')||'').split(';')[0];
 if(query.length>2000||body.length>65536)return false;
 const expected=await relaySignature(secret,relayMessage(scope,ts,query,type,body));
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=sig.charCodeAt(i)^expected.charCodeAt(i);
 return mismatch===0;
}
export function parseEvent(raw,contentType,query){
 let data;
 if(contentType.includes('application/json'))data=JSON.parse(raw);
 else if(contentType.includes('application/x-www-form-urlencoded')){
  const pairs=new URLSearchParams(raw);if([...new Set(pairs.keys())].some(k=>pairs.getAll(k).length!==1))throw Error('Duplicate event field');
  data=Object.fromEntries(pairs);
 }else throw Error('Unsupported callback content type');
 if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Invalid callback');
 const p=new URLSearchParams(query);
 for(const key of ['clientAccnum','clientSubacc','eventType']){
  if(p.getAll(key).length>1)throw Error('Ambiguous callback metadata');
  const q=p.get(key);if(q&&data[key]!==undefined&&String(data[key])!==q)throw Error('Conflicting callback metadata');
  if(q)data[key]=q;
 }
 if(!/^\d{6}$/.test(String(data.clientAccnum||''))||!/^\d{4}$/.test(String(data.clientSubacc||'')))throw Error('Invalid merchant account');
 for(const key of ['subscriptionId','transactionId'])if(data[key]!==undefined&&
  (typeof data[key]!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(data[key])))throw Error('Provider identifiers must be strings');
 return data;
}
export function providerTime(value,timeZone){
 // CCBill sends a date without an offset. The merchant must explicitly set
 // the timezone confirmed with CCBill; never infer it from a browser's locale.
 if(typeof timeZone!=='string'||!timeZone)throw Error('CCBill event timezone is not configured');
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d:\d\d)?$/.test(value))throw Error('Invalid provider timestamp');
 const stamp=value.length===10?value+' 00:00:00':value.replace('T',' ');
 const [y,m,d,h,mi,se]=stamp.match(/\d+/g).map(Number);
 const desired=Date.UTC(y,m-1,d,h,mi,se);
 const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=t=>Object.fromEntries(format.formatToParts(new Date(t)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 let t=desired;
 for(let i=0;i<3;i++){const p=parts(t);t+=desired-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
 const p=parts(t);if(p.year!==y||p.month!==m||p.day!==d||p.hour!==h||p.minute!==mi||p.second!==se)throw Error('Impossible provider timestamp');
 if(!Number.isFinite(t))throw Error('Invalid provider time');return new Date(t).toISOString();
}
export function membershipEvent(data,expected,timeZone){
 if(String(data.clientAccnum)!==expected.account||String(data.clientSubacc)!==expected.subaccount)throw Error('Merchant account mismatch');
 const type=String(data.eventType||'');
 if(!['NewSaleSuccess','NewSaleFailure','RenewalSuccess','RenewalFailure','Cancellation','Expiration','Refund','Chargeback','Void','Return'].includes(type))throw Error('Unsupported membership event');
 const at=providerTime(data.timestamp,timeZone);
 if(Date.parse(at)>Date.now()+300000)throw Error('Future provider timestamp');
 const nonce=data['X-ccx_membership']||null;
 if(type.startsWith('NewSale')&&!uuid(nonce))throw Error('Unknown checkout reference');
 if(type!=='NewSaleFailure'&&!data.subscriptionId)throw Error('Missing subscription');
 const success=type==='NewSaleSuccess'||type==='RenewalSuccess';
 let cents=null,until=null;
 if(success){
  cents=moneyCents(type==='NewSaleSuccess'?data.subscriptionInitialPrice:data.billedAmount);
  const currency=String(type==='NewSaleSuccess'?data.subscriptionCurrencyCode:data.billedCurrencyCode);
  if(currency!=='840')throw Error('Unsupported membership currency');
  if(type==='NewSaleSuccess'&&(Number(data.initialPeriod)!==30||Number(data.recurringPeriod)!==30||moneyCents(data.subscriptionRecurringPrice)!==cents))throw Error('Recurring terms mismatch');
  if(!data.transactionId||!data.nextRenewalDate)throw Error('Missing paid-through evidence');
  until=providerTime(data.nextRenewalDate,timeZone);
  if(Date.parse(until)<=Date.parse(at)||Date.parse(until)>Date.parse(at)+32*86400000)throw Error('Invalid recurring period');
 }
 const id=hexHash([expected.account,expected.subaccount,type,data.subscriptionId||nonce,data.transactionId||'',at].join('|'));
 return {event_id:id,event_type:type,account:expected.account,subaccount:expected.subaccount,
  subscription_id:data.subscriptionId||null,transaction_id:data.transactionId||null,checkout_nonce:nonce,
  occurred_at:at,period_end:until,amount_cents:cents,currency:success?'USD':null};
}

/** Bound memory use before parsing externally supplied callback payloads. */
export async function readCallbackBody(request,limit=65536){
 const reader=request.body?.getReader();if(!reader)throw Error('Callback body required');
 let size=0;const chunks=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;
  if(size>limit){await reader.cancel();throw Error('Callback too large');}chunks.push(value);
 }
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
