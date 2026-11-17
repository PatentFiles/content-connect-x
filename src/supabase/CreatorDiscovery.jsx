/**
 * Discovery, Advanced Search and Creator Favorites are distinct destinations.
 * All directory results are vetted on the server; favorites are owner-only.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Heart,Search,SlidersHorizontal,MapPin,ShieldCheck,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {countries,regionOptions,contentCategories,genderOptions,roleOptions} from './profileOptions';

const input='w-full rounded-xl bg-[#0F1520] border border-[#34445D] px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const panel='ccx-surface p-5';
const initialFilters={query:'',role:'',country:'',state:'',city:'',category:'',gender:''};
const roleName=Object.fromEntries(roleOptions);
const categoryName=Object.fromEntries(contentCategories);
const genderName=Object.fromEntries(genderOptions);

export default function CreatorDiscovery({user,approved,paid,mode='discovery',onNavigate}){
 const [filters,setFilters]=useState(initialFilters);
 const [results,setResults]=useState([]);
 const [saved,setSaved]=useState([]);
 const [searched,setSearched]=useState(false);
 const [offset,setOffset]=useState(0);
 const [more,setMore]=useState(false);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState(null);
 const [socials,setSocials]=useState({}),[contactNotice,setContactNotice]=useState('');
 const [contactBusy,setContactBusy]=useState(false);
 const connect=async()=>{
  if(!selected)return;
  setContactBusy(true);setContactNotice('');setError('');
  try{
   const {data,error:requestError}=await supabase.functions.invoke('member-workflows',{
    body:{action:'request_connection',target_user_id:selected.id}
   });
   if(requestError||data?.error)throw Error(data?.error||requestError?.message||'Connection unavailable');
   setContactNotice('Request sent. You can message once your connection is accepted.');
  }catch(e){setContactNotice(e.message||'Unable to request a connection.');}
  finally{setContactBusy(false);}
 };
 const openProfile=person=>{
  setSelected(person);setSocials({});setContactNotice('');
  if(paid)void supabase.functions.invoke('member-workflows',{
   body:{action:'view_social_links',target_user_id:person.id}
  }).then(({data,error})=>{if(!error)setSocials(data?.socials||{});}).catch(()=>{});
  // Only an actual opened profile counts, once per verified viewer per UTC day.
  // Tracking is best effort and never blocks the visitor's profile view.
  if(person.id!==user.id)void supabase.functions.invoke('profile-analytics',{
   body:{action:'record',profile_owner_id:person.id}
  }).catch(()=>{});
 };
 const change=(key,value)=>setFilters(old=>({...old,[key]:value}));
 const loadSaved=useCallback(async()=>{
  const {data,error:readError}=await supabase.from('creator_favorites')
    .select('creator_id').eq('user_id',user.id).order('created_at',{ascending:false});
  if(readError)throw readError;
  const ids=(data||[]).map(v=>v.creator_id);
  setSaved(ids);return ids;
 },[user.id]);
 const queryDirectory=useCallback(async(nextFilters,loadMore=false,ids=null)=>{
  const nextOffset=loadMore?offset:0;
  const {data,error:directoryError}=await supabase.functions.invoke('directory',{
   body:{...nextFilters,offset:nextOffset,...(ids?{ids}:{})}
  });
  if(directoryError||data?.error)throw Error(data?.error||directoryError?.message||'Directory unavailable');
  const list=data?.results||[];
  setResults(prev=>loadMore?[...prev,...list]:list);
  setSearched(true);setOffset(nextOffset+list.length);setMore(data?.has_more===true);
 },[offset]);
 const search=useCallback(async(nextFilters=filters,loadMore=false)=>{
  if(!approved)return;
  setWorking(true);setError('');
  try{
   const ids=mode==='favorites'?await loadSaved():null;
   if(ids&&!ids.length){setResults([]);setMore(false);setSearched(true);return;}
   await queryDirectory(nextFilters,loadMore,ids);
  }catch(e){setError(e.message);}finally{setWorking(false);}
 },[approved,filters,loadSaved,mode,queryDirectory]);
 useEffect(()=>{
  let live=true;
  if(!approved)return;
  (async()=>{
   try{
    const ids=await loadSaved();if(!live)return;
    if(mode==='favorites'){
     if(!ids.length){setResults([]);setSearched(true);return;}
     await queryDirectory(initialFilters,false,ids);
    }else if(mode==='discovery')await queryDirectory(initialFilters);
   }catch(e){if(live)setError(e.message);}
  })();
  return()=>{live=false;};
 // Only refresh on mode/account change; editing input must not refetch automatically.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode,approved,user.id]);
 const toggle=async(id)=>{
  setError('');
  try{
   if(saved.includes(id)){
    const {error:removeError}=await supabase.from('creator_favorites').delete()
     .eq('user_id',user.id).eq('creator_id',id);
    if(removeError)throw removeError;
    setSaved(prev=>prev.filter(v=>v!==id));
    if(mode==='favorites')setResults(prev=>prev.filter(v=>v.id!==id));
   }else{
    const {error:insertError}=await supabase.from('creator_favorites')
     .insert({user_id:user.id,creator_id:id});
    if(insertError)throw insertError;
    setSaved(prev=>[id,...prev]);
   }
  }catch(e){setError(e.message);}
 };
 const title={discovery:'Discovery',search:'Advanced creator search',favorites:'My creator favorites'}[mode];
 return <section className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-2xl font-semibold text-white">{title}</h2>
    <p className="mt-1 text-sm text-[#A9BCD1]">
     {mode==='favorites'?'Profiles you saved for future collaborations.':
      mode==='search'?'Search by role, general location and opt-in creative preferences.':
      'Browse verified creators, photographers, videographers and production partners.'}</p></div>
   {approved&&<button type="button" aria-label="Refresh profiles" className="ccx-secondary rounded-lg p-3"
    onClick={()=>void search(initialFilters)} disabled={working}><RefreshCw size={17}/></button>}
  </div>
  {!approved?<div className={panel}>Independent age verification is required before viewing members and favorites.</div>:<>
   {mode!=='favorites'&&<form className={panel+' space-y-4'} onSubmit={e=>{e.preventDefault();void search(filters);}}>
    <div className="flex items-center gap-2"><SlidersHorizontal size={17}/><h3 className="font-semibold">Search filters</h3></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     <label className="text-sm">Name<input className={input+' mt-2'} value={filters.query}
       onChange={e=>change('query',e.target.value)} placeholder="Display name"/></label>
     <label className="text-sm">Professional type<select className={input+' mt-2'} value={filters.role}
       onChange={e=>change('role',e.target.value)}><option value="">All roles</option>
       {roleOptions.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
     <label className="text-sm">Country<select className={input+' mt-2'} value={filters.country}
       onChange={e=>setFilters(v=>({...v,country:e.target.value,state:'',city:''}))}>
       <option value="">All countries</option>{countries.map(c=><option key={c.code} value={c.name}>{c.name}</option>)}</select></label>
     <label className="text-sm">State / region
      {regionOptions[countries.find(c=>c.name===filters.country)?.code]?
       <select className={input+' mt-2'} value={filters.state}
        onChange={e=>change('state',e.target.value)}><option value="">All regions</option>
        {regionOptions[countries.find(c=>c.name===filters.country)?.code].map(s=><option key={s}>{s}</option>)}
       </select>:<input className={input+' mt-2'} value={filters.state}
        onChange={e=>change('state',e.target.value)} placeholder="Any region"/>}</label>
     <label className="text-sm">City<input className={input+' mt-2'} value={filters.city}
       onChange={e=>change('city',e.target.value)} placeholder="Any city"/></label>
     <label className="text-sm">Content type (opt-in profiles)<select className={input+' mt-2'}
       value={filters.category} onChange={e=>change('category',e.target.value)}>
       <option value="">All categories</option>
       {contentCategories.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
     {mode==='search'&&<label className="text-sm">Gender identity (opt-in profiles)
       <select className={input+' mt-2'} value={filters.gender} onChange={e=>change('gender',e.target.value)}>
       <option value="">All / not specified</option>{genderOptions.filter(([key])=>key&&key!=='self_describe')
        .map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>}
    </div>
    <div className="flex flex-wrap gap-2">
     <button className="ccx-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5"
      type="submit" disabled={working}><Search size={17}/>{working?'Searching…':'Search creators'}</button>
     <button type="button" className="ccx-secondary rounded-lg px-4 py-2.5"
      onClick={()=>{setFilters(initialFilters);void search(initialFilters);}}>Reset filters</button>
    </div>
   </form>}
   {!paid&&mode!=='favorites'&&<p className="text-sm text-[#AABBD4]">Free members may discover and save profiles worldwide. Local connections are limited to 25 miles and five different people per rolling seven days. Premium removes those contact restrictions.</p>}
   {error&&<p role="alert" className={panel+' text-red-300'}>{error}</p>}
   {working&&<p role="status" className="text-sm text-[#AABBD4]">Loading verified profiles…</p>}
   {searched&&results.length===0&&!working&&<div className={panel+' text-sm text-[#AABBD4]'}>
     {mode==='favorites'?'No saved creators are available. Save profiles from Discovery to see them here.':
     'No matching profiles found. Try a broader search.'}</div>}
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {results.map(p=><article key={p.id} className={panel+' flex flex-col gap-3'}>
     <div className="flex items-start justify-between gap-3">
      <div><p className="text-lg font-semibold">{p.display_name}</p>
       <p className="mt-1 text-sm text-[#FF8AD8]">{roleName[p.role_type]||p.role_type}</p></div>
      <button className="rounded-full border border-[#6E416D] p-2.5" type="button"
       title={saved.includes(p.id)?'Remove creator from favorites':'Save creator'}
       aria-label={saved.includes(p.id)?'Remove favorite':'Add favorite'} onClick={()=>void toggle(p.id)}>
       <Heart size={19} fill={saved.includes(p.id)?'currentColor':'none'}
        className={saved.includes(p.id)?'text-[#FF81D4]':'text-white'}/></button>
     </div>
     <p className="flex items-center gap-2 text-sm text-[#B2C0D5]"><MapPin size={15}/>
      {[p.city,p.state,p.country].filter(Boolean).join(', ')||'Location not provided'}</p>
     <p className="flex items-center gap-2 text-xs text-emerald-200"><ShieldCheck size={14}/>Independently age verified</p>
     {p.gender_identity&&<p className="text-sm">Identity: {genderName[p.gender_identity]||'Self-described'}</p>}
     {p.content_categories?.length>0&&<div className="flex flex-wrap gap-1.5">
      {p.content_categories.map(c=><span key={c} className="rounded-full border border-[#675078] px-2 py-1 text-xs text-[#E4C9EA]">{categoryName[c]||c}</span>)}
     </div>}
     {p.bio&&<p className="text-sm text-[#C4D1E5] line-clamp-3">{p.bio}</p>}
     <button type="button" className="mt-auto self-start text-sm font-medium text-[#FF8DD9] underline"
      onClick={()=>openProfile(p)}>View public profile</button>
    </article>)}
   </div>
   {more&&<button className="ccx-primary rounded-lg px-5 py-3" type="button" disabled={working}
    onClick={()=>void search(filters,true)}>{working?'Loading…':'Load more'}</button>}
   {selected&&<div role="dialog" aria-modal="true" aria-label="Creator public profile"
    className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={()=>setSelected(null)}>
    <div className="ccx-surface w-full max-w-lg space-y-4 p-6" onClick={e=>e.stopPropagation()}>
     <div className="flex justify-between gap-3"><div><h3 className="text-xl font-semibold">{selected.display_name}</h3>
      <p className="text-sm text-[#FF8DD9]">{roleName[selected.role_type]}</p></div>
      <button className="text-2xl" onClick={()=>setSelected(null)} aria-label="Close">×</button></div>
     <p className="text-sm text-[#B3C3D9]">{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>
     {selected.bio&&<p className="whitespace-pre-wrap text-sm">{selected.bio}</p>}
     {paid?<div className="space-y-2">
       <h4 className="text-sm font-semibold">Professional social links</h4>
       {Object.entries(socials).length?
        <div className="flex flex-wrap gap-2">{Object.entries(socials).map(([provider,url])=>
         <a key={provider} href={url} target="_blank" rel="noopener noreferrer"
          className="ccx-secondary rounded-lg px-3 py-2 text-xs capitalize">{provider==='twitter'?'X / Twitter':provider}</a>)}</div>:
        <p className="text-xs text-[#AABBD4]">No professional links have been shared with premium members.</p>}
      </div>:
      <p className="text-xs text-[#AABBD4]">External social links are private on the free plan. Upgrade to Premium to view links the creator chooses to share.</p>}
     <p className="text-sm text-[#AABBD4]">Saving a profile does not send a message, invitation or booking request.</p>
     {contactNotice&&<p role="status" className="rounded-lg border border-[#34445D] p-3 text-xs text-[#C6D5EB]">{contactNotice}</p>}
     <button type="button" onClick={connect} disabled={contactBusy||selected.id===user.id}
      className="ccx-secondary w-full rounded-lg px-4 py-2.5 text-sm">
      {contactBusy?'Checking eligibility…':paid?'Request professional connection':'Request local connection (25 miles)'}</button>
     <button type="button" className="text-xs text-[#FF8DD9] underline" onClick={()=>onNavigate?.('connections')}>View connection requests</button>
     <button type="button" className="ccx-primary rounded-lg px-4 py-2.5"
      onClick={()=>{void toggle(selected.id);setSelected(null);}}>
      {saved.includes(selected.id)?'Remove from favorites':'Save to favorites'}</button>
    </div></div>}
  </>}
 </section>;
}
