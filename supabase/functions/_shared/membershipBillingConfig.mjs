import {uuid} from './ccbillPolicy.mjs';
export function membershipConfig(env){
 const account=env('CCBILL_CLIENT_ACCNUM')||'',subaccount=env('CCBILL_MEMBERSHIP_SUBACC')||'';
 const flexId=env('CCBILL_MEMBERSHIP_FLEX_ID')||'',salt=env('CCBILL_MEMBERSHIP_SALT')||'';
 const relaySecret=env('CCBILL_WEBHOOK_RELAY_SECRET')||'',timeZone=env('CCBILL_EVENT_TIMEZONE')||'';
 let validZone=false;try{if(timeZone){new Intl.DateTimeFormat('en',{timeZone});validZone=true;}}catch{}
 const configured=/^\d{6}$/.test(account)&&/^\d{4}$/.test(subaccount)&&uuid(flexId)&&salt.length>=8&&relaySecret.length>=32&&validZone;
 return {account,subaccount,flexId,salt,relaySecret,timeZone,ready:Boolean(configured&&
  env('CCBILL_MEMBERSHIP_APPROVED')==='true'&&env('CCBILL_MEMBERSHIP_LIVE_APPROVED')==='true')};
}
