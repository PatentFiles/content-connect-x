/** Hosted Matterport IDs only. Never render user-supplied iframe HTML or tokens. */
export function normalizeMatterportUrl(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value.trim());const id=url.searchParams.get('m');
  if(url.protocol!=='https:'||url.hostname!=='my.matterport.com'||url.username||url.password||url.port||!/^\/show\/?$/.test(url.pathname)||!id||!/^[A-Za-z0-9]{8,64}$/.test(id))return null;
  return 'https://my.matterport.com/show/?m='+id;
 }catch{return null;}
}
export function matterportLinkFromText(text){
 if(typeof text!=='string'||text.length>100000)return null;
 const matches=text.match(/https:\/\/my\.matterport\.com\/show\/\?[^\s<>"']+/g)||[];
 for(const value of matches){const valid=normalizeMatterportUrl(value.replaceAll('&amp;','&'));if(valid)return valid;}
 return normalizeMatterportUrl(text);
}
