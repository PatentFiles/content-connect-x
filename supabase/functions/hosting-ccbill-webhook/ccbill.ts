import {optionalProviderSetting} from './providerConfig.mjs';
/** CCBill hosted FlexForms, only after specific adult-industry merchant approval. */
import {createHash} from 'node:crypto';
export const flexConfigured=()=>Boolean(
 // Separate final production switch; merchant onboarding alone must never enable live charges.
 optionalProviderSetting('HOSTING_FINANCIAL_RELEASE_APPROVED')==='true'&&
 optionalProviderSetting('HOSTING_PROVIDER_CALLBACK_RECONCILED')==='true'&&
 optionalProviderSetting('CCBILL_HOSTING_APPROVED')==='true'&&
 optionalProviderSetting('CCBILL_DYNAMIC_PRICING_APPROVED')==='true'&&
 optionalProviderSetting('CCBILL_FLEXFORM_LIVE_APPROVED')==='true'&&
 Deno.env.get('CCBILL_CLIENT_ACCNUM')&&
 Deno.env.get('CCBILL_CLIENT_SUBACC')&&
 Deno.env.get('CCBILL_FLEX_ID')&&
 Deno.env.get('CCBILL_SALT')&&
 optionalProviderSetting('CCBILL_BOOKING_PERIOD_DAYS')
);
export const md5Hex=(value:string)=>createHash('md5').update(value,'utf8').digest('hex');
export const sha256Hex=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');
export const safeEq=(a:string,b:string)=>{
 if(!/^[0-9a-f]{32}$/i.test(a)||!/^[0-9a-f]{32}$/i.test(b))return false;
 const aa=Buffer.from(a.toLowerCase(),'hex'),bb=Buffer.from(b.toLowerCase(),'hex');
 let x=0;for(let i=0;i<aa.length;i++)x|=aa[i]^bb[i];return x===0;
};
export function buildFlexformUrl(bookingId:string,cents:number){
 if(!flexConfigured())throw Error('Adult merchant and dynamic checkout are not approved/configured');
 if(!Number.isSafeInteger(cents)||cents<300||cents>100_000_000)throw Error('CCBill amount is outside configured range');
 const account=Deno.env.get('CCBILL_CLIENT_ACCNUM')||'';
 const sub=Deno.env.get('CCBILL_CLIENT_SUBACC')||'';
 const flex=Deno.env.get('CCBILL_FLEX_ID')||'';
 const period=Number(optionalProviderSetting('CCBILL_BOOKING_PERIOD_DAYS'));
 if(!/^\d{6}$/.test(account)||!/^\d{4}$/.test(sub)||!Number.isInteger(period)||period<2||period>365||
   !/^[0-9a-f-]{36}$/i.test(flex))throw Error('Unapproved CCBill merchant form settings');
 const amount=(cents/100).toFixed(2);
 const digest=md5Hex(amount+period+'840'+Deno.env.get('CCBILL_SALT'));
 const url=new URL('https://api.ccbill.com/wap-frontflex/flexforms/'+flex);
 url.searchParams.set('clientSubacc',sub);
 url.searchParams.set('initialPrice',amount);
 url.searchParams.set('initialPeriod',String(period));
 url.searchParams.set('currencyCode','840');
 url.searchParams.set('formDigest',digest);
 url.searchParams.set('X-ccx_booking',bookingId);
 return url.toString();
}
export function verifyPurchaseDigest(subscriptionId:string,status:number,received:string){
 const salt=Deno.env.get('CCBILL_SALT')||'';
 if(!salt||!subscriptionId||![0,1].includes(status))return false;
 return safeEq(md5Hex(subscriptionId+status+salt),received);
}
