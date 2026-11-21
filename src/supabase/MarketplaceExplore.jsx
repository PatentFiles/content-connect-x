/** Production-space discovery UI — shared between Host Connect X and CCX.
 * Reference-locked to a photo-first two-column browsing pattern (Refero:
 * Airbnb discovery + Tripadvisor map), using ORIGINAL Host Connect X blue.
 * No exact private addresses are fetched or sent to the map.
 */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Search,SlidersHorizontal,Map,MapPin,Users,Home,Building2,Warehouse,Camera,Clapperboard,TreePine,Hotel,Landmark,Package,ChevronRight,X,Tag,Video,Scissors,Brush,Mic,Lightbulb,ExternalLink} from 'lucide-react';
import GeoLocationSelect,{EMPTY_GEO} from './GeoLocationSelect';
const kinds=[
 {id:'house',label:'Home',Icon:Home},{id:'condo',label:'Owned condo',Icon:Building2},
 {id:'warehouse',label:'Warehouse',Icon:Warehouse},{id:'film_studio',label:'Film studio',Icon:Clapperboard},
 {id:'photo_studio',label:'Photo studio',Icon:Camera},{id:'dungeon',label:'Specialty set',Icon:Landmark},
 {id:'outdoor',label:'Outdoor',Icon:TreePine},{id:'private_beach',label:'Private beach',Icon:TreePine},
 {id:'hotel',label:'Hotel',Icon:Hotel},{id:'resort',label:'Resort',Icon:Hotel},
 {id:'villa',label:'Villa',Icon:Home},{id:'loft',label:'Loft',Icon:Building2},
 {id:'set',label:'Production set',Icon:Clapperboard},{id:'other',label:'Other venue',Icon:MapPin}
];
export const amenityGroups=[
 {title:'Essentials',items:[['wifi','Wi-Fi'],['kitchen','Kitchen'],['washer','Washer'],['dryer','Dryer'],['air_conditioning','Air conditioning'],['heating','Heating'],['dedicated_workspace','Dedicated workspace'],['tv','TV'],['hair_dryer','Hair dryer'],['iron','Iron']]},
 {title:'Amenities & features',items:[['pool','Swimming pool'],['hot_tub','Hot tub'],['free_parking','Free parking'],['ev_charger','EV charger'],['king_bed','King bed'],['gym','Gym'],['bbq_grill','BBQ grill'],['breakfast','Breakfast'],['indoor_fireplace','Fireplace'],['smoking_allowed','Smoking allowed'],['allows_pets','Pets permitted']]},
 {title:'Safety & accessibility',items:[['smoke_alarm','Smoke alarm'],['carbon_monoxide_alarm','CO alarm'],['wheelchair_access','Wheelchair accessible'],['elevator','Elevator'],['private_entrance','Private entrance'],['security','Security staff']]},
 {title:'Production equipment',items:[['camera_equipment','Cameras'],['lighting_equipment','Lighting'],['microphones','Microphones'],['monitor','Camera / LCD monitors'],['multiple_camera_angles','Multiple camera angles'],['sd_card_available','SD cards available'],['wardrobe','Wardrobe'],['makeup_station','Makeup station'],['soundproofing','Soundproofing'],['on_site_staff','On-site crew']] }
];
export const accessibility=[
 ['step_free_access','Step-free entrance'],['disabled_parking','Accessible parking'],
 ['wide_entrance','Entrance wider than 32 inches'],['step_free_bedroom','Step-free bedroom'],
 ['wide_bedroom','Wide bedroom entrance'],['step_free_bathroom','Step-free bathroom'],
 ['wide_bathroom','Wide bathroom entrance'],['toilet_grab_bar','Toilet grab bar'],
 ['shower_grab_bar','Shower grab bar'],['step_free_shower','Step-free shower'],['shower_chair','Shower chair'],
 ['hoist','Adaptive hoist']
];
const crewRoles=[
 ['creators','Creators / performers'],['videographers','Videographers'],['photographers','Photographers'],
 ['agents','Agents / managers'],['production_staff','Production crew'],['makeup','Makeup & hair'],['other','Other guests']
];
const services=[
 {title:'Photography',Icon:Camera,subtitle:'Portraits, campaigns and shoots'},
 {title:'Videography',Icon:Video,subtitle:'Multi-camera and film production'},
 {title:'Makeup & styling',Icon:Brush,subtitle:'Professional makeup artists'},
 {title:'Hair',Icon:Scissors,subtitle:'Hair stylists and hair teams'},
 {title:'Equipment rental',Icon:Package,subtitle:'Cameras, lenses and monitors'},
 {title:'Audio & microphones',Icon:Mic,subtitle:'Recording, lavalier and boom'},
 {title:'Lighting & grip',Icon:Lightbulb,subtitle:'Studio lighting and modifiers'}
];
const panel='rounded-2xl border border-[#e1e9ef] bg-white shadow-sm';
const input='w-full min-h-[44px] rounded-xl border border-[#d5e2e9] bg-white px-3 py-2.5 text-sm text-[#193246]';
const secondary='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#d5e2e9] bg-white px-4 py-2 text-sm font-semibold text-[#1a3c50] hover:border-[#12698f]';
const primary='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#12698f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c5272] disabled:opacity-40';
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((Number(cents)||0)/100);
const DEFAULT_FILTERS={types:[],minPrice:'',maxPrice:'',bedrooms:0,beds:0,bathrooms:0,amenities:[],
 access:[],language:'',use:'',pets:false,smoking:false};
