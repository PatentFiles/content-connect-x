/**
 * A dependency-free launch-configuration inventory.
 * This checks presence of credentials and explicit server release gates only.
 * A configured service is NEVER proof of provider acceptance or successful E2E use.
 * Never include secret values in returned results or diagnostic logs.
 */
export const PROVIDERS = Object.freeze({
  docusign:{
    required:['DOCUSIGN_ACCOUNT_ID','DOCUSIGN_INTEGRATION_KEY','DOCUSIGN_USER_ID',
      'DOCUSIGN_PRIVATE_KEY','DOCUSIGN_CONNECT_HMAC_SECRET','DOCUSIGN_LOCATION_TEMPLATE_ID'],
    approvals:['DOCUSIGN_ADULT_BUSINESS_APPROVED'],
    note:'Separate DocuSign agreement templates, independently identified signers, HMAC callbacks and document/certificate archive need sandbox acceptance.'
  },
  adult_payment_processor:{
    required:['CCBILL_CLIENT_ACCNUM','CCBILL_CLIENT_SUBACC','CCBILL_FLEX_ID',
      'CCBILL_SALT','CCBILL_BOOKING_PERIOD_DAYS'],
    approvals:['CCBILL_HOSTING_APPROVED','CCBILL_DYNAMIC_PRICING_APPROVED',
      'CCBILL_FLEXFORM_LIVE_APPROVED','HOSTING_FINANCIAL_RELEASE_APPROVED',
      'HOSTING_PROVIDER_CALLBACK_RECONCILED','CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED'],
    note:'Merchant approval, signed event-contract verification, sandbox transactions, refunds and actual payouts must be independently reconciled.'
  },
  calendar_sync:{
    required:['HOSTING_CALENDAR_JOB_SECRET'],approvals:[],
    note:'Edge job secret must match its Supabase Vault counterpart. External feeds, cancellation conflicts and timezones still need live tests.'
  },
  transactional_email:{
    required:['HOSTING_NOTIFIER_JOB_SECRET','HOSTING_EMAIL_API_URL',
      'HOSTING_EMAIL_API_TOKEN','HOSTING_EMAIL_FROM'],
    approvals:['HOSTING_EMAIL_PROVIDER_ENABLED'],
    note:'The private delivery worker requires its matching Vault scheduler secret and provider-accepted neutral messages.'
  },
  web_push:{
    required:['HOSTING_NOTIFIER_JOB_SECRET','WEB_PUSH_VAPID_PUBLIC_KEY',
      'WEB_PUSH_VAPID_PRIVATE_KEY','WEB_PUSH_SUBJECT'],
    approvals:['HOSTING_PUSH_PROVIDER_ENABLED'],
    note:'A public browser VAPID key, service-worker enrollment and real device delivery tests are also required.'
  },
  map_routing:{
    required:['HOSTING_ROUTING_OSRM_URL'],approvals:['HOSTING_ROUTING_APPROVED'],
    note:'Routing is server-only. A separate approved browser map-tile URL and attribution must be configured for production.'
  },
  openmoderate:{
    required:['OPENMODERATE_SERVICE_URL','OPENMODERATE_API_KEY'],approvals:[],
    note:'An independent moderation worker, video inspection, human review and publication policy remain mandatory.'
  },
  background_screening:{required:[],approvals:[],unavailable:true,
    note:'Optional provider integration is not implemented. No invented endpoint/key is required.'},
  health_clearance:{required:[],approvals:[],unavailable:true,
    note:'Private review and the existing PASS partner workflow remain separate; no unused generic provider keys are required.'}

});
export function inspectProvider(name, env){
  const spec=PROVIDERS[name];
  if(!spec)throw new Error('Unknown provider');
  const missing=[
    ...spec.required.filter(key=>typeof env[key]!=='string'||!env[key].trim()),
    ...spec.approvals.filter(key=>env[key]!=='true')
  ];
  return {configured:!spec.unavailable&&missing.length===0,missing,note:spec.note,
    acceptance_verified:false};
}
export function trustedOrigin(value){
  if(typeof value!=='string'||!value.trim())return false;
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
      u.pathname==='/'&&(!u.port||u.port==='443')&&u.hostname.includes('.')&&
      u.hostname!=='localhost';
  }catch{return false;}
}
