/** Select people by display name. Actual connection/invitation permissions remain server-enforced. */
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {functionErrorMessage} from './apiErrors.mjs';
export default function MemberPicker({userId,value='',onChange,scope='directory',multiple=false,disabled=false,label='Choose a member'}){
 const [query,setQuery]=useState(''),[items,setItems]=useState([]),[names,setNames]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 const selected=String(value||'').split(',').filter(Boolean);
 useEffect(()=>{
  let alive=true;const current=++generation.current;
  const timer=window.setTimeout(async()=>{
   setBusy(true);setError('');
   try{
    let ids=null;
    if(scope==='connections'){
     const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action:'list_connection_requests'}});
     if(failure||data?.error)throw new Error(await functionErrorMessage(failure,data));
     ids=(data?.items||[]).filter(item=>item.status==='accepted').map(item=>item.requester_id===userId?item.recipient_id:item.requester_id);
     if(!ids.length){if(alive&&current===generation.current)setItems([]);return;}
    }
    const {data,error:failure}=await supabase.functions.invoke('directory',{body:{query,offset:0,...(ids?{ids}:{})}});
    if(failure||data?.error)throw new Error(await functionErrorMessage(failure,data,'Member search unavailable'));
    if(!alive||current!==generation.current)return;
    const people=(data?.results||[]).filter(item=>item.id!==userId);
    setItems(people);setNames(previous=>({...previous,...Object.fromEntries(people.map(item=>[item.id,item.display_name||'Member']))}));
   }catch(e){if(alive&&current===generation.current)setError(e.message);}
   finally{if(alive&&current===generation.current)setBusy(false);}
  },250);
  return()=>{alive=false;generation.current++;window.clearTimeout(timer);};
 },[query,scope,userId]);
 const choose=person=>{
  if(disabled)return;
  if(multiple){const next=selected.includes(person.id)?selected.filter(id=>id!==person.id):[...selected,person.id];if(next.length>9)return;onChange(next.join(','));}
  else onChange(selected.includes(person.id)?'':person.id);
 };
 return <div className="min-w-0 flex-1 space-y-2">
  <label className="block text-sm">{label}<input type="search" className="mt-1 w-full min-w-0 rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2.5 text-white" value={query} onChange={event=>setQuery(event.target.value)} placeholder={scope==='connections'?'Search your accepted friends…':'Search verified people by name…'} disabled={disabled} autoComplete="off"/></label>
  {selected.length>0&&<div className="flex flex-wrap gap-1">{selected.map(id=><button type="button" key={id} className="ccx-secondary rounded-lg px-2 py-1 text-xs" disabled={disabled} aria-label={'Remove selected '+(names[id]||'member')} onClick={()=>onChange(selected.filter(item=>item!==id).join(','))}>{names[id]||'Selected member'} ×</button>)}</div>}
  {busy&&<p role="status" className="text-xs text-[#AABBD4]">Searching members…</p>}
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
  {!busy&&!error&&!items.length&&<p className="text-xs text-[#AABBD4]">{scope==='connections'?'No matching accepted friends. Connect through Discovery first.':'No matching verified profiles.'}</p>}
  <div className="max-h-44 space-y-1 overflow-y-auto">{items.map(person=><button type="button" key={person.id} aria-pressed={selected.includes(person.id)} disabled={disabled} onClick={()=>choose(person)} className={'block w-full rounded-lg border px-3 py-2 text-left text-sm '+(selected.includes(person.id)?'border-[#FF8DD9] bg-[#263D66]':'border-[#34445D] bg-[#101A2B]')}><span className="block font-semibold">{person.display_name}</span><span className="text-xs text-[#AABBD4]">{[person.role_type?.replaceAll('_',' '),person.city,person.state].filter(Boolean).join(' · ')}</span></button>)}</div>
 </div>;
}
