/** One OpenFreeMap canvas per mounted search. Update pins without reinitializing the map. */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,RefreshCw} from 'lucide-react';
import HostRasterFallback from './HostRasterFallback';
import {ROAD_STYLE,VENUE_ARTWORK,finitePoint,markerPosition,normalizeBounds,money,rentalPrice} from './hostMapPresentation.mjs';
const ASSETS='/vendor/maplibre-6.19.0/';
let rendererPromise=null;
function loadMapLib(){
 if(typeof window==='undefined')return Promise.reject(Error('Map only available in a browser'));
 const browser=/** @type {any} */(window);
 // Offline role tests inject a renderer solely to exercise their DOM controls.
 if(browser.maplibregl&&!browser.maplibregl.setWorkerUrl)return Promise.resolve(browser.maplibregl);
 if(rendererPromise)return rendererPromise;
 const css=document.createElement('link');css.rel='stylesheet';css.href=ASSETS+'maplibre-gl.css';css.dataset.hostMaplibre='true';
 const stylesheet=new Promise((resolve,reject)=>{css.onload=()=>resolve(true);css.onerror=()=>reject(Error('Local map stylesheet failed'));document.head.appendChild(css);});
 const moduleUrl=new URL(ASSETS+'maplibre-gl.mjs',window.location.origin).href;
 const timeout=()=>new Promise((_,reject)=>{window.setTimeout(()=>reject(Error('Local map loading timed out')),12000);});
 rendererPromise=Promise.race([Promise.all([import(/* @vite-ignore */ moduleUrl),stylesheet]).then(([lib])=>{
  lib.setWorkerUrl(new URL(ASSETS+'maplibre-gl-worker.mjs',window.location.origin).href);
  return lib;
 }),timeout()]).catch(e=>{css.remove();rendererPromise=null;throw e;});
 return rendererPromise;
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
 const [searchMoving,setSearchMoving]=useState(true),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[fallback,setFallback]=useState(false);
 callbacks.current={onOpen,onBounds};searchRef.current=searchMoving;
 const rows=useMemo(()=>properties.filter(finitePoint),[properties]);
 const requestBounds=()=>{const map=mapRef.current;if(!map)return;const bounds=normalizeBounds(map.getBounds());if(bounds)callbacks.current.onBounds(bounds);};
 useEffect(()=>{
  if(fallback)return;
  let disposed=false,observer=null,loadTimer=0,loaded=false;
  fitted.current=false;setReady(false);setError('');
  const unavailable=()=>{if(!disposed){setError('Vector map unavailable on this device or connection.');setFallback(true);}};
  loadTimer=window.setTimeout(unavailable,25000);
  loadMapLib().then(lib=>{
   if(disposed||!node.current)return;
   libRef.current=lib;
   if(typeof lib.supported==='function'&&!lib.supported()){unavailable();return;}
   const map=new lib.Map({container:node.current,style:ROAD_STYLE,center:[-98.5,39.5],zoom:3.6,minZoom:2,maxZoom:15,cooperativeGestures:true,attributionControl:true,renderWorldCopies:false});
   mapRef.current=map;
   map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   map.on('load',()=>{if(disposed)return;loaded=true;window.clearTimeout(loadTimer);styleRoads(map);map.resize();setReady(true);setError('');});
   map.on('error',()=>{if(!disposed&&!loaded)setError('Loading map data…');});
   map.on('webglcontextlost',unavailable);
   map.on('moveend',()=>{
    if(disposed||fitMove.current||!searchRef.current)return;
    window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>{if(disposed||!searchRef.current)return;const b=normalizeBounds(map.getBounds());if(b)callbacks.current.onBounds(b);},450);
   });
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>map.resize());observer.observe(node.current);}
  }).catch(unavailable);
  return()=>{disposed=true;window.clearTimeout(loadTimer);window.clearTimeout(timer.current);observer?.disconnect();markers.current.forEach(m=>m.remove());markers.current=[];mapRef.current?.remove();mapRef.current=null;};
 },[attempt,fallback]);
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
 if(fallback)return <HostRasterFallback properties={rows} onOpen={onOpen} onBounds={onBounds} categorySelected={categorySelected} unit={unit} onRetry={()=>{setFallback(false);setAttempt(v=>v+1);}}/>;
 return <div className="relative min-h-[440px] overflow-hidden rounded-2xl bg-[#f7fafb]" style={{height:'min(76vh, 760px)'}} data-host-road-map="true" data-map-renderer="vector" data-map-status={ready?'ready':'loading'}>
  <div ref={node} className="absolute inset-0" style={{position:'absolute',inset:0,width:'100%',height:'100%'}} role="region" aria-label="Approximate venue map with road labels"/>
  <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-65px)] space-y-2">
   <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#193246] shadow-md"><input type="checkbox" checked={searchMoving} onChange={e=>setSearchMoving(e.target.checked)} className="accent-[#12698f]"/>Search as I move the map</label>
   {!searchMoving&&<button type="button" onClick={requestBounds} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#193246] shadow" disabled={!ready}>Search this area</button>}
  </div>
  {!ready&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#193246]" role="status">Loading road map…</div>}
  {!rows.length&&ready&&<div className="absolute bottom-16 left-3 right-3 rounded-xl bg-white/95 p-3 text-xs text-[#193246] shadow"><MapPin size={16} className="mr-1 inline"/>No matching mapped properties in these results. Move the map or change filters.</div>}
  {!ready&&<button type="button" className="absolute bottom-20 right-3 z-10 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#193246] shadow" onClick={()=>setFallback(true)}>Use compatibility map</button>}
  {error&&<div className="absolute inset-x-3 bottom-16 z-10 rounded-xl bg-white/95 p-3 text-xs text-[#193246] shadow-md" role="alert">{error} <button type="button" onClick={()=>setAttempt(v=>v+1)} className="ml-2 underline"><RefreshCw size={14} className="inline"/> Retry map</button></div>}
  <div className="absolute inset-x-3 bottom-8 rounded-lg bg-white/95 p-2 text-center text-[11px] text-[#486379] shadow-sm">Approximate city-area pins · exact addresses remain private. <a className="underline" href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></div>
 </div>;
}
