import './marketing-layout.css';
import {isDemoActive} from '../demo/demoRuntime.mjs';
/** Production-space discovery UI — shared between Host ConnectX and CCX.
 * Reference-locked to a photo-first two-column browsing pattern (Refero:
 * Airbnb discovery + Tripadvisor map), using ORIGINAL Host ConnectX blue.
 * No exact private addresses are fetched or sent to the map.
 */
import React,{useEffect,useMemo,useState} from 'react';
import {Search,SlidersHorizontal,Map,MapPin,Users,Home,Building2,Warehouse,Camera,Clapperboard,TreePine,Hotel,Landmark,ChevronRight,X,Tag} from 'lucide-react';
import HostRoadMap from './HostRoadMap';
import {VENUE_ARTWORK} from './hostMapPresentation.mjs';
import GeoLocationSelect,{EMPTY_GEO} from './GeoLocationSelect';
import HostVenueCategoryRail from './HostVenueCategoryRail';
import {HOST_VENUE_CATEGORIES,venueMatchesTypes,venueArtworkFor} from './hostVenueCategories.mjs';
const icons={house:Home,condo:Building2,warehouse:Warehouse,film_studio:Clapperboard,
 photo_studio:Camera,dungeon:Landmark,outdoor:TreePine,private_beach:TreePine,
 pool:MapPin,resort:Hotel,villa:Home,loft:Building2,hotel:Hotel,other:MapPin};
