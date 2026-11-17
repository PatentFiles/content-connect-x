/** Remove optional SDK telemetry only for our older Edge CORS handlers. */
/** @param {string} projectUrl @param {typeof fetch} [fetchImpl] @returns {typeof fetch} */
export function compatibleEdgeFetch(projectUrl,fetchImpl=(input,init)=>globalThis.fetch(input,init)){
 const origin=new URL(projectUrl).origin;
 return (input,init)=>{
  const request=typeof Request!=='undefined'&&input instanceof Request?input:null;
  let url;try{url=new URL(request?request.url:String(input));}catch{return fetchImpl(input,init);}
  if(url.origin!==origin||!url.pathname.startsWith('/functions/v1/'))return fetchImpl(input,init);
  const headers=new Headers(init?.headers??request?.headers);
  headers.delete('x-client-info');
  for(const name of ['x-supabase-client-platform','x-supabase-client-platform-version','x-supabase-client-runtime','x-supabase-client-runtime-version'])headers.delete(name);
  return fetchImpl(input,{...init,headers});
 }
}
