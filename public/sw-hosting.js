/* Transactional previews remain neutral; navigation never trusts remote URLs. */
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{};}catch{/* malformed payload uses generic copy */}
  const title=typeof data.title==='string'?data.title.slice(0,120):'Content Connect X update';
  await self.registration.showNotification(title,{
   body:'You have a new private account update. Sign in to view details.',
   tag:typeof data.event_id==='string'?data.event_id.slice(0,100):'ccx-hosting',
   data:{url:'/Notifications'},icon:'/content_connect_logo.png'
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('/Notifications',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const current=windows.find(client=>{try{return new URL(client.url).origin===self.location.origin;}catch{return false;}});
  if(current){if('navigate' in current)await current.navigate(target);return current.focus();}
  return self.clients.openWindow(target);
 })());
});
