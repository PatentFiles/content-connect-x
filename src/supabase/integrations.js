/**
 * Optional external integrations.
 * - Sentry observes client errors only when explicitly configured.
 * - Flagsmith can supply nonsecurity UI experiments.
 *
 * All access decisions remain in authenticated Supabase Edge Functions. NEVER
 * expose a secret key in VITE_*; those variables are public browser settings.
 */
export async function initializeOptionalIntegrations() {
  const sentryDsn=import.meta.env.VITE_SENTRY_DSN;
  if(sentryDsn){
    try{
      const Sentry=await import('@sentry/react');
      Sentry.init({
        dsn:sentryDsn,
        environment:import.meta.env.MODE||'supabase',
        release:import.meta.env.VITE_RELEASE_SHA||undefined,
        tracesSampleRate:0,
        sampleRate:0.2,
        // No replay or user-session recordings are enabled for an adult platform.
        beforeBreadcrumb(){return null;},
        beforeSend(event){
          // Never transmit account details, user inputs, URLs containing tokens,
          // private document references, health data, headers or extra context.
          delete event.user;
          delete event.request;
          delete event.extra;
          delete event.contexts;
          delete event.breadcrumbs;
          if(event.exception?.values){
            for(const value of event.exception.values){
              if(value.value)value.value=value.type||'Application error';
            }
          }
          return event;
        },
      });
    }catch(err){console.warn('Optional error monitoring could not initialize');}
  }
  const id=import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID;
  if(id){
    try{
      const {default:flagsmith}=await import('@flagsmith/flagsmith');
      await flagsmith.init({
        environmentID:id,
        cacheFlags:false,
        enableAnalytics:false,
        onError:()=>console.warn('Optional UI experiment service unavailable'),
      });
    }catch{console.warn('Optional UI experiments could not initialize');}
  }
}
