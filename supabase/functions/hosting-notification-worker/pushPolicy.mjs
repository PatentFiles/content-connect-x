/** Browser push URLs are user input, not arbitrary server-side fetch targets.
 * Official service domains only. Unsupported push vendors fail explicitly.
 */
export function isSupportedPushEndpoint(value){
 try{
  const url=new URL(value),host=url.hostname.toLowerCase();
  const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||
    host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
  return allowed&&url.protocol==='https:'&&(!url.port||url.port==='443')&&
    !url.username&&!url.password&&!url.hash&&url.pathname.length>1&&value.length<=1600;
 }catch{return false;}
}
export function validPushKeys(p256dh,auth){
 try{
  const decode=value=>atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  const publicKey=decode(p256dh),secret=decode(auth);
  return publicKey.length===65&&publicKey.charCodeAt(0)===4&&secret.length===16;
 }catch{return false;}
}
