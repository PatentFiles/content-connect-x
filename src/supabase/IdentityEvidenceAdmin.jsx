/** Read-only evidence review. Viewing a record never grants admission. */
import React,{useEffect,useState} from 'react';
import {identityAction} from './identityApi';
export default function IdentityEvidenceAdmin(){
 const [sessions,setSessions]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[reason,setReason]=useState(''),[link,setLink]=useState(null);
 const load=async()=>{setBusy(true);setError('');try{const result=await identityAction('admin_list');setSessions(result.sessions||[]);}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!link)return;const timer=window.setTimeout(()=>setLink(null),115000);return()=>window.clearTimeout(timer);},[link]);
 const open=async kind=>{setBusy(true);setError('');setLink(null);try{
  const result=await identityAction('admin_document',{session_id:selected.id,kind,reason});
  const url=new URL(result.url);if(url.protocol!=='https:'||url.origin!=='https://yxuqbygykpfbioslljlf.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/ccx-identity-evidence/'))throw Error('Untrusted document link.');
  setLink({url:url.href,kind});
 }catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="ccx-surface space-y-4 rounded-xl p-5">
  <h2 className="text-xl font-semibold">Private identity evidence</h2>
  <p className="text-sm leading-6">Restricted administrator review. Every document link requires a recorded purpose and expires after two minutes. Do not copy ID details into notes. Reviewing evidence does not approve an account or bypass an age restriction.</p>
  <button type="button" disabled={busy} onClick={load} className="ccx-secondary min-h-11 rounded-xl px-4 py-2">Refresh review queue</button>
  <div className="max-h-80 space-y-2 overflow-y-auto">{sessions.map(item=><button type="button" key={item.id} onClick={()=>{setSelected(item);setLink(null);setReason('');}} className="block w-full rounded-xl border p-3 text-left text-sm">
   <strong>{item.status.replaceAll('_',' ')}</strong>{item.review_requested_at?' · Review requested':''}<br/><span className="break-all">Account {item.user_id||'deleted'}</span><br/>{new Date(item.created_at).toLocaleString()}{item.purged_at?' · Evidence deleted':''}
  </button>)}{!sessions.length&&!busy&&<p className="text-sm">No verification sessions returned.</p>}</div>
  {selected&&<div className="space-y-3 rounded-xl border p-4">
   <p className="break-all text-sm">Session {selected.id}</p>
   <label className="block text-sm font-medium">Purpose of access<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} className="mt-2 block min-h-24 w-full rounded-lg border bg-white p-3 text-slate-900" placeholder="For example: Review reported document reading error. Do not enter personal ID details."/></label>
   <div className="flex flex-wrap gap-2">{['front','back','selfie'].map(kind=><button type="button" key={kind} disabled={busy||reason.trim().length<10||Boolean(selected.purged_at)} onClick={()=>open(kind)} className="ccx-secondary min-h-11 rounded-xl px-4 py-2">Open {kind}</button>)}</div>
   {link&&<a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block min-h-11 rounded-lg border p-3 text-sm underline">View {link.kind} in a private, temporary link</a>}
   <p className="text-xs">No approval override is provided. OCR appeals need documented independent investigation; a new validated verification must succeed before admission.</p>
  </div>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 </section>;
}
