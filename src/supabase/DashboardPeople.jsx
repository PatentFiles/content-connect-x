/** Featured professionals use the same authorized directory as Discovery.
 * Age is shown only as the verified 18+ category. Exact birth dates are never
 * returned or inferred from private identity verification records.
 */
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import {countryName} from './profileOptions';
import {validateWorkLink,roleTitle} from './roleWorkspacePolicy.mjs';
import {ChevronDown,ChevronUp,UserRound,MapPin,ShieldCheck} from 'lucide-react';
async function directory(body){
 const {data,error}=await supabase.functions.invoke('directory',{body});
 if(error||data?.error)throw Error(data?.error||'Profiles are currently unavailable.');
 return data?.results||[];
}
export default function DashboardPeople({widget,profile,onNavigate}){
 const workspace=useRoleWorkspace();
 const [people,setPeople]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false);
 const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[links,setLinks]=useState({}),[detailError,setDetailError]=useState('');
 const dialog=useRef(null),selection=useRef(0);
 const city=String(profile?.city||'').trim(),country=countryName(profile?.country||'');
 const needsLocation=widget.local&&(!city||!country);
 useEffect(()=>{
  let active=true;setPeople([]);setError('');setExpanded(false);setLoading(!needsLocation);
  if(needsLocation)return()=>{active=false;};
  directory({mode:'discovery',role:widget.role||'',limit:12,...(widget.local?{city,country,state:profile?.state||''}:{})})
   .then(rows=>{if(active)setPeople(rows.slice(0,12));})
   .catch(e=>{if(active)setError(e.message);})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[widget.id,widget.role,widget.local,needsLocation,city,country,profile?.state,workspace?.user?.id,retry]);
 useEffect(()=>{
  if(!selected)return;
  const element=dialog.current,request=++selection.current;
  setDetail(null);setLinks({});setDetailError('');
  if(element&&!element.open)element.showModal();
  directory({mode:'discovery',ids:[selected.id]}).then(async rows=>{
   if(request!==selection.current)return;
   const person=rows.find(row=>row.id===selected.id);
   if(!person)throw Error('This profile is no longer available.');
   setDetail(person);
   const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action:'view_social_links',target_user_id:person.id}});
   if(request===selection.current&&!failure&&!data?.error)setLinks(data?.socials||{});
  }).catch(e=>{if(request===selection.current)setDetailError(e.message);});
  return()=>{selection.current++;element?.close();};
 },[selected]);
 const visible=expanded?people.slice(0,12):people.slice(0,1);
 if(needsLocation)return <div className="rounded-xl border border-[var(--cc-border)] p-3 text-sm"><p className="font-medium">Show nearby professionals</p><button type="button" onClick={()=>onNavigate('profile')} className="mt-3 min-h-11 text-[var(--cc-link)] underline">Set profile location</button></div>;
 if(loading)return <div className="animate-pulse space-y-2" role="status" aria-label="Loading featured profiles"><div className="h-40 rounded-xl bg-[var(--cc-surface-subtle)]"/><div className="h-5 w-2/3 rounded bg-[var(--cc-surface-subtle)]"/></div>;
 if(error)return <div role="alert" className="rounded-xl border p-3 text-sm"><p>Featured profiles are unavailable.</p><button type="button" className="mt-2 min-h-11 underline" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>;
 return <div className="space-y-3" data-featured-profiles={widget.id}>
  {!people.length&&<button type="button" onClick={()=>onNavigate('directory')} className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4 text-center text-sm">
   <UserRound size={42} color="currentColor"/><strong>Explore {widget.title.toLowerCase()}</strong><span className="text-xs text-[var(--cc-text-secondary)]">Browse profiles</span>
  </button>}
  {visible.map(person=><button key={person.id} type="button" data-featured-profile={person.id}
    className="ccx-person-preview relative block w-full overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-0 text-left"
    style={{display:'block'}} onClick={()=>setSelected(person)} aria-label={'Open '+person.display_name+' profile'}>
    <div className="relative h-44 w-full overflow-hidden bg-[var(--cc-surface-hover)]">
     {person.avatar_url?<img src={person.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><span className="text-6xl font-semibold text-[var(--cc-text-secondary)]">{(person.display_name||'?').slice(0,1)}</span></div>}
     <span className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-2 py-1 text-xs font-medium text-white">18+ verified</span>
    </div>
    <div className="space-y-1 px-3 py-3">
     <strong className="block break-words text-base">{person.display_name}</strong>
     <span className="block text-xs text-[var(--cc-text-secondary)]">{roleTitle(person.role_type)}</span>
     <span className="flex items-start gap-1 text-xs text-[var(--cc-text-secondary)]"><MapPin size={13} className="mt-0.5 shrink-0"/>{[person.city,person.state,person.country].filter(Boolean).join(', ')||'Location not listed'}</span>
     <span className="flex items-center gap-1 text-xs text-[var(--cc-text-secondary)]"><ShieldCheck size={13}/>Age: 18+ verified</span>
    </div>
   </button>)}
  {people.length>1&&<button type="button" className="ccx-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-label={expanded?'Collapse '+widget.title:'Expand '+widget.title}>
   {expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
   {expanded?'Show one profile':`Expand · view ${people.length} profiles`}
  </button>}
  <button type="button" className="min-h-11 w-full text-sm font-medium text-[var(--cc-link)] underline" onClick={()=>onNavigate('directory')}>See all {widget.title.toLowerCase()}</button>
  {selected&&<dialog ref={dialog} className="ccx-profile-dialog" aria-labelledby="ccx-profile-heading" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)}>
   <header><h2 id="ccx-profile-heading">Professional profile</h2><button type="button" autoFocus onClick={()=>setSelected(null)} aria-label="Close profile">Close</button></header>
   {detailError?<p role="alert">{detailError}</p>:!detail?<p role="status">Checking profile access…</p>:<>
    {detail.avatar_url&&<img className="ccx-profile-portrait" src={detail.avatar_url} alt="" referrerPolicy="no-referrer"/>}
    <h3>{detail.display_name}</h3><p>{roleTitle(detail.role_type)}</p><p>{[detail.city,detail.state,detail.country].filter(Boolean).join(', ')}</p>
    <p className="ccx-profile-bio">{detail.bio||'No biography shared yet.'}</p>
    <p>Age: verified adult (18+). Exact birth date is private.</p>
    <h4>Shared professional links</h4>
    <div className="ccx-profile-links">{Object.entries(links).filter(([,url])=>validateWorkLink(url)).map(([label,url])=><a key={label} href={String(url)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{label}</a>)}</div>
    {!Object.entries(links).some(([,url])=>validateWorkLink(url))&&<p>No public professional links listed.</p>}
    <button type="button" className="ccx-widget-link" onClick={()=>{setSelected(null);onNavigate('directory');}}>Open Discovery profile</button>
   </>}
  </dialog>}
 </div>;
}
