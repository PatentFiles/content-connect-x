import {sanitizeMonitoringEvent} from './monitoringPrivacy.mjs';
import {supabase} from '@/api/supabaseClient';
import {readTracking} from './trackingPreferences.mjs';
/** Optional services never initialize before explicit device-level consent.
 * Access decisions continue to come from protected Supabase endpoints.
 * Preference withdrawal reloads the app to stop already-loaded optional SDKs.
 */
export async function initializeOptionalIntegrations(){
 const consent=readTracking();
 if(consent.diagnostics&&supabase){
  try{
   // Fetch the public Sentry DSN only if an administrator has enabled the
   // integration. Vault never exposes another provider token or private data.
   const {data,error}=await supabase.functions.invoke('ccx-integrations',{body:{action:'monitoring_config'}});
   if(!error&&data?.enabled===true&&typeof data.dsn==='string'){
    const Sentry=await import('@sentry/react');
    Sentry.init({
     dsn:data.dsn,environment:import.meta.env.MODE||'supabase',
     release:import.meta.env.VITE_RELEASE_SHA||undefined,
     tracesSampleRate:0,sampleRate:0.2,
     
     beforeBreadcrumb(){return null;},beforeSend:sanitizeMonitoringEvent
    });
   }
  }catch{console.warn('Optional privacy-filtered monitoring unavailable');}
 }
 const id=import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID;
 if(consent.experiments&&id){
  try{
   const {default:flagsmith}=await import('@flagsmith/flagsmith');
   await flagsmith.init({environmentID:id,cacheFlags:false,enableAnalytics:false,onError:()=>console.warn('Optional UI experiment service unavailable')});
  }catch{console.warn('Optional UI experiments could not initialize');}
 }
}
