import React,{useEffect,useState} from 'react';
import {Video,ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const field='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const call=async(action,args={})=>{
 const {data,error}=await supabase.functions.invoke('meeting-suite',{body:{action,...args}});
 if(error||data?.error){
  let m=data?.error||error?.message||'Video provider unavailable';
  if(error?.context?.json)try{m=(await error.context.json()).error||m;}catch{/* retain error */}
  throw Error(m);
 }
 return data;
};
export default function VideoProviderSettings(){
 const [url,setUrl]=useState(''),[key,setKey]=useState(''),[secret,setSecret]=useState('');
 const [configured,setConfigured]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{void call('config_status').then(r=>{setConfigured(r.configured);setUrl(r.server_url||'');}).catch(e=>setError(e.message));},[]);
 const save=async event=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await call('config_save',{server_url:url,api_key:key,api_secret:secret});
   setConfigured(true);setKey('');setSecret('');
   setNotice('LiveKit credentials encrypted and connected. Collaboration, group and private-message rooms use this same provider.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-4 rounded-xl p-5" data-video-provider-settings="true">
  <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Video size={19}/>Group video meetings (LiveKit)</h2>
   <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Add your LiveKit Cloud or self-hosted server credentials once. The backend signs private participant tokens. Bolt remains the website host.</p>
  </div>
  <p className="flex items-center gap-2 text-sm"><ShieldCheck size={16}/>{configured?'Provider credentials configured':'Enter LiveKit provider credentials'}</p>
  <form onSubmit={save} className="grid gap-3">
   <label className="text-sm">LiveKit secure WebSocket URL<input required className={field} type="url" placeholder="wss://your-project.livekit.cloud" value={url} onChange={e=>setUrl(e.target.value)} /></label>
   <label className="text-sm">LiveKit API key<input required className={field} autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="API key"/></label>
   <label className="text-sm">LiveKit API secret<input required className={field} type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)} placeholder="API secret"/></label>
   <button className="ccx-primary rounded-xl px-4 py-2.5 text-sm" disabled={busy||!url||!key||!secret}>{busy?'Saving…':'Save encrypted LiveKit credentials'}</button>
  </form>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
  <p className="text-xs text-[var(--cc-text-secondary)]">The API secret is never sent back to the browser. Room access and recording consent are checked on the server for each member.</p>
 </section>;
}
