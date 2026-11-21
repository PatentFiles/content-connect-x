/** Check the AAL2 assertion in the same Supabase access token whose user was
 * already authenticated by auth.getUser(). Never use this decoder without
 * that independent server-side token validation.
 */
export function verifiedAal2(authorization,validatedUserId,now=Math.floor(Date.now()/1000)){
 if(typeof authorization!=='string'||typeof validatedUserId!=='string')return false;
 const match=/^Bearer ([A-Za-z0-9_\-.]+)$/i.exec(authorization.trim());
 if(!match)return false;
 const parts=match[1].split('.');
 if(parts.length!==3)return false;
 try{
  const base64=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  const claims=JSON.parse(atob(base64+'='.repeat((4-base64.length%4)%4)));
  return claims?.sub===validatedUserId && claims?.aal==='aal2' &&
   typeof claims.exp==='number'&&claims.exp>now &&
   claims.role==='authenticated';
 }catch{return false;}
}
