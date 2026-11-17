/**
 * Older deployed CCX Edge Functions allow Authorization/apikey/Content-Type but
 * not the SDK's optional telemetry headers. Remove only those optional headers
 * at the final fetch boundary for OUR project's functions. Auth, Storage, REST,
 * custom security headers and calls to other origins are never modified.
 */
export function compatibleEdgeFetch(projectUrl,fetchImpl=(...args)=>globalThis.fetch(...args)){
 const origin=new URL(projectUrl).origin;
 return (input,init)=>{
  const request=typeof Request!=='undefined'&&input instanceof Request?input:null;
  let url;try{url=new URL(request?request.url:String(input));}catch{return fetchImpl(input,init);}
  if(url.origin!==origin||!url.pathname.startsWith('/functions/v1/'))return fetchImpl(input,init);
  const headers=new Headers(init?.headers??request?.headers);
  headers.delete('x-client-info');
  for(const name of ['x-supabase-client-platform','x-supabase-client-platform-version','x-supabase-client-runtime','x-supabase-client-runtime-version'])headers.delete(name);
  return fetchImpl(input,{...init,headers});
 };
}
