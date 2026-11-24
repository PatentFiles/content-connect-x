/** One OpenFreeMap canvas per mounted search. Update pins without reinitializing the map. */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,RefreshCw} from 'lucide-react';
import {ROAD_STYLE,VENUE_ARTWORK,finitePoint,markerPosition,normalizeBounds,money,rentalPrice} from './hostMapPresentation.mjs';
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
  document.querySelector('script[data-host-maplibre]')?.remove();
  const script=document.createElement('script');script.src='https://unpkg.com/maplibre-gl@5.10.0/dist/maplibre-gl.js';
  script.dataset.hostMaplibre='true';script.async=true;
  const timer=window.setTimeout(()=>{script.remove();reject(Error('Map loading timed out'));},15000);
  script.onload=()=>{window.clearTimeout(timer);browser.maplibregl?resolve(browser.maplibregl):reject(Error('Map script unavailable'));};
  script.onerror=()=>{window.clearTimeout(timer);script.remove();reject(Error('Could not load the road map'));};
  document.head.appendChild(script);
 }).catch(e=>{browser.__hostMapPromise=null;throw e;});
 return browser.__hostMapPromise;
}
function styleRoads(map){
 for(const layer of map.getStyle()?.layers||[]){
  const id=String(layer.id).toLowerCase();
  try{
   if(layer.type==='symbol'&&/(poi|housenumber|house_number|building_number)/.test(id))map.setLayoutProperty(layer.id,'visibility','none');
   if(layer.type==='line'&&/motorway|trunk|primary|secondary/.test(id)&&!/(rail|path|label|tunnel)/.test(id))
    map.setPaintProperty(layer.id,'line-color',/casing/.test(id)?'#c4a67d':'#e5cda7');
   if(layer.type==='symbol'&&/(road|street|highway|place)/.test(id)&&layer.layout?.['text-field'])
    map.setPaintProperty(layer.id,'text-color','#53514d');
  }catch{/* Paint customization must not block the base map. */}
 }
}
export default function HostRoadMap({properties=[],onOpen=(_id)=>{void _id;},onBounds=(_bounds)=>{void _bounds;},categorySelected=false,unit='day'}){
 const node=useRef(null),mapRef=useRef(null),libRef=useRef(null),markers=useRef([]),callbacks=useRef({onOpen,onBounds}),searchRef=useRef(true);
 const fitted=useRef(false),timer=useRef(0),fitMove=useRef(false);
 const [searchMoving,setSearchMoving]=useState(true),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 callbacks.current={onOpen,onBounds};searchRef.current=searchMoving;
 const rows=useMemo(()=>properties.filter(finitePoint),[properties]);
 const requestBounds=()=>{const map=mapRef.current;if(!map)return;const bounds=normalizeBounds(map.getBounds());if(bounds)callbacks.current.onBounds(bounds);};
 useEffect(()=>{
  let disposed=false,observer=null;
  fitted.current=false;setReady(false);setError('');
  loadMapLib().then(lib=>{
   if(disposed||!node.current)return;
   libRef.current=lib;
   const map=new lib.Map({container:node.current,style:ROAD_STYLE,center:[-98.5,39.5],zoom:3.6,minZoom:2,maxZoom:15,cooperativeGestures:true,attributionControl:true,renderWorldCopies:false});
   mapRef.current=map;
   map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   map.on('load',()=>{if(disposed)return;styleRoads(map);setReady(true);setError('');});
   map.on('error',()=>{if(!disposed&&!map.loaded())setError('Road map unavailable. The property list remains usable.');});
   map.on('moveend',()=>{
    if(disposed||fitMove.current||!searchRef.current)return;
    window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>{const b=normalizeBounds(map.getBounds());if(b)callbacks.current.onBounds(b);},450);
   });
   observer=new ResizeObserver(()=>map.resize());observer.observe(node.current);
  }).catch(()=>{if(!disposed)setError('Map unavailable. Browse the property list or retry.');});
  return()=>{disposed=true;window.clearTimeout(timer.current);observer?.disconnect();markers.current.forEach(m=>m.remove());markers.current=[];mapRef.current?.remove();mapRef.current=null;};
 },[attempt]);
 useEffect(()=>{
  const map=mapRef.current,lib=libRef.current;if(!ready||!map||!lib)return;
  markers.current.forEach(m=>m.remove());markers.current=[];
  const bounds=new lib.LngLatBounds();
  for(const item of rows.slice(0,100)){
   const point=markerPosition(item);if(!point)continue;
   const el=document.createElement('button');el.type='button';el.className='host-map-price-pin';
   const label=item.title+' · '+(item.category||'venue')+' · '+money(rentalPrice(item,unit))+' per '+unit+' · approximate area';
   el.setAttribute('aria-label',label);el.title=label;
   el.style.cssText='display:flex;align-items:center;gap:4px;padding:4px 8px;background:white;color:#193246;border:1px solid #c9d7e1;border-radius:999px;box-shadow:0 2px 5px #19324635;min-height:36px;font-size:12px;font-weight:750;white-space:nowrap;cursor:pointer;';
   const art=document.createElement('img');art.src=VENUE_ARTWORK[item.category]||VENUE_ARTWORK.other;art.alt='';art.draggable=false;
   art.style.cssText='width:'+(categorySelected?'42px':'26px')+';height:'+(categorySelected?'42px':'26px')+';object-fit:contain;';el.appendChild(art);
   if(!categorySelected){const price=document.createElement('span');price.textContent=money(rentalPrice(item,unit));el.appendChild(price);}
   el.addEventListener('click',e=>{e.stopPropagation();callbacks.current.onOpen(item.id);});
   markers.current.push(new lib.Marker({element:el,anchor:'center'}).setLngLat(point).addTo(map));bounds.extend(point);
  }
  if(rows.length&&!fitted.current){
   fitted.current=true;fitMove.current=true;
   if(rows.length===1)map.jumpTo({center:markerPosition(rows[0]),zoom:11});
   else map.fitBounds(bounds,{padding:65,maxZoom:12,duration:0});
   fitMove.current=false;
  }
 },[rows,ready,categorySelected,unit]);
 return <div className="relative h-[min(76vh,760px)] min-h-[440px] overflow-hidden rounded-2xl bg-[#f7fafb]" data-host-road-map="true">
  <div ref={node} className="absolute inset-0" role="region" aria-label="Approximate venue map with road labels"/>
  <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-65px)] space-y-2">
   <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#193246] shadow-md"><input type="checkbox" checked={searchMoving} onChange={e=>setSearchMoving(e.target.checked)} className="accent-[#12698f]"/>Search as I move the map</label>
   {!searchMoving&&<button type="button" onClick={requestBounds} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#193246] shadow" disabled={!ready}>Search this area</button>}
  </div>
  {!rows.length&&ready&&<div className="absolute bottom-16 left-3 right-3 rounded-xl bg-white/95 p-3 text-xs text-[#193246] shadow"><MapPin size={16} className="mr-1 inline"/>No matching mapped properties in these results. Move the map or change filters.</div>}
  {error&&<div className="absolute inset-x-3 bottom-16 z-10 rounded-xl bg-white/95 p-3 text-xs text-[#193246] shadow-md" role="alert">{error} <button type="button" onClick={()=>setAttempt(v=>v+1)} className="ml-2 underline"><RefreshCw size={14} className="inline"/> Retry map</button></div>}
  <div className="absolute inset-x-3 bottom-8 rounded-lg bg-white/95 p-2 text-center text-[11px] text-[#486379] shadow-sm">Approximate city-area pins · exact addresses remain private. <a className="underline" href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
 </div>;
}
