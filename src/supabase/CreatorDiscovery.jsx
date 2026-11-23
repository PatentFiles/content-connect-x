/** Local discovery and independent city search share the same profile card/favorites. */
import ConnectFeed from './ConnectFeed';
import {DISCOVERY_CATEGORIES} from './CategoryArtwork';
import DiscoveryCategoryGrid from './DiscoveryCategoryGrid';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Search,SlidersHorizontal,RefreshCw,X,ChevronDown,ChevronUp} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {countryName,contentCategories,genderOptions,roleOptions,orientationOptions} from './profileOptions';
import GeoLocationSelect,{EMPTY_GEO} from './GeoLocationSelect';
import {localDiscoveryFilters,validateWorkLink} from './roleWorkspacePolicy.mjs';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import MemberDiscoveryCard from './MemberDiscoveryCard';
import ProfileGallery from './ProfileGallery';
import SponsorshipSlot from './SponsorshipSlot';
import TravelCalendar from './TravelCalendar';
import AIMatchSuggestions from './AIMatchSuggestions';
import {IntroThread} from './FriendMessaging';
const input='w-full min-w-0 rounded-xl bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] px-3 py-2.5 text-[var(--cc-text-primary)] focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const panel='ccx-surface p-5';
const emptyFilters={query:'',role:'',country:'',state:'',city:'',category:'',gender:'',orientation:'',min_age:'',max_age:'',min_height_cm:'',max_height_cm:'',min_weight_kg:'',max_weight_kg:'',ethnicity:'',min_penis_inches:'',max_penis_inches:'',circumcision:'',breast_size:''};
const roleNames=Object.fromEntries(roleOptions);
async function directoryRequest(body){const {data,error}=await supabase.functions.invoke('directory',{body});if(error||data?.error){let message=data?.error||error?.message||'Directory unavailable';if(error?.context?.json){try{const response=await error.context.json();message=response.error||message;}catch{/* use original */}}throw new Error(message);}return data;}
export default function CreatorDiscovery({user,approved,paid,mode='discovery',onNavigate}){
 const workspace=useRoleWorkspace();
 const local=localDiscoveryFilters(workspace.profile||{});
 if(local.country)local.country=countryName(local.country);
 const [filters,setFilters]=useState(()=>mode==='discovery'?local:emptyFilters);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [applied,setApplied]=useState(()=>mode==='discovery'?local:emptyFilters);
 const [results,setResults]=useState([]),[saved,setSaved]=useState([]),[favoriteBusy,setFavoriteBusy]=useState([]);
 const [inviteEligibility,setInviteEligibility]=useState(null),[representativeProfiles,setRepresentativeProfiles]=useState([]);
 const [working,setWorking]=useState(false),[searched,setSearched]=useState(false),[more,setMore]=useState(false),[offset,setOffset]=useState(0);
 const [selectedTab,setSelectedTab]=useState('about');
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
  setSelected(person);setSelectedTab('about');setSocials({});setContactNotice('');setInviteEligibility(null);setRepresentativeProfiles([]);
  if(person.id!==user.id)void supabase.rpc('ccx_representation_agreement_action',{p_action:'profile_links',p_data:{target_id:person.id}}).then(({data,error})=>{if(!error)setRepresentativeProfiles(data?.items||[]);},()=>{});
  if(paid&&person.id!==user.id)void supabase.functions.invoke('collaboration-workspace',{body:{action:'eligibility',target_user_id:person.id}}).then(({data,error})=>{if(!error)setInviteEligibility(current=>current===null?{member_id:person.id,...data}:current);}).catch(()=>{});
  if(paid)void supabase.functions.invoke('member-workflows',{body:{action:'view_social_links',target_user_id:person.id}}).then(({data,error:failure})=>{if(!failure)setSocials(data?.socials||{});}).catch(()=>{});
  // Only an actual opened profile counts; listing/searching does not record views.
  if(person.id!==user.id)void supabase.functions.invoke('profile-analytics',{body:{action:'record',profile_owner_id:person.id}}).catch(()=>{});
 };
 const connect=async()=>{if(!selected)return;setContactBusy(true);setContactNotice('');try{const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action:'request_connection',target_user_id:selected.id}});if(failure||data?.error)throw new Error(data?.error||failure?.message||'Connection unavailable');setContactNotice('Friend request sent. You can also continue the introduction conversation.');}catch(e){setContactNotice(e.message);}finally{setContactBusy(false);}};
 const change=(key,value)=>setFilters(old=>({...old,[key]:value}));
 const reset=()=>{const next=mode==='discovery'?local:emptyFilters;setFilters(next);void search(next);};
 return <section className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{mode==='discovery'?'Discovery':mode==='search'?'Search':'Favorites'}</h2><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{mode==='favorites'?'People you saved from Discovery.':mode==='search'?'Find people in any city and filter by professional role.':local.city?'Discover people in '+local.city+' and change the filters to explore elsewhere.':'Set your city in My Profile to start locally, or choose a city below.'}</p></div>{approved&&<button type="button" className="ccx-secondary rounded-lg p-3" disabled={working} aria-label="Refresh profiles" onClick={()=>void search(applied)}><RefreshCw size={17}/></button>}</header>
  {!approved?<div className={panel}>Independent age verification is required before viewing profiles.</div>:<>
   {mode!=='favorites'&&<DiscoveryCategoryGrid
    value={DISCOVERY_CATEGORIES.find(item=>item.role===applied.role&&applied.role)?.key||''}
    onSelect={item=>{if(item.destination==='hosting'){onNavigate?.('hosting');return;}const next={...applied,role:item.role};setFilters(next);void search(next);}}/>}
   {mode!=='favorites'&&<form className={panel+' space-y-4'} data-discovery-filters="true" onSubmit={e=>{e.preventDefault();void search(filters);setFiltersOpen(false);}}>
    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left" aria-controls="ccx-discovery-filter-fields" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}>
     <span className="flex items-center gap-2"><SlidersHorizontal size={17}/><span className="font-semibold">Discovery filters</span></span>
     {filtersOpen?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
    </button>
    {filtersOpen&&<div id="ccx-discovery-filter-fields" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm">Name<input className={input+' mt-2'} value={filters.query} onChange={e=>change('query',e.target.value)} placeholder="Display name"/></label>
    <label className="text-sm">Professional role<select className={input+' mt-2'} value={filters.role} onChange={e=>change('role',e.target.value)}><option value="">All roles</option>{roleOptions.filter(([key])=>!['host','chef','spa_provider'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <div className="md:col-span-3">
     <GeoLocationSelect idPrefix="ccx-professional-discovery" allowAny compact value={{
      ...EMPTY_GEO,country:filters.country,state:filters.state,city:filters.city
     }} onChange={location=>setFilters(old=>({...old,country:location.country,
      state:location.state,city:location.city}))}/>
    </div>
    <label className="text-sm">Content type (opt-in profiles)<select className={input+' mt-2'} value={filters.category} onChange={e=>change('category',e.target.value)}><option value="">All categories</option>{contentCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {mode!=='favorites'&&<label className="text-sm">Gender identity (opt-in profiles)<select className={input+' mt-2'} value={filters.gender} onChange={e=>setFilters(old=>({...old,gender:e.target.value,min_penis_inches:'',max_penis_inches:'',circumcision:'',breast_size:''}))}><option value="">All / not specified</option>{genderOptions.filter(([key])=>key&&key!=='self_describe').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
    <label className="text-sm">Sexual orientation<select className={input+' mt-2'} value={filters.orientation} onChange={e=>change('orientation',e.target.value)}><option value="">Any orientation</option>{orientationOptions.filter(([key])=>['straight','gay','lesbian','bisexual','pansexual','queer','asexual','questioning'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm">Ethnicity (self-described)<select className={input+' mt-2'} value={filters.ethnicity} onChange={e=>change('ethnicity',e.target.value)}><option value="">Any ethnicity</option>{[['black','Black'],['white','White'],['asian','Asian'],['hispanic_latino','Hispanic / Latino'],['middle_eastern','Middle Eastern / North African'],['native_indigenous','Native / Indigenous'],['mixed','Mixed'],['other','Other self-description']].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3">
     {[[ 'min_age','Age from',18,100],['max_age','Age to',18,100]].map(([key,label,min,max])=><label key={key} className="text-sm">{label}<input type="number" min={min} max={max} step="1" className={input+' mt-2'} value={filters[key]} onChange={e=>change(key,e.target.value)}/></label>)}
    </div>
    <div className="grid grid-cols-2 gap-3">
     {[['min_height_cm','Height from (cm)',100,250],['max_height_cm','Height to (cm)',100,250]].map(([key,label,min,max])=><label key={key} className="text-sm">{label}<input type="number" min={min} max={max} step="1" className={input+' mt-2'} value={filters[key]} onChange={e=>change(key,e.target.value)}/></label>)}
    </div>
    <div className="grid grid-cols-2 gap-3">
     {[['min_weight_kg','Weight from (kg)',25,350],['max_weight_kg','Weight to (kg)',25,350]].map(([key,label,min,max])=><label key={key} className="text-sm">{label}<input type="number" min={min} max={max} step="1" className={input+' mt-2'} value={filters[key]} onChange={e=>change(key,e.target.value)}/></label>)}
    </div>
    {['man','trans_woman'].includes(filters.gender)&&<>
     <div className="grid grid-cols-2 gap-3">
      {[['min_penis_inches','Penis length from (in)'],['max_penis_inches','Penis length to (in)']].map(([key,label])=><label key={key} className="text-sm">{label}<input type="number" min="1" max="16" step="0.5" className={input+' mt-2'} value={filters[key]} onChange={e=>change(key,e.target.value)}/></label>)}
     </div>
     <label className="text-sm">Circumcision<select className={input+' mt-2'} value={filters.circumcision} onChange={e=>change('circumcision',e.target.value)}><option value="">Any / not specified</option><option value="circumcised">Circumcised</option><option value="uncircumcised">Uncircumcised</option></select></label>
    </>}
    {filters.gender==='woman'&&<label className="text-sm">Breast size (self-reported)<select className={input+' mt-2'} value={filters.breast_size} onChange={e=>change('breast_size',e.target.value)}><option value="">Any / not specified</option>{['AA','A','B','C','D','DD','DDD','E','F','G','H','I','J','K+'].map(size=><option key={size} value={size}>{size}</option>)}</select></label>}
    <p className="text-xs text-[var(--cc-text-secondary)] sm:col-span-2 lg:col-span-3">Sensitive filters search only details members explicitly choose to share with other verified members. Age is self-reported profile age, not the identity document's date of birth. Leave location fields blank to search broadly, or specify country, state or city individually.</p>

   </div><div className="flex flex-wrap gap-2"><button className="ccx-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5" disabled={working}><Search size={17}/>{working?'Searching…':'Search people'}</button><button type="button" className="ccx-secondary rounded-lg px-4 py-2.5" onClick={reset} disabled={working}>{mode==='discovery'?'Reset to my city':'Reset filters'}</button></div></div>}</form>}
   {!paid&&mode!=='favorites'&&<p className="text-sm text-[var(--cc-text-secondary)]">Free members can browse and save profiles worldwide. Existing local contact limits and membership requirements still apply.</p>}
   {error&&<p role="alert" className={panel+' text-red-800'}>{error}</p>}{favoriteError&&<p role="alert" className={panel+' text-red-800'}>Favorites could not be updated: {favoriteError}</p>}
   {working&&<p role="status" className="text-sm text-[var(--cc-text-secondary)]">Loading profiles…</p>}
   {searched&&!results.length&&!working&&!error&&<div className={panel+' text-sm text-[var(--cc-text-secondary)]'}>{mode==='favorites'?'No saved profiles are available. Use the heart on a Discovery card.':'No matching profiles found. Try a different city or broader filters.'}</div>}
   <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">{results.map(p=><MemberDiscoveryCard key={p.id} person={p} saved={saved.includes(p.id)} busy={favoriteBusy.includes(p.id)} canFavorite={p.id!==user.id} onFavorite={()=>void toggle(p.id)} onClick={()=>openProfile(p)}/>)}</div>
   {mode==='discovery'&&paid&&<AIMatchSuggestions/>}
   <SponsorshipSlot placement="feed"/>
   {more&&<button type="button" className="ccx-primary rounded-xl px-5 py-3" disabled={working} onClick={()=>void search(applied,true)}>Load more</button>}
   {selected&&<div role="dialog" aria-modal="true" aria-label="Public professional profile" className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={()=>setSelected(null)}><section className={'ccx-surface max-h-[85dvh] w-full space-y-4 overflow-y-auto p-6 '+(selectedTab==='about'?'max-w-lg':'max-w-5xl')} onClick={e=>e.stopPropagation()}>
    <header className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{selected.display_name}</h3><p className="mt-1 text-sm text-[var(--cc-link)]">{roleNames[selected.role_type]||selected.role_type}</p></div><button type="button" className="p-2" aria-label="Close profile" onClick={()=>setSelected(null)}><X size={20}/></button></header>
    <nav className="flex flex-wrap gap-2 border-b border-[var(--cc-border)] pb-2" role="tablist" aria-label="Member profile sections">
     {[['about','About me'],['photos','Photos'],['videos','Videos']].map(([key,label])=><button type="button" key={key}
      role="tab" aria-selected={selectedTab===key} onClick={()=>setSelectedTab(key)}
      className={'rounded-lg px-4 py-2 text-sm font-semibold '+(selectedTab===key?'bg-[#12698f] text-white':'ccx-secondary')}>{label}</button>)}
    </nav>
    {selectedTab==='about'&&<>
    <p className="text-sm text-[var(--cc-text-secondary)]">{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>{selected.sexual_orientation&&<p className="text-sm capitalize text-[var(--cc-text-secondary)]">Orientation: {selected.sexual_orientation}</p>}{selected.bio&&<p className="whitespace-pre-wrap text-sm">{selected.bio}</p>}
    {representativeProfiles.length>0&&<section className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3"><h4 className="mb-2 text-sm font-semibold">Active professional representation</h4><ul className="space-y-1">{representativeProfiles.map(person=><li key={person.id} className="text-sm">{person.display_name} <span className="text-xs capitalize text-[var(--cc-text-secondary)]">· {person.role_type.replaceAll('_',' ')}</span></li>)}</ul></section>}
    {paid?<div className="space-y-2"><h4 className="text-sm font-semibold">Shared professional links</h4>{Object.entries(socials).filter(([,url])=>validateWorkLink(url)).map(([provider,url])=><a key={provider} href={String(url)} target="_blank" rel="noopener noreferrer" className="ccx-secondary mr-2 inline-flex rounded-lg px-3 py-2 text-sm capitalize">{provider==='twitter'?'X / Twitter':provider}</a>)}</div>:null}
    {selected.id!==user.id&&<IntroThread peerId={selected.id} userId={user.id}/>}
    {selected.id!==user.id&&<TravelCalendar userId={selected.id} viewerId={user.id}/>}
    {contactNotice&&<p role="status" className="rounded-lg border border-[var(--cc-border)] p-3 text-sm">{contactNotice}</p>}
    <button type="button" disabled={contactBusy||selected.id===user.id} className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={connect}>{contactBusy?'Checking eligibility…':paid?'Request connection':'Request local connection'}</button>
    {paid&&selected.id!==user.id&&<div className="space-y-2">
      {inviteEligibility?.member_id===selected.id&&inviteEligibility.eligible?<button type="button" className="ccx-primary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('collaborations',{targetUserId:selected.id})}>Create collaboration</button>:<p className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-xs text-[var(--cc-text-secondary)]">{inviteEligibility?.member_id===selected.id?inviteEligibility.reason:'Checking collaboration eligibility…'}</p>}
      {(selected.role_type==='agent'||selected.role_type==='studio')&&<button type="button" className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('roster',{targetUserId:selected.id})}>Request representation</button>}
      {['agent','studio'].includes(workspace.profile?.role_type)&&['creator','photographer','videographer','video_editor'].includes(selected.role_type)&&<button type="button" className="ccx-secondary w-full rounded-xl px-4 py-2.5" onClick={()=>onNavigate?.('roster',{targetUserId:selected.id})}>Offer representation</button>}
    </div>}
    <button type="button" className="ccx-primary w-full rounded-xl px-4 py-2.5" disabled={favoriteBusy.includes(selected.id)} onClick={()=>void toggle(selected.id)}>{saved.includes(selected.id)?'Remove from favorites':'Add to favorites'}</button>
    <button type="button" className="text-sm text-[var(--cc-link)] underline" onClick={()=>onNavigate?.('connections')}>View connection requests</button>
    <section className="mt-4 space-y-3" aria-label="Member's shared posts"><h4 className="font-semibold">Profile posts</h4><ConnectFeed key={selected.id} profileId={selected.id} userId={user.id} paid={paid}/></section>
    </>}
    {selectedTab!=='about'&&<ProfileGallery ownerId={selected.id} viewerId={user.id} paid={paid} mode={selectedTab} onNavigate={onNavigate}/>}
   </section></div>}
  </>}
 </section>;
}
