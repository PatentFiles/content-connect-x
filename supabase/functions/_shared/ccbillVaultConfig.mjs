/** Resolve CCBill credentials from server environment OR the administrator's encrypted
 * integration settings. No card data and no private values reach the browser.
 * Checking "Enable" on the administrator CCBill card supplies the explicit
 * operator activation; cryptographically authenticated relay events still gate entitlements.
 */
import {membershipConfig} from './membershipBillingConfig.mjs';
const names={
 CCBILL_CLIENT_ACCNUM:'ccbill_client_account',
 CCBILL_MEMBERSHIP_SUBACC:'ccbill_subaccount',
 CCBILL_MEMBERSHIP_FLEX_ID:'ccbill_flex_id',
 CCBILL_MEMBERSHIP_SALT:'ccbill_salt',
 CCBILL_WEBHOOK_RELAY_SECRET:'ccbill_relay_secret',
 CCBILL_EVENT_TIMEZONE:'ccbill_event_timezone'
};
export async function membershipVaultConfig(db){
 const {data:provider,error}=await db.from('ccx_integrations').select('enabled').eq('provider','ccbill').maybeSingle();
 if(error)throw Error('CCBill provider availability unavailable');
 const stored={};
 for(const [envName,vaultName] of Object.entries(names)){
  if(Deno.env.get(envName))continue;
  // Missing optional configuration is a normal 'not ready' state, not a 503.
  // If Vault is unreachable or not seeded, retain the fail-closed status.
  try{
   const {data,error:secretError}=await db.rpc('ccx_secret_get',{p_name:vaultName});
   stored[envName]=!secretError&&typeof data==='string'?data:'';
  }catch{stored[envName]='';}
 }
 const enabled=provider?.enabled===true;
 return membershipConfig(name=>{
  if(name==='CCBILL_MEMBERSHIP_APPROVED'||name==='CCBILL_MEMBERSHIP_LIVE_APPROVED')
   return Deno.env.get(name)|| (enabled?'true':'false');
  return Deno.env.get(name)||stored[name]||'';
 });
}