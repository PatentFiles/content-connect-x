import {sanitizeMonitoringEvent} from './monitoringPrivacy.mjs';
import {readTracking} from './trackingPreferences.mjs';
/** Optional services never initialize before explicit device-level consent.
 * Access decisions continue to come from protected Supabase endpoints.
 * Preference withdrawal reloads the app to stop already-loaded optional SDKs.
 */
export async function initializeOptionalIntegrations(){
 const consent=readTracking();
 const sentryDsn=import.meta.env.VITE_SENTRY_DSN;
 if(consent.diagnostics&&sentryDsn){
  try{
   const Sentry=await import('@sentry/react');
   Sentry.init({dsn:sentryDsn,environment:import.meta.env.MODE||'supabase',release:import.meta.env.VITE_RELEASE_SHA||undefined,tracesSampleRate:0,sampleRate:0.2,beforeBreadcrumb(){return null;},beforeSend:sanitizeMonitoringEvent});
  }catch{console.warn('Optional error monitoring could not initialize');}
 }
 const id=import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID;
 if(consent.experiments&&id){
  try{
   const {default:flagsmith}=await import('@flagsmith/flagsmith');
   await flagsmith.init({environmentID:id,cacheFlags:false,enableAnalytics:false,onError:()=>console.warn('Optional UI experiment service unavailable')});
  }catch{console.warn('Optional UI experiments could not initialize');}
 }
}
