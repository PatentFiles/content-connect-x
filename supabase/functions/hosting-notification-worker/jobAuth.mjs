/** Dedicated worker credentials are independent of member JWTs. */
export async function validJobBearer(header,secret){
 if(typeof secret!=='string'||secret.length<32||typeof header!=='string'||!header.startsWith('Bearer '))return false;
 const candidate=header.slice(7);if(candidate.length>2048)return false;
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([secret,candidate].map(value=>crypto.subtle.digest('SHA-256',enc.encode(value))));
 const x=new Uint8Array(a),y=new Uint8Array(b);let different=0;
 for(let i=0;i<x.length;i++)different|=x[i]^y[i];
 return different===0;
}

/** Hosted scheduler keys are provisioned in database Vault. A deliberately
 * configured legacy Edge key remains valid for compatibility; no key is
 * returned from the database. Only a service-role caller can validate a hash.
 */
export async function validJobBearerWithVault(header,legacySecret,db,job){
 if(!['calendar','notifications'].includes(job)||typeof header!=='string'||!header.startsWith('Bearer '))return false;
 const candidate=header.slice(7);
 if(candidate.length<32||candidate.length>2048)return false;
 if(await validJobBearer(header,legacySecret))return true;
 try{
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate)));
  const hash=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const {data,error}=await db.rpc('ccx_hosting_job_authorized',{p_job:job,p_hash:hash});
  return !error&&data===true;
 }catch{return false;}
}
