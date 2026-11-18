/** Reject server credentials before a browser client OR a Vite bundle is built.
 * JWT decoding here classifies configuration only; it never authenticates users.
 * Errors deliberately contain no key material.
 */
export function browserKeyIsUnsafe(value){
 const key=typeof value==='string'?value.trim():'';
 if(!key)return false;
 if(/^sb_secret_/i.test(key)||/service_role/i.test(key))return true;
 const parts=key.split('.');
 if(key.startsWith('eyJ')){
  try{
   if(parts.length!==3)return true;
   const encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/');
   const payload=JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')));
   // Only legacy anon project keys belong in browser configuration, never
   // authenticated member tokens or service-role credentials.
   return payload?.role!=='anon';
  }catch{return true;}
 }
 return false;
}
export function assertSafeBrowserEnvironment(env={}){
 for(const [name,value] of Object.entries(env)){
  if(name.startsWith('VITE_')&&browserKeyIsUnsafe(value))
   throw new Error('Unsafe server credential in public build configuration. Remove it before building.');
 }
}
