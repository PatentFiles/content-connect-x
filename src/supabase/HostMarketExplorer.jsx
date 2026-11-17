/** Price comparison uses this marketplace's approved listings, not scraped Airbnb inventory. */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Search,Navigation,MapPinned,Home,RefreshCw} from 'lucide-react';
import {hostingAction,usd} from './hostingApi';
import {kmBetween} from './hostingMapMath.mjs';
import HostingAreaMap from './HostingAreaMap';
import HostDialog from './HostDialog';
import {PropertyPreviewCard} from './HostPortfolio';

/** @param {{onEdit:(listing:any)=>void,ownedListings:any[]}} props */
export default function HostMarketExplorer({onEdit,ownedListings=[]}){
 const [city,setCity]=useState(''),[searchedCity,setSearchedCity]=useState('');
 const [data,setData]=useState({areas:[],items:[],owned_items:[],has_more:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [focusArea,setFocusArea]=useState(''),[preview,setPreview]=useState(null);
 const [offset,setOffset]=useState(0);
 const [searchBounds,setSearchBounds]=useState(null);
 const generation=useRef(0);
 const search=useCallback(async(place='',start=0,bounds=null)=>{
  const request=++generation.current;setBusy(true);setError('');
  try{
   const result=await hostingAction('host_market_overview',{city:place,offset:start,limit:60,bounds});
   if(request!==generation.current)return;
   setData(current=>({...result,items:start?[...current.items,...result.items]:result.items}));
   setSearchedCity(place);setOffset(result.next_offset??start+result.items.length);setSearchBounds(bounds);
   const match=result.areas.find(a=>a.city.toLowerCase()===place.trim().toLowerCase());
   if(!start&&!bounds)setFocusArea(match?.id||result.owned_items.find(p=>p.public_area_id)?.public_area_id||'');
  }catch(e){if(request===generation.current)setError(e.message);}
  finally{if(request===generation.current)setBusy(false);}
 },[]);
 useEffect(()=>{void search();return()=>{generation.current++;};},[search]);
 const items=useMemo(()=>{
  const merged=new Map(data.items.map(item=>[item.id,item]));
  for(const item of data.owned_items){
   if(!searchedCity||item.city?.toLowerCase().includes(searchedCity.toLowerCase()))merged.set(item.id,{...item,owned:true});
  }
  return [...merged.values()];
 },[data,searchedCity]);
 const rates=data.items.filter(v=>!v.owned).map(v=>Number(v.hourly_rate)).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
 const median=rates.length?(rates[Math.floor((rates.length-1)/2)]+rates[Math.floor(rates.length/2)])/2:null;
 const choose=id=>{
  const property=items.find(item=>item.id===id);if(!property)return;
  if(property.owned){const own=ownedListings.find(p=>p.id===id);if(own){onEdit(own);return;}}
  setPreview(property);
 };
 const local=()=>{
  if(!navigator.geolocation){setError('Location lookup is unavailable. Search by city instead.');return;}
  setBusy(true);setError('');
  navigator.geolocation.getCurrentPosition(result=>{
   // Raw coordinates stay in this browser and are never stored or sent to the API.
   const point={latitude:result.coords.latitude,longitude:result.coords.longitude};
   const nearest=[...data.areas].sort((a,b)=>kmBetween(point,a)-kmBetween(point,b))[0];
   if(nearest&&kmBetween(point,nearest)<=200){setCity(nearest.city);void search(nearest.city);}else{setBusy(false);setError('No approved nearby areas yet. Search by city.');}
  },()=>{setBusy(false);setError('Location permission was not available. Enter your city to compare prices.');},
  {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
 };
 return <section id="host-market-map" className="oh-market-explorer" aria-labelledby="host-market-heading">
  <header className="oh-market-header"><div><span className="oh-section-kicker">KNOW YOUR LOCAL MARKET</span><h2 id="host-market-heading"><MapPinned size={24}/>Explore locations & compare prices</h2>
   <p>Browse Host Connect asking rates and see your properties alongside approved nearby spaces.</p></div>
   <button type="button" className="oh-circle-control" disabled={busy} onClick={()=>search(searchedCity)} aria-label="Refresh local market"><RefreshCw size={18}/></button></header>
  <form className="oh-market-search" onSubmit={event=>{event.preventDefault();void search(city);}}>
   <label><Search size={18}/><span className="sr-only">Search city</span><input value={city} onChange={event=>setCity(event.target.value)} placeholder="Search a city, such as Phoenix" list="host-market-cities" maxLength={100}/></label>
   <datalist id="host-market-cities">{data.areas.map(area=><option key={area.id} value={area.city}>{area.region}, {area.country}</option>)}</datalist>
   <button type="submit" className="oh-gallery-primary" disabled={busy}>Search locations</button>
   <button type="button" className="oh-gallery-secondary" disabled={busy||!data.areas.length} onClick={local}><Navigation size={16}/>Near me</button>
  </form>
  {error&&<p role="alert" className="oh-inline-error">{error}</p>}
  <div className="oh-market-summary"><p><strong>{data.items.length}</strong> {searchedCity?'matching listings':'approved listings loaded'}{median!==null?<> · Median asking rate <strong>{usd(median)}/hr</strong></>:null}</p>
   <label><Home size={16}/>Your locations <select value="" onChange={event=>{const item=data.owned_items.find(p=>p.id===event.target.value);if(item){setCity(item.city);void search(item.city);}}}>
    <option value="">Choose your property’s city</option>{data.owned_items.map(item=><option key={item.id} value={item.id}>{item.title} · {item.city}</option>)}</select></label></div>
  <HostingAreaMap areas={data.areas} listings={items} onSelect={choose} focusAreaId={focusArea}
   highlightedIds={data.owned_items.map(p=>p.id)} showTravel={false} onSearchBounds={bounds=>{setCity('');void search('',0,bounds);}}/>
  <p className="oh-map-privacy-note">Pins represent approved city/neighborhood centers, not exact addresses. Cyan markers include your own property. Rates are listed prices in this search—not completed bookings or guaranteed earnings.</p>
  {items.some(item=>!item.public_area_id)&&<p className="oh-map-privacy-note">Some properties need an approved public map area before a pin can appear. Their exact street address is never used as a public marker.</p>}
  {busy&&<p role="status" className="oh-upload-count">Loading market locations…</p>}
  <div className="oh-market-card-grid">{items.map(item=><PropertyPreviewCard key={item.id} listing={item} host={item.owned} onOpen={choose}/>)}</div>
  {!busy&&!items.length&&<p className="oh-market-empty">No approved listings in this city yet. Try another city or publish your first approved property.</p>}
  {data.has_more&&<button type="button" className="oh-gallery-secondary" disabled={busy} onClick={()=>search(searchedCity,offset,searchBounds)}>Load more locations</button>}
  {preview&&<HostDialog title={preview.title} subtitle={[preview.city,preview.state,preview.country].filter(Boolean).join(', ')} onClose={()=>setPreview(null)}>
   <div className="oh-market-preview"><PropertyPreviewCard listing={preview} onOpen={()=>{}}/><div><h3>Comparable listing</h3><p><strong>{usd(preview.hourly_rate)}</strong> per hour · {preview.minimum_hours} hour minimum</p><p>Capacity: {preview.capacity} people.</p><p>This host workspace shows approved property details for market comparison. Creator bookings keep their separate verification and subscription requirements.</p></div></div>
  </HostDialog>}
 </section>;
}
