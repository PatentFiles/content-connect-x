/* Content Connect X: neutral transactional browser push notifications only. */
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  const title=typeof data.title==='string'?data.title:'Content Connect X update';
  const body=typeof data.body==='string'?data.body:'You have a new account notification.';
  const options={body,tag:'ccx-hosting',data:{url:'/'},icon:'/content_connect_logo.png'};
  await self.registration.showNotification(title,options);
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const current=windows.find(c=>c.url.startsWith(self.location.origin));
  if(current){await current.focus();return;}
  return self.clients.openWindow('/');
 }));
});