function loadMapLib(){
 if(typeof window==='undefined')return Promise.reject(Error('Map only available in a browser'));
 const browser=/** @type {any} */(window);
 if(browser.maplibregl)return Promise.resolve(browser.maplibregl);
 if(browser.__hostMapPromise)return browser.__hostMapPromise;
 browser.__hostMapPromise=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-host-maplibre]')){
   const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.10.0/dist/maplibre-gl.css';
   css.dataset.hostMaplibre='true';document.head.appendChild(css);
  }
  const script=document.createElement('script');script.src='https://unpkg.com/maplibre-gl@5.10.0/dist/maplibre-gl.js';
  script.async=true;script.onload=()=>browser.maplibregl?resolve(browser.maplibregl):reject(Error('Map script unavailable'));
  script.onerror=()=>reject(Error('Could not load the road map'));document.head.appendChild(script);
 }).catch(e=>{browser.__hostMapPromise=null;throw e;});
 return browser.__hostMapPromise;
}
function ApproximateRoadMap({properties=[],onOpen}){
 const container=useRef(null),instance=useRef(null),markers=useRef([]);
 const [error,setError]=useState('');
 const mapRows=useMemo(()=>properties.filter(p=>Number.isFinite(p.approx_lat)&&Number.isFinite(p.approx_lng)),[properties]);
 useEffect(()=>{
  if(!container.current||mapRows.length===0)return;
  let disposed=false;let cleanup=null;
  loadMapLib().then(lib=>{
   if(disposed||!container.current)return;
   const map=new lib.Map({
    container:container.current,style:'https://tiles.openfreemap.org/styles/positron',
    center:[Number(mapRows[0].approx_lng),Number(mapRows[0].approx_lat)],
    zoom:9,cooperativeGestures:true,attributionControl:true
   });
   instance.current=map;
   map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   map.on('load',()=>{
    if(disposed)return;
    const bounds=new lib.LngLatBounds();
    for(const item of mapRows.slice(0,100)){
     const lat=Number(item.approx_lat),lng=Number(item.approx_lng);
     const el=document.createElement('button');el.type='button';
     el.className='host-map-price-pin';el.textContent=money(item.one_day_including_cleaning_cents??item.daily_rate_cents);
     el.title='Approximate city area for '+item.title+'; exact property address is private';
     el.addEventListener('click',()=>onOpen(item.id));
     const marker=new lib.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(map);
     markers.current.push(marker);bounds.extend([lng,lat]);
    }
    if(mapRows.length>1)map.fitBounds(bounds,{padding:70,maxZoom:12,duration:0});
   });
   cleanup=()=>{for(const m of markers.current)m.remove();markers.current=[];map.remove();instance.current=null;};
  }).catch(()=>{if(!disposed)setError('Map tiles are unavailable right now. Use the property list to continue.');});
  return()=>{disposed=true;cleanup?.();};
 },[mapRows,onOpen]);
 return <div className="relative h-[min(76vh,760px)] min-h-[440px] overflow-hidden rounded-2xl bg-[#f7fafb]">
  <div ref={container} className="absolute inset-0" role="region" aria-label="Approximate venue map with road labels"/>
  {mapRows.length===0?<div className="absolute inset-0 grid place-items-center p-7 text-center">
   <div><MapPin className="mx-auto mb-3 text-[#12698f]" size={38}/>
    <p className="font-semibold text-[#193246]">Map locations aren't available yet</p>
    <p className="mt-2 max-w-sm text-sm text-[#627789]">Approved hosts must select a city before an approximate map marker is shown. Exact property addresses stay private.</p></div>
  </div>:null}
  {error&&<div className="absolute inset-x-3 bottom-12 rounded-xl bg-white/95 p-3 text-xs text-[#193246] shadow-md" role="alert">{error}</div>}
  <div className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 p-2 text-center text-[11px] text-[#486379] shadow-sm">
   City-level markers only — not exact locations or guaranteed one-mile accuracy. © OpenStreetMap contributors.
  </div>
 </div>;
}
function FilterModal({value,onChange,onClose,onApply,matching}){
 const [local,setLocal]=useState({...value,types:[...value.types],amenities:[...value.amenities],access:[...value.access]});
 useEffect(()=>{
  const onKey=e=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',onKey);const prev=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=prev;};
 },[onClose]);
 const toggle=(key,id)=>setLocal(f=>({...f,[key]:f[key].includes(id)?f[key].filter(x=>x!==id):[...f[key],id]}));
 const count=local.types.length+local.amenities.length+local.access.length+Number(Boolean(local.language))+Number(Boolean(local.use));
 return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061622a8] p-3 backdrop-blur-[2px]" role="presentation" onClick={onClose}>
  <section className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] bg-white text-[#193246] shadow-2xl"
   role="dialog" aria-modal="true" aria-label="Filter production venues" onClick={e=>e.stopPropagation()}>
   <div className="flex items-center justify-between border-b border-[#e2e8ed] px-6 py-5">
    <h2 className="text-lg font-extrabold">Filters</h2><button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f1f5f7]" onClick={onClose} aria-label="Close filters"><X size={20}/></button>
   </div>
   <div className="space-y-6 overflow-y-auto p-6">
    <section className="space-y-3"><h3 className="font-semibold">Type of production space</h3>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{kinds.map(({id,label,Icon})=><button type="button" key={id} aria-pressed={local.types.includes(id)}
      onClick={()=>toggle('types',id)} className={'flex min-h-[72px] items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm '+(local.types.includes(id)?'border-[#12698f] bg-[#e9f5fc]':'border-[#dbe6ec]')}>
      <Icon size={18} className="shrink-0 text-[#12698f]"/>{label}</button>)}</div>
    </section>
    <section className="border-t border-[#e2e8ed] pt-5"><h3 className="font-semibold">Price range</h3>
     <p className="mt-1 text-xs text-[#627789]">One-day estimate including the listed cleaning fee. Taxes and payment-provider fees are not yet available.</p>
     <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-xs">Minimum (USD)<input type="number" min="0" className={input+' mt-1'} value={local.minPrice} onChange={e=>setLocal(f=>({...f,minPrice:e.target.value}))} placeholder="No minimum"/></label>
      <label className="text-xs">Maximum (USD)<input type="number" min="0" className={input+' mt-1'} value={local.maxPrice} onChange={e=>setLocal(f=>({...f,maxPrice:e.target.value}))} placeholder="No maximum"/></label>
     </div>
    </section>
    <section className="border-t border-[#e2e8ed] pt-5">
     <h3 className="mb-3 font-semibold">Rooms and capacity</h3>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[['bedrooms','Bedrooms'],['beds','Beds'],['bathrooms','Bathrooms']].map(([id,label])=><label key={id} className="text-sm">{label}
       <select className={input+' mt-1'} value={local[id]} onChange={e=>setLocal(f=>({...f,[id]:Number(e.target.value)}))}>
        {[0,1,2,3,4,5,6,8,10].map(x=><option key={x} value={x}>{x===0?'Any':x+'+'}</option>)}
       </select></label>)}
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
    <div className="border-t border-[#e2e8ed] pt-5 text-sm"><h3 className="font-semibold">Booking options</h3>
     <p className="mt-2 text-xs text-[#627789]">Instant booking, guaranteed free cancellation and automated self-check-in will appear when the relevant payment, agreement and lock providers are configured. No misleading disabled filters are shown.</p>
    </div>
   </div>
   <div className="flex items-center justify-between border-t border-[#e2e8ed] px-6 py-5">
    <button type="button" className="text-sm font-semibold underline" onClick={()=>setLocal({...DEFAULT_FILTERS})}>Clear all</button>
    <button type="button" className={primary} onClick={()=>{onChange(local);onApply(local);onClose();}}>Show matching spaces{count?' · '+count+' filters':''}</button>
   </div>
  </section>
 </div>;
}
export default function MarketplaceExplore({items=[],busy=false,onSearch=(_filters)=>{void _filters;},onOpen=(_id)=>{void _id;},onBecomeHost=()=>{},site='host'}){
 const [tab,setTab]=useState('spaces'),[geo,setGeo]=useState({...EMPTY_GEO});
 const [keyword,setKeyword]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [crew,setCrew]=useState(Object.fromEntries(crewRoles.map(([key])=>[key,0])));
 const [crewOpen,setCrewOpen]=useState(false),[filterOpen,setFilterOpen]=useState(false),[filters,setFilters]=useState({...DEFAULT_FILTERS});
 const [showMap,setShowMap]=useState(true);
 const count=Object.values(crew).reduce((sum,n)=>sum+Number(n||0),0);
 const displayed=useMemo(()=>items.filter(p=>{
  if(filters.types.length&&!filters.types.includes(p.category))return false;
  const one=(Number(p.one_day_including_cleaning_cents)||Number(p.daily_rate_cents)+Number(p.cleaning_fee_cents))/100;
  const quoted=Number.isFinite(p.stay_total_cents)?p.stay_total_cents/100:one;
  if(filters.minPrice!==''&&quoted<Number(filters.minPrice))return false;
  if(filters.maxPrice!==''&&quoted>Number(filters.maxPrice))return false;
  if(filters.bedrooms&&(p.bedrooms||0)<filters.bedrooms)return false;
  if(filters.beds&&(p.beds||0)<filters.beds)return false;
  if(filters.bathrooms&&(p.bathrooms||0)<filters.bathrooms)return false;
  if(filters.amenities.some(k=>!p.amenities?.includes(k)))return false;
  if(filters.access.some(k=>!p.accessibility_features?.includes(k)))return false;
  if(filters.language&&!p.host_languages?.includes(filters.language))return false;
  if(filters.use&&!p.permitted_uses?.includes(filters.use))return false;
  if(count>0&&(p.capacity||0)<count)return false;
  return true;
 }),[items,filters,count]);
 const apply=(nextFilters=filters)=>onSearch({
  query:keyword,country:geo.country,state:geo.state,city:geo.city,
  ...(from&&to?{start_date:from,end_date:to}:{}),
  ...(count>0?{crew_size:count}:{}),
  ...(nextFilters.amenities.length?{amenities:nextFilters.amenities}:{}),
  ...(nextFilters.access.length?{accessibility:nextFilters.access}:{}),
  ...(nextFilters.use?{requested_use:nextFilters.use}:{}),
  ...(nextFilters.language?{host_language:nextFilters.language}:{}),
  ...(nextFilters.bedrooms?{min_bedrooms:nextFilters.bedrooms}:{}),
  ...(nextFilters.beds?{min_beds:nextFilters.beds}:{}),
  ...(nextFilters.bathrooms?{min_bathrooms:nextFilters.bathrooms}:{})
 });
 const data=displayed;
 return <div className="space-y-5 text-[#193246]" data-host-discovery="true">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#12698f]">Host Connect X</p>
    <h2 className="mt-1 text-2xl font-bold">Find your next production location</h2>
    <p className="mt-1 text-sm text-[#61778a]">Browse approved spaces without signing in. Booking requires a verified account.</p></div>
   {site==='host'&&<button type="button" className={secondary} onClick={onBecomeHost}><Home size={16}/> Become a host</button>}
  </div>
  <nav className="flex flex-wrap gap-2" aria-label="Explore marketplace categories">
   {([{id:'spaces',label:'Spaces',Icon:Home},{id:'studios',label:'Studios',Icon:Clapperboard},
    {id:'services',label:'Services',Icon:Brush},{id:'equipment',label:'Equipment',Icon:Package}]
    ).map(({id,label,Icon})=>
    <button key={id} type="button" aria-current={tab===id?'page':undefined}
     onClick={()=>setTab(id)}
     className={(tab===id?'bg-[#12698f] text-white':'bg-[#f0f6f9] text-[#32556a] hover:bg-[#e1eff6]')+' inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold'}>
     <Icon size={17}/>{label}</button>)}
  </nav>
  {(tab==='services'||tab==='equipment')?<div className="space-y-4">
   <h3 className="text-lg font-bold">{tab==='services'?'Professional services':'Production equipment and rentals'}</h3>
   <p className="text-sm text-[#627789]">Professionals are discovered on Content Connect X. Equipment offered by venue hosts is shown in each approved listing. These are category links, not invented local providers.</p>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {(tab==='services'?services.filter(s=>!s.title.toLowerCase().includes('equipment')):
      services.filter(s=>/equipment|audio|lighting/.test(s.title.toLowerCase()))).map(({title,Icon,subtitle})=>
     <a href="https://contentconnectx.com/Discovery" key={title} target="_blank" rel="noopener noreferrer"
      className="group rounded-2xl border border-[#e0e8ef] bg-white p-4 transition hover:border-[#9bc4dc]">
      <div className="grid aspect-[5/4] place-items-center rounded-xl bg-[#eff6fa] text-[#12698f]"><Icon size={45} strokeWidth={1.4}/></div>
      <strong className="mt-3 flex items-center gap-2 text-sm">{title}<ExternalLink size={13}/></strong>
      <span className="mt-1 block text-xs text-[#627789]">{subtitle}</span>
     </a>)}
   </div>
  </div>:<>
   <form className={panel+' relative grid gap-3 p-4 lg:grid-cols-[2.4fr_1fr_1fr_1.2fr_auto] lg:items-end'} onSubmit={e=>{e.preventDefault();apply();}}>
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
     <button type="button" className={secondary} aria-pressed={showMap} onClick={()=>setShowMap(x=>!x)}><Map size={16}/>{showMap?'Hide map':'Show map'}</button>
     {filters.types.length>0&&<span className="inline-flex items-center rounded-full bg-[#eaf5fb] px-3 text-xs font-semibold">{filters.types.length} property types</span>}
    </div>
    <p className="flex items-center gap-2 text-xs text-[#627789]"><Tag size={16} className="text-[#12698f]"/> One-day price estimates include listed cleaning fees</p>
   </div>
   {(from||to)&&<p className="rounded-lg bg-[#f0f6fa] px-4 py-2 text-xs text-[#315267]">
    Selected dates {from||'—'} to {to||'—'}. Search verifies property-local blocked/held dates; submit a booking request to recheck the exact live quote.
   </p>}
   <div className={'grid min-w-0 gap-5 '+(showMap?'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]':'')}>
    <section className="min-w-0 space-y-4" aria-label="Venue search results">
     <h3 className="font-bold">{data.length} {tab==='studios'?'production studios':'approved spaces'}{geo.city?' in '+geo.city:''}</h3>
     {data.length===0?<div className={panel+' p-8 text-center'}>
      <Search className="mx-auto mb-3 text-[#12698f]" size={35}/>
      <h4 className="font-bold">No approved venues match those filters yet</h4>
      <p className="mt-2 text-sm text-[#627789]">Try a different city, crew size or venue type. New verified properties appear here automatically.</p>
     </div>:
      <div className={'grid gap-4 '+(showMap?'sm:grid-cols-2 xl:grid-cols-2':'sm:grid-cols-2 xl:grid-cols-4')}>
       {data.filter(p=>tab!=='studios'||['film_studio','photo_studio','set','dungeon'].includes(p.category)).map(p=>
        <button type="button" key={p.id} className="group overflow-hidden rounded-2xl bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
         onClick={()=>onOpen(p.id)}>
         <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-[#eff5f8]">
          {p.cover_url?<img src={p.cover_url} alt={p.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/>:
           <div className="grid h-full w-full place-items-center text-[#12698f]"><Home size={46} strokeWidth={1.5}/></div>}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#20394a] shadow-sm">{kinds.find(x=>x.id===p.category)?.label||'Production venue'}</span>
         </div>
         <div className="space-y-1 px-1 pb-3 pt-3">
          <h4 className="truncate text-sm font-bold">{p.title}</h4>
          <p className="truncate text-xs text-[#627789]">{[p.city,p.state,p.country].filter(Boolean).join(', ')}</p>
          <p className="text-xs text-[#627789]">Up to {p.capacity||'—'} crew · {p.bedrooms||0} bedrooms · {p.bathrooms||0} bathrooms</p>
          <p className="mt-2 text-sm font-bold">{money(p.stay_total_cents??p.one_day_including_cleaning_cents??p.daily_rate_cents+p.cleaning_fee_cents)}
           <span className="text-xs font-normal text-[#627789]">{p.date_availability_checked?p.stay_days+' days incl. cleaning':'one day incl. cleaning'}</span></p>
         </div>
        </button>)}
      </div>}
    </section>
    {showMap&&<aside className="sticky top-24 h-fit" aria-label="Approximate production location map">
     <ApproximateRoadMap properties={data} onOpen={onOpen}/>
    </aside>}
   </div>
   <section className="space-y-3 border-t border-[#e1e8ef] pt-6" aria-label="Professional services from Content Connect X">
    <div className="flex justify-between gap-3"><div><h3 className="font-bold">Production services</h3><p className="mt-1 text-xs text-[#627789]">Find collaborators and service providers through Content Connect X.</p></div>
     <a href="https://contentconnectx.com/Discovery" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#12698f]">Explore services</a></div>
    <div className="flex gap-3 overflow-x-auto pb-3">{services.map(({title,Icon})=>
     <a key={title} href="https://contentconnectx.com/Discovery" target="_blank" rel="noopener noreferrer" className="min-w-32 flex-none text-center">
      <div className="grid aspect-square place-items-center rounded-2xl bg-[#f0f5f8] text-[#12698f]"><Icon size={34} strokeWidth={1.5}/></div>
      <span className="mt-2 block text-xs font-semibold">{title}</span>
     </a>)}</div>
   </section>
  </>}
  {filterOpen&&<FilterModal value={filters} onChange={setFilters} onClose={()=>setFilterOpen(false)} onApply={apply} matching={displayed.length}/>}
 </div>;
}
