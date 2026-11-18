/**
 * Location-map discovery. Pin positions use APPROVED PUBLIC AREA CENTERS, never
 * a studio's street address or private coordinates. Default OSM browser tiles
 * respect provider caching and attribution. Set a contracted tile URL at scale.
 */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,Plus,Minus,Search,Compass,Route,Layers} from 'lucide-react';
import {project,unproject,mapBounds,inside,clamp,kmBetween} from './hostingMapMath.mjs';
import {hostingAdvanced} from './hostingBusinessApi';

const label='text-xs text-[var(--cc-text-secondary)]';
const field='rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2 text-xs text-[var(--cc-text-primary)]';
const button='rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 text-xs text-[var(--cc-text-primary)] disabled:opacity-50';
const fixed=(n)=>Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});

export default function HostingAreaMap({areas=[],listings=[],onSelect,onSearchBounds,focusAreaId='',highlightedIds=[],showTravel=true}){
 const element=useRef(null),drag=useRef(null);
 const [size,setSize]=useState({width:700,height:450});
 const [center,setCenter]=useState({longitude:-118.24368,latitude:34.05223});
 const [zoom,setZoom]=useState(8);
 const [origin,setOrigin]=useState('');
 const [range,setRange]=useState(60);
 const [routeData,setRouteData]=useState(null);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 const highlighted=useMemo(()=>new Set(highlightedIds),[highlightedIds]);
 const areaById=useMemo(()=>new Map(areas.map(a=>[a.id,a])),[areas]);
 const groups=useMemo(()=>{
  const m=new Map();
  for(const v of listings){
   const area=areaById.get(v.public_area_id);if(!area)continue;
   const key=area.id;
   const group=m.get(key)||{area,items:[],minPrice:Infinity};
   group.items.push(v);group.minPrice=Math.min(group.minPrice,Number(v.hourly_rate)||0);m.set(key,group);
  }
  return [...m.values()];
 },[listings,areaById]);
 useEffect(()=>{
  if(!element.current)return;
  const resize=()=>setSize({width:element.current.clientWidth||700,height:element.current.clientHeight||450});
  resize();
  const observer=new ResizeObserver(resize);observer.observe(element.current);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const area=areaById.get(focusAreaId);if(!area)return;
  setCenter({longitude:Number(area.longitude),latitude:Number(area.latitude)});setZoom(10);setSelected(area.id);
 },[focusAreaId,areaById]);
 const projection=project(center.longitude,center.latitude,zoom);
 const bounds=mapBounds(center,size.width,size.height,zoom);
 const tileTemplate=import.meta.env.VITE_HOSTING_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const extraAttribution=String(import.meta.env.VITE_HOSTING_MAP_ATTRIBUTION||'').slice(0,200);
 const validTiles=typeof tileTemplate==='string'&&tileTemplate.startsWith('https://')&&
  tileTemplate.includes('{z}')&&tileTemplate.includes('{x}')&&tileTemplate.includes('{y}');
 const tiles=useMemo(()=>{
  if(!validTiles)return [];
  const z=zoom,origin=project(center.longitude,center.latitude,z);
  const x0=Math.floor((origin.x-size.width/2)/256)-1;
  const x1=Math.floor((origin.x+size.width/2)/256)+1;
  const y0=Math.floor((origin.y-size.height/2)/256)-1;
  const y1=Math.floor((origin.y+size.height/2)/256)+1;
  const n=2**z,out=[];
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   if(y<0||y>=n)continue;
   const tileX=((x%n)+n)%n;
   out.push({key:z+'-'+x+'-'+y,
    url:tileTemplate.replace('{z}',String(z)).replace('{x}',String(tileX)).replace('{y}',String(y)),
    left:x*256-(origin.x-size.width/2),top:y*256-(origin.y-size.height/2)});
  }
  return out;
 },[center,zoom,size.width,size.height,tileTemplate,validTiles]);
 const move=(dx,dy)=>{
  const point=project(center.longitude,center.latitude,zoom);
  const next=unproject(point.x-dx,point.y-dy,zoom);
  setCenter({longitude:next.longitude,latitude:clamp(next.latitude,-80,80)});
 };
 const pointerStart=e=>{
  if(e.target.closest('button,a'))return;
  drag.current={x:e.clientX,y:e.clientY};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const pointerMove=e=>{
  if(!drag.current)return;
  const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
  drag.current={x:e.clientX,y:e.clientY};
  move(dx,dy);
 };
 const pointerEnd=()=>{drag.current=null;};
 const maxRadiusKm=Number(range);
 const originArea=areaById.get(origin);
 const allowedGroups=groups.filter(({area})=>!originArea||kmBetween(originArea,area)<=maxRadiusKm);
 const routeMap=new Map((routeData?.results||[]).map(r=>[r.area_id,r]));
 const requestRoutes=async(areaId)=>{
  setOrigin(areaId);setError('');setRouteData(null);
  if(!areaId)return;
  try{
   const result=await hostingAdvanced('commute_estimates',{
    origin_area_id:areaId,area_ids:groups.map(g=>g.area.id).filter(id=>id!==areaId)
   });
   setRouteData(result);
  }catch(e){setError(e.message);}
 };
 const viewArea=id=>{
  const a=areaById.get(id);if(!a)return;
  setSelected(id);
  setCenter({longitude:Number(a.longitude),latitude:Number(a.latitude)});
  setZoom(Math.max(zoom,10));
 };
 return <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 space-y-3">
  <header className="flex flex-wrap items-center justify-between gap-2 px-1">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--cc-text-primary)]"><Layers size={16}/> Explore rental locations on a map</h3>
      <p className="text-xs text-[var(--cc-text-secondary)]">Approximate public city/neighborhood centers only; exact addresses are never mapped.</p></div>
    <button className={button+' flex items-center gap-1'} onClick={()=>onSearchBounds?.(bounds)}><Search size={15}/>Search this map area</button>
  </header>
  <div className="grid gap-3 lg:grid-cols-[1fr_230px]">
   <div ref={element} className="oh-area-map-canvas relative h-[420px] overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] touch-none select-none cursor-grab active:cursor-grabbing"
     onPointerDown={pointerStart} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
     onWheel={e=>{e.preventDefault();setZoom(z=>clamp(z+(e.deltaY<0?1:-1),3,14));}}>
    <div className="pointer-events-none absolute inset-0" style={{backgroundImage:'linear-gradient(#36547344 1px,transparent 1px),linear-gradient(90deg,#36547344 1px,transparent 1px)',backgroundSize:'55px 55px'}}>
      {tiles.map(tile=><img key={tile.key} src={tile.url} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin"
       className="absolute h-64 w-64 max-w-none" style={{left:tile.left,top:tile.top}}/>)}
    </div>
    {allowedGroups.filter(({area})=>inside(bounds,{longitude:Number(area.longitude),latitude:Number(area.latitude)}))
     .map(({area,items,minPrice})=>{
      const xy=project(area.longitude,area.latitude,zoom);
      const left=xy.x-projection.x+size.width/2,top=xy.y-projection.y+size.height/2;
      const includesOwn=items.some(item=>highlighted.has(item.id));
      return <button key={area.id} onPointerDown={e=>e.stopPropagation()}
       onClick={()=>{setSelected(area.id);if(showTravel)onSelect?.(items[0].id);}}
       className={'absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-3 py-2 shadow-lg backdrop-blur transition hover:scale-110 '+(includesOwn?'oh-map-owned-pin ':'')+(selected===area.id?'border-[var(--cc-border)] ccx-solid-action text-[var(--cc-text-primary)]':'border-[var(--cc-border)] bg-[var(--cc-surface)] text-[var(--cc-text-primary)]')}
       style={{left,top}} title={area.city+', '+area.region+' — '+items.length+' listings'}>
       <MapPin size={13}/><strong className="text-xs">{fixed(minPrice)}</strong>{includesOwn&&<span className="text-[10px]">Yours</span>}{items.length>1&&<span className="rounded-full bg-[var(--cc-surface-subtle)] px-1 text-[10px]">{items.length}</span>}
      </button>;
     })}
    <div className="absolute right-3 top-3 z-30 flex flex-col gap-1">
     <button className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-[var(--cc-text-primary)]" onClick={()=>setZoom(z=>Math.min(14,z+1))} aria-label="Zoom in"><Plus size={17}/></button>
     <button className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-[var(--cc-text-primary)]" onClick={()=>setZoom(z=>Math.max(3,z-1))} aria-label="Zoom out"><Minus size={17}/></button>
     <button className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-[var(--cc-text-primary)]" onClick={()=>{setCenter({longitude:-118.24368,latitude:34.05223});setZoom(8);}} title="Center Los Angeles"><Compass size={17}/></button>
    </div>
    {!validTiles&&<div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-[var(--cc-surface-subtle)] px-3 py-2 text-[11px] text-[var(--cc-text-secondary)]">Map tiles require a configured production map provider.</div>}
    {validTiles&&<div className="absolute bottom-2 left-2 bg-[var(--cc-surface-subtle)] px-2 py-1 text-[10px] text-[var(--cc-text-primary)]">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className="underline">Map feedback</a>{extraAttribution&&<span> · {extraAttribution}</span>}</div>}
   </div>
   <aside className="space-y-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3">
     {showTravel?<>
     <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-secondary)]"><Route size={15}/> Travel and commute</p>
     <label className={label+' block'}>Travel origin<select className={field+' mt-1 w-full'} value={origin} onChange={e=>requestRoutes(e.target.value)}><option value="">Any location</option>{areas.map(a=><option key={a.id} value={a.id}>{a.city}, {a.region}</option>)}</select></label>
     <label className={label+' block'}>Maximum straight-line radius <strong>{range} km</strong>
      <input type="range" className="mt-2 block w-full" value={range} min={5} max={400} step={5} onChange={e=>setRange(Number(e.target.value))}/>
     </label>
     {originArea&&<p className="text-[11px] text-[var(--cc-text-secondary)]">Distance is calculated between general public areas, not exact venue addresses.</p>}
     {routeData&&!routeData.routing_ready&&<p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">Verified driving times unavailable until a routing provider is connected. Do not treat straight-line distance as driving time.</p>}
     {error&&<p className="text-xs text-red-800">{error}</p>}
     </>:<div><h4 className="text-sm font-semibold text-[var(--cc-text-primary)]">Locations & asking rates</h4><p className="mt-2 text-xs leading-6 text-[var(--cc-text-secondary)]">Choose an area below. Your own properties are marked in cyan.</p></div>}
     <div className="max-h-48 space-y-1 overflow-y-auto">
      {allowedGroups.map(({area,items,minPrice})=>{
       const route=routeMap.get(area.id);
       const includesOwn=items.some(item=>highlighted.has(item.id));
      return <button key={area.id} className="w-full rounded-lg border border-[var(--cc-border)] px-3 py-2 text-left hover:bg-[var(--cc-surface)]"
        onClick={()=>viewArea(area.id)}>
        <strong className="block truncate text-xs text-[var(--cc-text-primary)]">{area.city}, {area.region}</strong>
        <span className="text-[11px] text-[var(--cc-text-secondary)]">{items.length} listings · from {fixed(minPrice)}</span>
        {originArea&&<span className="block text-[11px] text-[var(--cc-text-secondary)]">{kmBetween(originArea,area).toFixed(1)} km direct
         {route?.route_verified?' · approx '+route.driving_minutes+' min drive':''}</span>}
       </button>;
      })}
     </div>
     {!showTravel&&selected&&<div className="max-h-44 overflow-y-auto space-y-2 border-t border-[var(--cc-border)] pt-3">
      {(groups.find(group=>group.area.id===selected)?.items||[]).map(item=><button key={item.id} type="button" className={'w-full rounded-lg border px-3 py-2 text-left '+(highlighted.has(item.id)?'border-[var(--cc-border)] bg-[var(--cc-surface)]':'border-[var(--cc-border)] bg-[var(--cc-surface)]')} onClick={()=>onSelect?.(item.id)}>
       <strong className="block text-xs text-[var(--cc-text-primary)]">{item.title}</strong><span className="mt-1 block text-[11px] text-[var(--cc-link)]">{highlighted.has(item.id)?'Your property · ':''}{fixed(item.hourly_rate)}/hour</span>
      </button>)}
     </div>}
     <p className="text-[10px] text-[var(--cc-text-secondary)]">Map-area search shows approved areas. Routes are approximations to public area centers.</p>
   </aside>
  </div>
 </div>;
}
