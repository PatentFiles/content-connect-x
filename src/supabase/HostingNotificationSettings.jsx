/** Transactional notification opt-ins, browser Web Push and in-app reminders. */
import React,{useEffect,useState} from 'react';
import {Bell,ShieldCheck} from 'lucide-react';
import {productionAction} from './productionApi';
import {hostingBusiness} from './hostingBusinessApi';
const panel='ccx-surface p-5';
const button='rounded-lg ccx-action-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';

function decodeKey(value){
 const value64=value.replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(value64.padEnd(Math.ceil(value64.length/4)*4,'='));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export default function HostingNotificationSettings(){
 const [preferences,setPreferences]=useState({email_digest:false,booking_reminders:true,message_alerts:true});
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const key=import.meta.env.VITE_HOSTING_PUSH_PUBLIC_KEY;
 useEffect(()=>{
  let active=true;
  productionAction('notification_preferences').then(x=>{if(active)setPreferences(x.item||preferences);})
   .catch(e=>{if(active)setError(e.message);});
  if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(async registration=>{
    if(!active)return;
    const sub=await registration.pushManager.getSubscription();
    if(active)setEnabled(Boolean(sub));
  }).catch(()=>{});
  return()=>{active=false;};
 },[]);
 const save=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{await productionAction('set_notification_preferences',preferences);setNotice('Preferences updated.');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const activate=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(!key)throw Error('Push delivery has not yet been configured by the administrator.');
   if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('This browser does not support web push notifications.');
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Browser permission was not granted.');
   const registration=await navigator.serviceWorker.register('/sw-hosting.js');
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
   const json=subscription.toJSON();
   if(!json.endpoint||!json.keys?.auth||!json.keys?.p256dh)throw Error('Push keys missing');
   await hostingBusiness('push_register',{endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth});
   setEnabled(true);setNotice('This device was registered. Delivery starts when the approved push service is enabled.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const deactivate=async()=>{
  setBusy(true);setError('');
  try{
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.getSubscription();
   if(subscription){await hostingBusiness('push_unregister',{endpoint:subscription.endpoint});await subscription.unsubscribe();}
   setEnabled(false);setNotice('Push notifications disabled for this browser.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-4 text-white">
  <div><h2 className="text-2xl font-semibold flex gap-2 items-center"><Bell size={22}/> Booking notifications</h2>
    <p className="mt-2 text-sm text-[#A6B9D2]">Control reminders and optional delivery methods. Private medical information, IDs and explicit content are never included in email or push previews.</p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  <form className={panel+' space-y-4'} onSubmit={save}>
    <h3 className="font-semibold">Your notification preferences</h3>
    {[
      ['email_digest','Email summaries'],['booking_reminders','Booking and shoot reminders'],
      ['message_alerts','New message notifications']
    ].map(([id,label])=><label key={id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(preferences[id])} onChange={e=>setPreferences(v=>({...v,[id]:e.target.checked}))}/>{label}</label>)}
    <button className={button} disabled={busy}>Save preferences</button>
  </form>
  <div className={panel+' space-y-3'}>
    <h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={17}/> Web Push for this device</h3>
    <p className="text-sm text-[#A6B9D2]">{enabled?'This browser has an active push subscription.':'This browser has not enabled push.'}</p>
    <div className="flex gap-2">{enabled?<button className={button} disabled={busy} onClick={deactivate}>Disable on this device</button>:
      <button className={button} disabled={busy||!key} onClick={activate}>Enable browser push</button>}</div>
    {!key&&<p className="text-xs text-amber-200">Push provider settings are not configured yet. In-app notifications remain available.</p>}
  </div>
  <p className="text-xs text-[#A3B7D2]">Transactional email is queued until an approved delivery provider is configured. A booking status may change before its external notification is delivered.</p>
 </section>;
}
