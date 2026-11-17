/**
 * NON-SECRET provider settings. Credentials do not belong in this registry.
 * Optional settings have explicit fail-closed defaults, not fake API keys.
 * Supabase environment overrides keep their documented original names.
 * No approval is inferred from an API key being present.
 */
export const OPTIONAL_PROVIDER_SETTINGS=Object.freeze({
 HOSTING_ROUTING_OSRM_URL:'',HOSTING_ROUTING_APPROVED:'false',
 HOSTING_EXTRA_CALENDAR_HOSTS:'',
 HOSTING_FINANCIAL_RELEASE_APPROVED:'false',HOSTING_PROVIDER_CALLBACK_RECONCILED:'false',
 CCBILL_HOSTING_APPROVED:'false',CCBILL_DYNAMIC_PRICING_APPROVED:'false',
 CCBILL_FLEXFORM_LIVE_APPROVED:'false',CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED:'false',
 // Billing periods must come from the merchant contract, never an invented default.
 CCBILL_BOOKING_PERIOD_DAYS:'',
 DOCUSIGN_ADULT_BUSINESS_APPROVED:'false',
 DOCUSIGN_OAUTH_HOST:'account-d.docusign.com',
 DOCUSIGN_API_BASE:'https://demo.docusign.net/restapi/v2.1',
 HOSTING_EMAIL_PROVIDER_ENABLED:'false',HOSTING_EMAIL_API_URL:'',HOSTING_EMAIL_FROM:'',
 HOSTING_PUSH_PROVIDER_ENABLED:'false',WEB_PUSH_SUBJECT:'',HOSTING_FRONTEND_ORIGIN:'/',
 OPENMODERATE_SERVICE_URL:'',ADULT_MEDIA_PUBLICATION_READY:'false'
});
/** @param {string} name @param {(name:string)=>string|undefined} read */
export function optionalProviderSetting(name,read=key=>globalThis.Deno?.env?.get(key)){
 if(!Object.prototype.hasOwnProperty.call(OPTIONAL_PROVIDER_SETTINGS,name))
  throw new Error('Unknown non-secret provider setting');
 const value=read(name);
 return typeof value==='string'&&value.trim()?value.trim():OPTIONAL_PROVIDER_SETTINGS[name];
}