const kinds=HOST_VENUE_CATEGORIES.map(({id,label,image})=>({id,label,image,Icon:icons[id]||MapPin}));
import {amenityGroups,accessibility,matchesPropertyFeatures} from '../../supabase/functions/_shared/propertyFeatureCatalog.mjs';
export {amenityGroups,accessibility};
const crewRoles=[
 ['creators','Creators / performers'],['videographers','Videographers'],['photographers','Photographers'],
 ['agents','Agents / managers'],['production_staff','Production crew'],['makeup','Makeup & hair'],['other','Other guests']
];
const panel='rounded-2xl border border-[#e1e9ef] bg-white shadow-sm';
const input='w-full min-h-[44px] rounded-xl border border-[#d5e2e9] bg-white px-3 py-2.5 text-sm text-[#193246]';
const secondary='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#d5e2e9] bg-white px-4 py-2 text-sm font-semibold text-[#1a3c50] hover:border-[#12698f]';
const primary='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#12698f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c5272] disabled:opacity-40';
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((Number(cents)||0)/100);
const DEFAULT_FILTERS={types:[],minPrice:'',maxPrice:'',amenities:[],access:[],language:'',use:''};
function FilterModal({value,onChange,onClose,onApply,matching}){
 const [local,setLocal]=useState({...value,types:[...value.types],amenities:[...value.amenities],access:[...value.access]});
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',onKey);const prev=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=prev;};
 },[onClose]);
 const toggle=(key,id)=>setLocal(f=>({...f,[key]:f[key].includes(id)?f[key].filter(x=>x!==id):[...f[key],id]}));
 const count=local.types.length+local.amenities.length+local.access.length+Number(Boolean(local.language))+Number(Boolean(local.use))+Number(local.minPrice!=='')+Number(local.maxPrice!=='');
 return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061622a8] p-3 backdrop-blur-[2px]" role="presentation" onClick={onClose}>
  <section className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] bg-white text-[#193246] shadow-2xl"
   role="dialog" aria-modal="true" aria-label="Filter production venues" onClick={e=>e.stopPropagation()}>
   <div className="flex items-center justify-between border-b border-[#e2e8ed] px-6 py-5">
    <h2 className="text-lg font-extrabold">Filters</h2><button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f1f5f7]" onClick={onClose} aria-label="Close filters"><X size={20}/></button>
   </div>
   <div className="space-y-6 overflow-y-auto p-6">
    <section className="space-y-3"><h3 className="font-semibold">Type of production space</h3>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{kinds.map(({id,label,image,Icon})=><button type="button" key={id} aria-pressed={local.types.includes(id)}
      onClick={()=>toggle('types',id)} className={'flex min-h-[72px] items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm '+(local.types.includes(id)?'border-[#12698f] bg-[#e9f5fc]':'border-[#dbe6ec]')}>
      {image?<img src={image} alt="" loading="lazy" decoding="async"
       className="h-11 w-11 shrink-0 object-contain" />:<Icon size={21} className="shrink-0 text-[#12698f]"/>}
      <span>{label}</span></button>)}</div>
    </section>
    <section className="border-t border-[#e2e8ed] pt-5"><h3 className="font-semibold">Price range</h3>
     <p className="mt-1 text-xs text-[#627789]">One-day estimate including the listed cleaning fee. Taxes and payment-provider fees are not yet available.</p>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-xs">Minimum (USD)<input type="number" min="0" className={input+' mt-1'} value={local.minPrice} onChange={e=>setLocal(f=>({...f,minPrice:e.target.value}))} placeholder="No minimum"/></label>
      <label className="text-xs">Maximum (USD)<input type="number" min="0" className={input+' mt-1'} value={local.maxPrice} onChange={e=>setLocal(f=>({...f,maxPrice:e.target.value}))} placeholder="No maximum"/></label>
     </div>
    </section>
    {amenityGroups.map(group=><section key={group.title} className="border-t border-[#e2e8ed] pt-5">
     <h3 className="mb-3 font-semibold">{group.title}</h3>
     <div className="grid gap-3 sm:grid-cols-2">{group.items.map(([id,label])=><label key={id} className="flex min-h-[44px] items-center gap-3 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-[#12698f]" checked={local.amenities.includes(id)} onChange={()=>toggle('amenities',id)}/>{label}
     </label>)}</div>
    </section>)}
    <section className="border-t border-[#e2e8ed] pt-5"><h3 className="mb-3 font-semibold">Accessibility</h3>
     <div className="grid gap-3 sm:grid-cols-2">{accessibility.map(([id,label])=><label key={id} className="flex min-h-[44px] items-center gap-3 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-[#12698f]" checked={local.access.includes(id)} onChange={()=>toggle('access',id)}/>{label}</label>)}</div>
    </section>
    <section className="grid gap-4 border-t border-[#e2e8ed] pt-5 sm:grid-cols-2">
     <label className="text-sm">Permitted production
      <select className={input+' mt-2'} value={local.use} onChange={e=>setLocal(f=>({...f,use:e.target.value}))}>
       <option value="">Any permitted shoot</option><option value="photography">Photography</option>
       <option value="filming">Filming</option><option value="nude_photography">Nude photography</option>
       <option value="explicit_adult_video">Explicit adult production</option><option value="music_video">Music video</option>
      </select>
     </label>
     <label className="text-sm">Host language
      <select className={input+' mt-2'} value={local.language} onChange={e=>setLocal(f=>({...f,language:e.target.value}))}>
       <option value="">Any language</option><option value="en">English</option><option value="es">Spanish</option>
       <option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option>
      </select>
     </label>
    </section>

   </div>
   <div className="flex items-center justify-between border-t border-[#e2e8ed] px-6 py-5">
    <button type="button" className="text-sm font-semibold underline" onClick={()=>setLocal({...DEFAULT_FILTERS})}>Clear all</button>
    <button type="button" className={primary} onClick={()=>{onChange(local);onApply(local);onClose();}}>Show matching spaces{count?' · '+count+' filters':''}</button>
   </div>
  </section>
 </div>;
}
export default function MarketplaceExplore({items=[],busy=false,onSearch=(_filters)=>{void _filters;},onOpen=(_id)=>{void _id;},onBecomeHost=()=>{},site='host',initialCategory='',demo=isDemoActive(),embedded=site==='ccx'}){
 const [geo,setGeo]=useState({...EMPTY_GEO});
 const [keyword,setKeyword]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [crew,setCrew]=useState(Object.fromEntries(crewRoles.map(([key])=>[key,0])));
 const [crewOpen,setCrewOpen]=useState(false),[filterOpen,setFilterOpen]=useState(false),[filters,setFilters]=useState(()=>({...DEFAULT_FILTERS,types:initialCategory?[initialCategory]:[]}));
 const [showMap,setShowMap]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(min-width:1024px)').matches),[rateUnit,setRateUnit]=useState('day');
 const [searchOpen,setSearchOpen]=useState(false);
 const applied=React.useRef({});
 const count=Object.values(crew).reduce((sum,n)=>sum+Number(n||0),0);
 const displayed=useMemo(()=>items.filter(p=>{
  if(rateUnit==='hour'&&!(Number.isFinite(p.hourly_rate_cents)&&p.hourly_rate_cents>0))return false;
  if(!venueMatchesTypes(p,filters.types))return false;
  const one=(Number(p.one_day_including_cleaning_cents)||Number(p.daily_rate_cents)+Number(p.cleaning_fee_cents))/100;
  const quoted=Number.isFinite(p.stay_total_cents)?p.stay_total_cents/100:one;
  if(filters.minPrice!==''&&quoted<Number(filters.minPrice))return false;
  if(filters.maxPrice!==''&&quoted>Number(filters.maxPrice))return false;
  if(!matchesPropertyFeatures(p,filters.amenities,filters.access))return false;
  if(filters.language&&!p.host_languages?.includes(filters.language))return false;
  if(filters.use&&!p.permitted_uses?.includes(filters.use))return false;
  if(count>0&&(p.capacity||0)<count)return false;
  return true;
 }),[items,filters,count,rateUnit]);
 const apply=(nextFilters=filters)=>{const params={
  query:keyword,country:geo.country,state:geo.state,city:geo.city,
  categories:nextFilters.types,
    ...(from&&to?{start_date:from,end_date:to}:{}),
  ...(count>0?{crew_size:count}:{}),
  ...(nextFilters.amenities.length?{amenities:nextFilters.amenities}:{}),
  ...(nextFilters.access.length?{accessibility:nextFilters.access}:{}),
  ...(nextFilters.use?{requested_use:nextFilters.use}:{}),
  ...(nextFilters.language?{host_language:nextFilters.language}:{}),
  ...(nextFilters.minPrice!==''?{min_price:Number(nextFilters.minPrice)}:{}),
  ...(nextFilters.maxPrice!==''?{max_price:Number(nextFilters.maxPrice)}:{})
 };applied.current=params;onSearch(params);};
 const mapSearch=bounds=>onSearch({...applied.current,bounds});
 useEffect(()=>{
  if(initialCategory)onSearch({categories:[initialCategory]});
 // Category is set by a user selecting an exact venue from the homepage.
 },[initialCategory]);
 const data=displayed;
 return <div className="space-y-5 text-[#193246]" data-host-discovery="true">
  {!embedded&&<div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#12698f]">Host ConnectX</p>
    <h2 className="mt-1 text-2xl font-bold">Find your next production location</h2>
    <p className="mt-1 text-sm text-[#61778a]">{demo?'Los Angeles production locations · fictional demonstration catalog.':'Browse approved spaces without signing in. Booking requires a verified account.'}</p></div>
   {!demo&&<button type="button" className={secondary} onClick={onBecomeHost}><Home size={16}/> Become a host</button>}
  </div>}
  <HostVenueCategoryRail selectedTypes={filters.types} onChangeTypes={types=>{const next={...filters,types};setFilters(next);apply(next);}}/>
   <button type="button" className="venue-search-summary lg:hidden" aria-expanded={searchOpen} aria-controls={'venue-search-'+site} onClick={()=>setSearchOpen(v=>!v)}><span className="flex items-center justify-between gap-3"><strong className="flex items-center gap-2 text-sm"><Search size={18}/>Search locations, dates &amp; crew</strong><ChevronRight size={18} className={searchOpen?'rotate-90':''}/></span><span className="mt-1 block text-xs text-[#627789]">{geo.city||geo.state||geo.country||'Choose location'} · {from?(from+(to?' to '+to:'')):'Choose dates'} · {count?count+' crew':'Add crew'}</span></button>
   <form id={'venue-search-'+site} className={panel+' venue-search-card relative gap-3 lg:grid-cols-[2.4fr_1fr_1fr_1.2fr_auto] lg:items-end '+(searchOpen?'grid':'hidden lg:grid')} onSubmit={e=>{e.preventDefault();apply();setSearchOpen(false);}}>
    <div className="space-y-2">
     <label className="text-xs font-bold">Where</label>
     <GeoLocationSelect idPrefix={'discovery-'+site} compact allowAny value={geo} onChange={setGeo}/>
    </div>
    <label className="text-xs font-semibold">When — from<input className={input+' mt-2'} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="text-xs font-semibold">To<input className={input+' mt-2'} type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
    <div className="relative">
     <span className="mb-2 block text-xs font-bold">Who</span>
     <button type="button" className={secondary+' w-full justify-between'} onClick={()=>setCrewOpen(v=>!v)} aria-expanded={crewOpen}><Users size={16}/>{count?count+' crew members':'Add crew'}<ChevronRight size={16}/></button>
     {crewOpen&&<div className="absolute right-0 top-full z-20 mt-2 w-[min(340px,90vw)] rounded-2xl border border-[#e0e8ef] bg-white p-4 shadow-xl">
      <h3 className="mb-3 text-sm font-semibold">Production team attending</h3>
      {crewRoles.map(([id,label])=><div key={id} className="flex min-h-12 items-center justify-between border-b border-[#f0f2f5] text-sm">
       <span>{label}</span><div className="flex items-center gap-3">
        <button type="button" aria-label={'Remove '+label} className="grid h-9 w-9 place-items-center rounded-full border"
         disabled={!crew[id]} onClick={()=>setCrew(x=>({...x,[id]:Math.max(0,(x[id]||0)-1)}))}>−</button>
        <span className="w-5 text-center">{crew[id]||0}</span>
        <button type="button" aria-label={'Add '+label} className="grid h-9 w-9 place-items-center rounded-full border"
         disabled={count>=200} onClick={()=>setCrew(x=>({...x,[id]:(x[id]||0)+1}))}>+</button>
       </div></div>)}
      <button type="button" className={primary+' mt-4 w-full'} onClick={()=>setCrewOpen(false)}>Done · {count} attendees</button>
     </div>}
    </div>
    <button type="submit" disabled={busy} className={primary}><Search size={18}/> Search</button>
   </form>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap gap-2">
     <button type="button" className={secondary} onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={16}/> Filters</button>
     <label className="flex items-center gap-2 rounded-full border border-[#d5e2e9] bg-white px-3 text-sm font-semibold">Rate <select className="bg-transparent p-2" value={rateUnit} onChange={e=>setRateUnit(e.target.value)}><option value="day">Daily</option><option value="hour">Hourly</option></select></label>
     <button type="button" className={secondary} aria-pressed={showMap} onClick={()=>setShowMap(x=>!x)}><Map size={16}/>{showMap?'Show properties':'Show map'}</button>
     {filters.amenities.length+filters.access.length>0&&<span className="inline-flex items-center rounded-full bg-[#eaf5fb] px-3 text-xs font-semibold">{filters.amenities.length+filters.access.length} property features</span>}
     {filters.types.length>0&&<span className="inline-flex items-center rounded-full bg-[#eaf5fb] px-3 text-xs font-semibold">{filters.types.length} property types</span>}
    </div>
    <p className="flex items-center gap-2 text-xs text-[#627789]"><Tag size={16} className="text-[#12698f]"/> Rate plus separately displayed cleaning fee</p>
   </div>
   {(from||to)&&<p className="rounded-lg bg-[#f0f6fa] px-4 py-2 text-xs text-[#315267]">
    Selected dates {from||'—'} to {to||'—'}. Search verifies property-local blocked/held dates; submit a booking request to recheck the exact live quote.
   </p>}
   <div className={'venue-results-layout grid min-w-0 gap-5 '+(showMap?'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]':'')} data-map-open={String(showMap)}>
    <section className={"min-w-0 space-y-4 "+(showMap?"hidden lg:block":"")} aria-label="Venue search results">
     <h3 className="font-bold">{data.length} {demo?'sample':'approved'} spaces{geo.city?' in '+geo.city:''}</h3>
     {data.length===0?<div className={panel+' p-8 text-center'}>
      <Search className="mx-auto mb-3 text-[#12698f]" size={35}/>
      <h4 className="font-bold">No matching venues for these filters</h4>
      <p className="mt-2 text-sm text-[#627789]">Try a different city, crew size or venue type. New verified properties appear here automatically.</p>
     </div>:
      <div className={'grid gap-4 '+(showMap?'grid-cols-1':'sm:grid-cols-2 xl:grid-cols-4')}>
       {data.map(p=>
        <button type="button" key={p.id} className={'group overflow-hidden rounded-2xl border border-[#e1e9ef] bg-white text-left transition hover:shadow-md '+(showMap?'grid grid-cols-[minmax(105px,38%)_minmax(0,1fr)] gap-3':'')}
         onClick={()=>onOpen(p.id)}>
         <div className={'venue-card-photo relative overflow-hidden rounded-xl bg-[#eff5f8] '+(showMap?'min-h-[138px] h-full':'aspect-[5/4]')}>
          {p.cover_url?<img src={p.cover_url} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/>:
           <div className="grid h-full w-full place-items-center text-[#12698f]">{venueArtworkFor(p.category,{listingPlaceholder:true})?<img src={venueArtworkFor(p.category,{listingPlaceholder:true})} alt="" loading="lazy" decoding="async" className="h-32 w-32 max-w-[75%] object-contain opacity-75"/>:<Home size={46} strokeWidth={1.5}/>}</div>}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#20394a] shadow-sm"><img src={VENUE_ARTWORK[p.category]||VENUE_ARTWORK.other} alt="" className="mr-1 inline h-5 w-5 object-contain"/>{kinds.find(x=>x.id===p.category)?.label||'Production venue'}</span>
         </div>
         <div className="venue-card-copy min-w-0 space-y-1">
          <h4 className="line-clamp-2 text-sm font-bold">{p.title}</h4>
          <p className="truncate text-xs text-[#627789]">{[p.city,p.state,p.country].filter(Boolean).join(', ')}</p>
          <p className="text-xs text-[#627789]">Up to {p.capacity||'—'} crew · {p.bedrooms||0} bedrooms · {p.bathrooms||0} bathrooms</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><p className="text-sm font-bold">{money(p.daily_rate_cents)} <span className="font-normal text-[#627789]">/ day</span></p>
           {Number.isFinite(p.hourly_rate_cents)&&p.hourly_rate_cents>0&&<p className="text-sm font-bold">{money(p.hourly_rate_cents)} <span className="font-normal text-[#627789]">/ hour · {p.min_rental_hours||1}h min.</span></p>}</div>
          {rateUnit==='hour'&&Number.isFinite(p.hourly_rate_cents)?<p className="text-xs underline">{money(p.hourly_rate_cents*(p.min_rental_hours||1)+(p.cleaning_fee_cents||0))} minimum {p.min_rental_hours||1}h estimate incl. cleaning</p>:Number.isFinite(p.stay_total_cents)&&p.date_availability_checked?<p className="text-xs underline">{money(p.stay_total_cents)} total · {p.stay_days} {p.stay_days===1?'day':'days'} incl. cleaning</p>:<p className="text-xs text-[#627789]">{money(p.one_day_including_cleaning_cents??p.daily_rate_cents+(p.cleaning_fee_cents||0))} one-day estimate incl. cleaning</p>}
         </div>
        </button>)}
      </div>}
    </section>
    {showMap&&<aside className="venue-map-column h-fit" aria-label="Approximate production location map">
     <HostRoadMap properties={data} onOpen={onOpen} onBounds={mapSearch} categorySelected={filters.types.length>0} unit={rateUnit}/>
    </aside>}
   </div>
  {filterOpen&&<FilterModal value={filters} onChange={setFilters} onClose={()=>setFilterOpen(false)} onApply={apply} matching={displayed.length}/>}
 </div>;
}
