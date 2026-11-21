/** DSN is a public ingestion identifier, not an API secret. Restrict it to
 * hosted Sentry ingestion domains before it is exposed to opted-in browsers.
 */
export function verifiedSentryDsn(value){
 if(typeof value!=='string'||value.length>350)return null;
 try{
  const u=new URL(value.trim()),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||!host.endsWith('.sentry.io')||!host.includes('ingest.')||
   !/^[0-9]+$/.test(u.pathname.slice(1))||!u.username||u.password||
   u.search||u.hash||u.port) return null;
  return u.toString();
 }catch{return null;}
}
