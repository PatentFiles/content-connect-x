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
