/** Local discovery and independent city search share the same profile card/favorites. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Search,SlidersHorizontal,RefreshCw,X} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {countries,countryName,regionOptions,contentCategories,genderOptions,roleOptions} from './profileOptions';
import {localDiscoveryFilters,validateWorkLink} from './roleWorkspacePolicy.mjs';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import MemberDiscoveryCard from './MemberDiscoveryCard';
import SponsorshipSlot from './SponsorshipSlot';
const input='w-full min-w-0 rounded-xl bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] px-3 py-2.5 text-[var(--cc-text-primary)] focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const panel='ccx-surface p-5';
const emptyFilters={query:'',role:'',country:'',state:'',city:'',category:'',gender:''};
const roleNames=Object.fromEntries(roleOptions);
async function directoryRequest(body){const {data,error}=await supabase.functions.invoke('directory',{body});if(error||data?.error){let message=data?.error||error?.message||'Directory unavailable';if(error?.context?.json){try{const response=await error.context.json();message=response.error||message;}catch{/* use original */}}throw new Error(message);}return data;}
export default function CreatorDiscovery({user,approved,paid,mode='discovery',onNavigate}){
 const workspace=useRoleWorkspace();
 const local=localDiscoveryFilters(workspace.profile||{});
 if(local.country)local.country=countryName(local.country);
 const [filters,setFilters]=useState(()=>mode==='discovery'?local:emptyFilters);
 const [applied,setApplied]=useState(()=>mode==='discovery'?local:emptyFilters);
 const [results,setResults]=useState([]),[saved,setSaved]=useState([]),[favoriteBusy,setFavoriteBusy]=useState([]);
 const [inviteEligibility,setInviteEligibility]=useState(null),[representativeProfiles,setRepresentativeProfiles]=useState([]);
 const [working,setWorking]=useState(false),[searched,setSearched]=useState(false),[more,setMore]=useState(false),[offset,setOffset]=useState(0);
 const [error,setError]=useState(''),[favoriteError,setFavoriteError]=useState(''),[selected,setSelected]=useState(null),[socials,setSocials]=useState({}),[contactNotice,setContactNotice]=useState(''),[contactBusy,setContactBusy]=useState(false);
 const sequence=useRef(0),favoriteLocks=useRef(new Set());
 const loadSaved=useCallback(async()=>{const {data,error:failure}=await supabase.from('creator_favorites').select('creator_id').eq('user_id',user.id).order('created_at',{ascending:false});if(failure)throw failure;const ids=(data||[]).map(row=>row.creator_id);setSaved(ids);return ids;},[user.id]);
 const search=async(next=filters,append=false)=>{
  if(!approved)return;const requestId=++sequence.current;setWorking(true);setError('');
  try{const ids=mode==='favorites'?await loadSaved():null;if(ids&&!ids.length){if(requestId===sequence.current){setResults([]);setMore(false);setSearched(true);setOffset(0);}return;}
   const nextOffset=append?offset:0;const data=await directoryRequest({...next,mode,offset:nextOffset,...(ids?{ids}:{})});
   if(requestId!==sequence.current)return;const list=data.results||[];setResults(old=>append?[...old,...list.filter(p=>!old.some(existing=>existing.id===p.id))]:list);setOffset(nextOffset+list.length);setMore(data.has_more===true);setSearched(true);setApplied(next);
  }catch(e){if(requestId===sequence.current)setError(e.message);}finally{if(requestId===sequence.current)setWorking(false);}
 };
 useEffect(()=>{
  if(!approved)return;
  if(mode!=='favorites')void loadSaved().catch(e=>setFavoriteError(e.message));
  if(mode==='discovery'){setFilters(local);void search(local);}else if(mode==='favorites')void search(emptyFilters);
  return()=>{sequence.current++;};
 // Run for an account or destination change, not every edit to a filter.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[approved,user.id,mode]);
 useEffect(()=>{const close=e=>{if(e.key==='Escape')setSelected(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 const toggle=async id=>{
  if(favoriteLocks.current.has(id))return;favoriteLocks.current.add(id);setFavoriteBusy(old=>[...old,id]);setFavoriteError('');
  try{if(saved.includes(id)){const {error:failure}=await supabase.from('creator_favorites').delete().eq('user_id',user.id).eq('creator_id',id);if(failure)throw failure;setSaved(old=>old.filter(value=>value!==id));if(mode==='favorites')setResults(old=>old.filter(person=>person.id!==id));}
   else{const {error:failure}=await supabase.from('creator_favorites').upsert({user_id:user.id,creator_id:id},{onConflict:'user_id,creator_id',ignoreDuplicates:true});if(failure)throw failure;setSaved(old=>[...new Set([...old,id])]);}
  }catch(e){setFavoriteError(e.message);}finally{favoriteLocks.current.delete(id);setFavoriteBusy(old=>old.filter(value=>value!==id));}
 };
 const openProfile=person=>{
  setSelected(person);setSocials({});setContactNotice('');setInviteEligibility(null);setRepresentativeProfiles([]);
  if(person.id!==user.id)void supabase.rpc('ccx_representation_agreement_action',{p_action:'profile_links',p_data:{target_id:person.id}}).then(({data,error})=>{if(!error)setRepresentativeProfiles(data?.items||[]);},()=>{});
  if(paid&&person.id!==user.id)void supabase.functions.invoke('collaboration-workspace',{body:{action:'eligibility',target_user_id:person.id}}).then(({data,error})=>{if(!error)setInviteEligibility(current=>current===null?{member_id:person.id,...data}:current);}).catch(()=>{});
  if(paid)void supabase.functions.invoke('member-workflows',{body:{action:'view_social_links',target_user_id:person.id}}).then(({data,error:failure})=>{if(!failure)setSocials(data?.socials||{});}).catch(()=>{});
  // Only an actual opened profile counts; listing/searching does not record views.
  if(person.id!==user.id)void supabase.functions.invoke('profile-analytics',{body:{action:'record',profile_owner_id:person.id}}).catch(()=>{});
 };
 const connect=async()=>{if(!selected)return;setContactBusy(true);setContactNotice('');try{const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action:'request_connection',target_user_id:selected.id}});if(failure||data?.error)throw new Error(data?.error||failure?.message||'Connection unavailable');setContactNotice('Request sent. You can message when your connection is accepted.');}catch(e){setContactNotice(e.message);}finally{setContactBusy(false);}};
 const change=(key,value)=>setFilters(old=>({...old,[key]:value}));
 const region=regionOptions[countries.find(c=>c.name===filters.country)?.code];
 const reset=()=>{const next=mode==='discovery'?local:emptyFilters;setFilters(next);void search(next);};
 return <section className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{mode==='discovery'?'Discovery':mode==='search'?'Search':'Favorites'}</h2><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{mode==='favorites'?'People you saved from Discovery.':mode==='search'?'Find people in any city and filter by professional role.':local.city?'Discover people in '+local.city+' and change the filters to explore elsewhere.':'Set your city in My Profile to start locally, or choose a city below.'}</p></div>{approved&&<button type="button" className="ccx-secondary rounded-lg p-3" disabled={working} aria-label="Refresh profiles" onClick={()=>void search(applied)}><RefreshCw size={17}/></button>}</header>
  {!approved?<div className={panel}>Independent age verification is required before viewing profiles.</div>:<>
   {mode!=='favorites'&&<form className={panel+' space-y-4'} onSubmit={e=>{e.preventDefault();void search(filters);}}><div className="flex items-center gap-2"><SlidersHorizontal size={17}/><h3 className="font-semibold">{'Discovery filters'}</h3></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm">Name<input className={input+' mt-2'} value={filters.query} onChange={e=>change('query',e.target.value)} placeholder="Display name"/></label>
    <label className="text-sm">Professional role<select className={input+' mt-2'} value={filters.role} onChange={e=>change('role',e.target.value)}><option value="">All roles</option>{roleOptions.filter(([key])=>key!=='host').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm">Country<select className={input+' mt-2'} value={filters.country} onChange={e=>setFilters(old=>({...old,country:e.target.value,state:'',city:''}))}><option value="">All countries</option>{countries.map(country=><option key={country.code} value={country.name}>{country.name}</option>)}</select></label>
    <label className="text-sm">State / region{region?<select className={input+' mt-2'} value={filters.state} onChange={e=>change('state',e.target.value)}><option value="">All regions</option>{region.map(name=><option key={name}>{name}</option>)}</select>:<input className={input+' mt-2'} value={filters.state} onChange={e=>change('state',e.target.value)} placeholder="Any region"/>}</label>
    <label className="text-sm">City<input className={input+' mt-2'} value={filters.city} onChange={e=>change('city',e.target.value)} placeholder="Search another city"/></label>
    <label className="text-sm">Content type (opt-in profiles)<select className={input+' mt-2'} value={filters.category} onChange={e=>change('category',e.target.value)}><option value="">All categories</option>{contentCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {mode!=='favorites'&&<label className="text-sm">Gender identity (opt-in profiles)<select className={input+' mt-2'} value={filters.gender} onChange={e=>change('gender',e.target.value)}><option value="">All / not specified</option>{genderOptions.filter(([key])=>key&&key!=='self_describe').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
   </div><div className="flex flex-wrap gap-2"><button className="ccx-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5" disabled={working}><Search size={17}/>{working?'Searching…':'Search people'}</button><button type="button" className="ccx-secondary rounded-lg px-4 py-2.5" onClick={reset} disabled={working}>{mode==='discovery'?'Reset to my city':'Reset filters'}</button></div></form>}
   {!paid&&mode!=='favorites'&&<p className="text-sm text-[var(--cc-text-secondary)]">Free members can browse and save profiles worldwide. Existing local contact limits and membership requirements still apply.</p>}
   {error&&<p role="alert" className={panel+' text-red-800'}>{error}</p>}{favoriteError&&<p role="alert" className={panel+' text-red-800'}>Favorites could not be updated: {favoriteError}</p>}
   {working&&<p role="status" className="text-sm text-[var(--cc-text-secondary)]">Loading profiles…</p>}
   {searched&&!results.length&&!working&&!error&&<div className={panel+' text-sm text-[var(--cc-text-secondary)]'}>{mode==='favorites'?'No saved profiles are available. Use the heart on a Discovery card.':'No matching profiles found. Try a different city or broader filters.'}</div>}
   <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">{results.map(p=><MemberDiscoveryCard key={p.id} person={p} saved={saved.includes(p.id)} busy={favoriteBusy.includes(p.id)} canFavorite={p.id!==user.id} onFavorite={()=>void toggle(p.id)} onClick={()=>openProfile(p)}/>)}</div>
   <SponsorshipSlot placement="feed"/>
   {more&&<button type="button" className="ccx-primary rounded-xl px-5 py-3" disabled={working} onClick={()=>void search(applied,true)}>Load more</button>}
   {selected&&<div role="dialog" aria-modal="true" aria-label="Public professional profile" className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={()=>setSelected(null)}><section className="ccx-surface max-h-[85dvh] w-full max-w-lg space-y-4 overflow-y-auto p-6" onClick={e=>e.stopPropagation()}>
    <header className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{selected.display_name}</h3><p className="mt-1 text-sm text-[var(--cc-link)]">{roleNames[selected.role_type]||selected.role_type}</p></div><button type="button" className="p-2" aria-label="Close profile" onClick={()=>setSelected(null)}><X size={20}/></button></header>
    <p className="text-sm text-[var(--cc-text-secondary)]">{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>{selected.sexual_orientation&&<p className="text-sm capitalize text-[var(--cc-text-secondary)]">Orientation: {selected.sexual_orientation}</p>}{selected.bio&&<p className="whitespace-pre-wrap text-sm">{selected.bio}</p>}
    {representativeProfiles.length>0&&<section className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3"><h4 className="mb-2 text-sm font-semibold">Active professional representation</h4><ul className="space-y-1">{representativeProfiles.map(person=><li key={person.id} className="text-sm">{person.display_name} <span className="text-xs capitalize text-[var(--cc-text-secondary)]">· {person.role_type.replaceAll('_',' ')}</span></li>)}</ul><p className="mt-2 text-xs text-[var(--cc-text-secondary)]">Only mutually accepted current agreements appear here. Private contract terms are not shared.</p></section>}
    {paid?<div className="space-y-2"><h4 className="text-sm font-semibold">Shared professional links</h4>{Object.entries(socials).filter(([,url])=>validateWorkLink(url)).map(([provider,url])=><a key={provider} href={String(url)} target="_blank" rel="noopener noreferrer" className="ccx-secondary mr-2 inline-flex rounded-lg px-3 py-2 text-sm capitalize">{provider==='twitter'?'X / Twitter':provider}</a>)}{!Object.keys(socials).length&&<p className="text-xs text-[var(--cc-text-secondary)]">No links have been shared with premium members.</p>}</div>:<p className="text-xs text-[var(--cc-text-secondary)]">Social-link visibility follows the existing owner permissions and membership rules.</p>}
    {contactNotice&&<p role="status" className="rounded-lg border border-[var(--cc-border)] p-3 text-sm">{contactNotice}</p>}
    <button type="button" disabled={contactBusy||selected.id===user.id} className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={connect}>{contactBusy?'Checking eligibility…':paid?'Request connection':'Request local connection'}</button>
    {paid&&selected.id!==user.id&&<div className="space-y-2">
      {inviteEligibility?.member_id===selected.id&&inviteEligibility.eligible?<button type="button" className="ccx-primary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('collaborations',{targetUserId:selected.id})}>Create collaboration</button>:<p className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-xs text-[var(--cc-text-secondary)]">{inviteEligibility?.member_id===selected.id?inviteEligibility.reason:'Checking collaboration eligibility…'}</p>}
      {(selected.role_type==='agent'||selected.role_type==='studio')&&<button type="button" className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('roster',{targetUserId:selected.id})}>Request representation</button>}
      {['agent','studio'].includes(workspace.profile?.role_type)&&['creator','photographer','videographer','video_editor'].includes(selected.role_type)&&<button type="button" className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('roster',{targetUserId:selected.id})}>Offer representation</button>}
    </div>}
    <button type="button" className="ccx-primary w-full rounded-xl px-4 py-2.5" disabled={favoriteBusy.includes(selected.id)} onClick={()=>void toggle(selected.id)}>{saved.includes(selected.id)?'Remove from favorites':'Add to favorites'}</button>
    <button type="button" className="text-sm text-[var(--cc-link)] underline" onClick={()=>onNavigate?.('connections')}>View connection requests</button>
   </section></div>}
  </>}
 </section>;
}
