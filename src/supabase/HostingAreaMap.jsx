/** Approved public area map. Never infer exact venues from private addresses.
 * Distinct category symbols are placed within the host-approved public area;
 * the offset is deterministic but unrelated to a property's actual street.
 * Only explicit opted-in public coordinates may become an exact map pin.
 * OSM tiles are requested only for the active viewport, with visible attribution.
 */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,Compass,Home,Building2,Castle,Camera,Clapperboard,Warehouse,TreePine,Package,MapPin} from 'lucide-react';
import {project,unproject,mapBounds,inside,clamp} from './hostingMapMath.mjs';
const iconFor=category=>({
 house:Home,villa:Home,apartment:Building2,loft:Building2,
 film_studio:Clapperboard,photo_studio:Camera,set:Warehouse,
 dungeon:Castle,outdoor:TreePine,equipment:Package
})[category]||MapPin;
const money=n=>Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
function offsetFromArea(item,area){
 const publicLat=Number(item.public_latitude),publicLon=Number(item.public_longitude);
 if(item.public_address_visible===true&&item.public_latitude!==null&&item.public_latitude!==undefined&&item.public_longitude!==null&&item.public_longitude!==undefined&&Number.isFinite(publicLat)&&Number.isFinite(publicLon)
   &&Math.abs(publicLat)<=85&&Math.abs(publicLon)<=180)
  return {latitude:publicLat,longitude:publicLon,approximate:false};
 const id=String(item.id||'');
 let hash=2166136261;
 for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619)>>>0;
 const angle=hash/2**32*Math.PI*2,km=Math.min(Math.max(Number(area.radius_km)||5,1),25)*.56;
 const latitude=Number(area.latitude)+Math.sin(angle)*km/111.3;
 const longitude=Number(area.longitude)+Math.cos(angle)*km/(111.3*Math.max(.2,Math.cos(latitude*Math.PI/180)));
 return {latitude,longitude,approximate:true};
}
export default function HostingAreaMap({areas=[],listings=[],onSelect,onSearchBounds,focusAreaId='',highlightedIds=[],showTravel=true}){
 const element=useRef(null),drag=useRef(null),lastTap=useRef(null),interacted=useRef(false),viewRef=useRef(null),searchRef=useRef(onSearchBounds);
 const [size,setSize]=useState({width:700,height:450});
 const [view,setView]=useState({center:{longitude:-118.24368,latitude:34.05223},zoom:10});
 const [selected,setSelected]=useState('');
 viewRef.current=view;searchRef.current=onSearchBounds;
 const highlighted=useMemo(()=>new Set(highlightedIds),[highlightedIds]);
 const areaById=useMemo(()=>new Map(areas.map(a=>[a.id,a])),[areas]);
 const pins=useMemo(()=>listings.flatMap(item=>{
  const area=areaById.get(item.public_area_id);
  if(!area||area.approved===false)return [];
  const coordinates=offsetFromArea(item,area);
  return [{item,area,...coordinates}];
 }),[listings,areaById]);
 useEffect(()=>{
  const node=element.current;if(!node)return;
  const resize=()=>setSize({width:node.clientWidth||700,height:node.clientHeight||450});
  resize();
  const observer=new ResizeObserver(resize);observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const a=areaById.get(focusAreaId);
  if(!a)return;
  interacted.current=true;
  const next={center:{longitude:Number(a.longitude),latitude:Number(a.latitude)},zoom:11};
  viewRef.current=next;setView(next);setSelected('');
 },[focusAreaId,areaById]);
 const zoomAt=useCallback((direction,point)=>{
  const before=viewRef.current||view;
  const nextZoom=clamp(before.zoom+direction,3,16);
  if(nextZoom===before.zoom)return;
  const rect=element.current?.getBoundingClientRect();
  const relativeX=rect&&point?clamp(point.clientX-rect.left,0,rect.width):size.width/2;
  const relativeY=rect&&point?clamp(point.clientY-rect.top,0,rect.height):size.height/2;
  const centerPx=project(before.center.longitude,before.center.latitude,before.zoom);
  const focusGeo=unproject(centerPx.x+relativeX-size.width/2,centerPx.y+relativeY-size.height/2,before.zoom);
  const nextFocusPx=project(focusGeo.longitude,focusGeo.latitude,nextZoom);
  const nextCenter=unproject(nextFocusPx.x-relativeX+size.width/2,nextFocusPx.y-relativeY+size.height/2,nextZoom);
  const next={center:nextCenter,zoom:nextZoom};
  viewRef.current=next;interacted.current=true;setView(next);
 },[size.height,size.width,view]);
 // React's synthetic wheel handler may be passive. Explicit non-passive wheel
 // interception prevents the page from scrolling while the map alone zooms.
 useEffect(()=>{
  const node=element.current;if(!node)return;
  const onWheel=e=>{
   if(e.cancelable)e.preventDefault();
   e.stopPropagation();
   zoomAt(e.deltaY<0?1:-1,e);
  };
  node.addEventListener('wheel',onWheel,{passive:false});
  return()=>node.removeEventListener('wheel',onWheel);
 },[zoomAt]);
 // Requery public area centers after pan/zoom settles, never on every wheel tick.
 useEffect(()=>{
  if(!interacted.current)return;
  const t=setTimeout(()=>searchRef.current?.(mapBounds(view.center,size.width,size.height,view.zoom)),650);
  return()=>clearTimeout(t);
 },[view.center.longitude,view.center.latitude,view.zoom,size.width,size.height]);
 const dragStart=e=>{
  if(e.target.closest('button,a'))return;
  drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const dragMove=e=>{
  const d=drag.current;
  if(!d||e.pointerId!==d.pointerId)return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(!dx&&!dy)return;
  if(Math.abs(dx)+Math.abs(dy)>3)d.moved=true;
  d.x=e.clientX;d.y=e.clientY;
  const current=viewRef.current;
  const px=project(current.center.longitude,current.center.latitude,current.zoom);
  const nextCenter=unproject(px.x-dx,px.y-dy,current.zoom);
  const next={center:nextCenter,zoom:current.zoom};
  viewRef.current=next;setView(next);interacted.current=true;
 };
 const dragEnd=e=>{
  const d=drag.current;drag.current=null;
  if(!d)return;
  if(e.pointerType==='touch'&&!d.moved){
   const now=Date.now(),last=lastTap.current;
   if(last&&now-last.at<370&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<26){
    lastTap.current=null;zoomAt(1,e);
   }else lastTap.current={at:now,x:e.clientX,y:e.clientY};
  }else lastTap.current=null;
 };
 const {center,zoom}=view;
 const mapProjection=project(center.longitude,center.latitude,zoom);
 const bounds=mapBounds(center,size.width,size.height,zoom);
 const template=import.meta.env.VITE_HOSTING_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const attribution=String(import.meta.env.VITE_HOSTING_MAP_ATTRIBUTION||'').slice(0,200);
 const validTiles=typeof template==='string'&&template.startsWith('https://')&&['{z}','{x}','{y}'].every(t=>template.includes(t));
 const tiles=useMemo(()=>{
  if(!validTiles)return [];
  const origin=project(center.longitude,center.latitude,zoom),n=2**zoom,out=[];
  const x0=Math.floor((origin.x-size.width/2)/256)-1,x1=Math.floor((origin.x+size.width/2)/256)+1;
  const y0=Math.floor((origin.y-size.height/2)/256)-1,y1=Math.floor((origin.y+size.height/2)/256)+1;
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   if(y<0||y>=n)continue;
   out.push({key:zoom+'-'+x+'-'+y,url:template.replace('{z}',String(zoom)).replace('{x}',String(((x%n)+n)%n)).replace('{y}',String(y)),
    left:x*256-(origin.x-size.width/2),top:y*256-(origin.y-size.height/2)});
  }
  return out;
 },[center.longitude,center.latitude,zoom,size.width,size.height,template,validTiles]);
 const visiblePins=pins.filter(pin=>inside(bounds,{longitude:pin.longitude,latitude:pin.latitude}));
 return <section className="space-y-2" aria-label={showTravel?"Interactive guest rental map":"Interactive host market map"}>
  <div ref={element} role="application" tabIndex={0} aria-label="Map: scroll over the map or double-click to zoom, drag to pan. Use plus, minus or north buttons."
   className="oh-area-map-canvas relative h-[430px] overflow-hidden rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] touch-none select-none cursor-grab active:cursor-grabbing"
   style={{overscrollBehavior:'contain'}}
   onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={()=>{drag.current=null;}}
   onDoubleClick={e=>{e.preventDefault();zoomAt(1,e);}}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1);}if(e.key==='-'){e.preventDefault();zoomAt(-1);}}}>
   <div className="pointer-events-none absolute inset-0">
    {tiles.map(tile=><img key={tile.key} src={tile.url} alt="" loading="lazy" draggable={false}
      referrerPolicy="strict-origin-when-cross-origin" className="absolute h-64 w-64 max-w-none" style={{left:tile.left,top:tile.top}}/>)}
   </div>
   {visiblePins.map(pin=>{
    const xy=project(pin.longitude,pin.latitude,zoom),Icon=iconFor(pin.item.category);
    const left=xy.x-mapProjection.x+size.width/2,top=xy.y-mapProjection.y+size.height/2;
    const own=highlighted.has(pin.item.id);
    return <button type="button" key={pin.item.id} onPointerDown={e=>e.stopPropagation()}
      onClick={()=>{setSelected(pin.item.id);onSelect?.(pin.item.id);}}
      title={pin.item.title+' · '+(pin.approximate?'Approximate public area':'Host-shared public location')}
      aria-label={pin.item.category.replaceAll('_',' ')+' · '+pin.item.title+' · '+(pin.approximate?'Approximate location':'Public address shared')}
      className={'absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 shadow-lg transition hover:scale-110 '+(selected===pin.item.id?'border-fuchsia-500 bg-white text-fuchsia-700':own?'border-cyan-500 bg-white text-cyan-700':'border-violet-500 bg-white text-violet-700')}
      style={{left,top}}>
      <Icon size={21} aria-hidden="true"/>
    </button>;
   })}
   <div className="absolute right-3 top-3 z-30 flex flex-col gap-1" aria-label="Map controls">
    <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--cc-border)] bg-white text-slate-800 shadow" aria-label="Zoom in" onClick={()=>zoomAt(1)}><Plus size={19}/></button>
    <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--cc-border)] bg-white text-slate-800 shadow" aria-label="Zoom out" onClick={()=>zoomAt(-1)}><Minus size={19}/></button>
    <div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--cc-border)] bg-white text-slate-800 shadow" role="img" aria-label="Compass showing north at top"><Compass size={19}/></div>
   </div>
   {!validTiles&&<div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-3 py-2 text-xs">Map provider configuration needed.</div>}
  </div>
  <p className="text-[11px] leading-5 text-[var(--cc-text-secondary)]">
   Map pins show approved property categories. Most pins are intentionally offset within a city or neighborhood rather than showing a private street address.
   Public addresses appear only when a host explicitly chooses to share them.
   {visiblePins.length===0?' No approved properties are mapped in this view yet.':''}
  </p>
  <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-[var(--cc-text-secondary)]">
   <span>Map data © <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>{attribution&&' · '+attribution}</span>
   <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className="underline">Report a map issue</a>
  </div>
  {visiblePins.length>0&&<div className="flex flex-wrap gap-2" aria-label="Spaces visible in this map view">
   {visiblePins.slice(0,50).map(({item,approximate})=><button key={item.id} type="button"
    className="min-h-10 rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 text-xs hover:border-cyan-400"
    onClick={()=>onSelect?.(item.id)}>{item.title} · {item.daily_rate!=null?money(item.daily_rate):'Day rate unavailable'}/day {approximate?'· approximate':''}</button>)}
  </div>}
 </section>;
}
