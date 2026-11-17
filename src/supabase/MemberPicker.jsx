/** Search the authorized directory; never ask members to paste database UUIDs. */
import React,{useRef,useState} from 'react';
import {Search} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const field='w-full rounded-md border border-[#34445D] bg-[#0F1520] p-2 text-sm';
export default function MemberPicker({value='',onChange,label='Find a member',disabled=false,onlyIds=null,excludeIds=[],role=''}){
 const [query,setQuery]=useState(''),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false);
 const version=useRef(0);
 const search=async()=>{
  const request=++version.current;setBusy(true);setError('');
  try{
   if(onlyIds&&onlyIds.length===0){setResults([]);setSearched(true);return;}
   const {data,error:failure}=await supabase.functions.invoke('directory',{body:{query,role,...(onlyIds?{ids:onlyIds.slice(0,100)}:{})}});
   if(failure){let reason=failure.message;try{reason=(await failure.context?.json())?.error||reason;}catch{/* use original */}throw Error(reason);}
   if(data?.error)throw Error(data.error);
   if(request!==version.current)return;
   setResults((data?.results||[]).filter(p=>!excludeIds.includes(p.id)));setSearched(true);
  }catch(e){if(request===version.current)setError(e.message);}
  finally{if(request===version.current)setBusy(false);}
 };
 return <div className="space-y-2">
  <label className="block text-sm">{label}<div className="mt-1 flex gap-2"><input className={field} type="search" value={query} disabled={disabled||busy} placeholder="Name or stage name" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}}/><button type="button" className="ccx-secondary rounded-lg px-3" disabled={disabled||busy} aria-label={'Search '+label.toLowerCase()} onClick={()=>void search()}><Search size={16}/></button></div></label>
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
  {(results.length>0||value)&&<label className="block text-xs">Selected member<select className={field+' mt-1'} value={value} disabled={disabled||busy} onChange={e=>onChange(e.target.value,results.find(p=>p.id===e.target.value))}><option value="">Choose a search result</option>{value&&!results.some(p=>p.id===value)&&<option value={value}>Selected member</option>}{results.map(p=><option key={p.id} value={p.id}>{p.display_name} · {[p.city,p.country].filter(Boolean).join(', ')}</option>)}</select></label>}
  {searched&&!results.length&&!busy&&<p className="text-xs text-[#9AA6BC]">{onlyIds?.length===0?'You need an accepted friend connection before starting a conversation.':'No eligible members match this search.'}</p>}
 </div>;
}
