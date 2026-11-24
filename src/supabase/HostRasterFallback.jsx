/** Low-volume compatibility map when WebGL cannot run. Only visible tiles
 * are requested. No prefetch, bulk download or private addresses.
 */
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,RefreshCw} from 'lucide-react';
import {project,unproject,mapBounds,clamp} from './hostingMapMath.mjs';
import {markerPosition,VENUE_ARTWORK,money,rentalPrice} from './hostMapPresentation.mjs';
export default function HostRasterFallback({properties=[],onOpen=(_id)=>{void _id;},onBounds=(_b)=>{void _b;},categorySelected=false,unit='day',onRetry=()=>{}}){
 const node=useRef(null),drag=useRef(null),callback=useRef(onBounds),changed=useRef(false),fitted=useRef(false);
 const [size,setSize]=useState({width:640,height:440}),[view,setView]=useState({longitude:-98.5,latitude:39.5,zoom:4});
 const [search,setSearch]=useState(true),[tileError,setTileError]=useState(false),[tileReady,setTileReady]=useState(false);
 callback.current=onBounds;
 useEffect(()=>{const el=node.current;if(!el)return;const measure=()=>setSize({width:el.clientWidth||640,height:el.clientHeight||440});measure();if(typeof ResizeObserver==='undefined')return;const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();},[]);
 useEffect(()=>{
  if(fitted.current||!properties.length)return;fitted.current=true;
  const first=markerPosition(properties[0]);if(!first)return;
  const sameCity=properties.every(p=>Math.abs(p.approx_lat-properties[0].approx_lat)<.5&&Math.abs(p.approx_lng-properties[0].approx_lng)<.5);
  if(sameCity)setView({longitude:first[0],latitude:first[1],zoom:10});
 },[properties]);
 const bounds=mapBounds(view,size.width,size.height,view.zoom);
 useEffect(()=>{if(!changed.current||!search)return;const timer=window.setTimeout(()=>callback.current(mapBounds(view,size.width,size.height,view.zoom)),450);return()=>window.clearTimeout(timer);},[view,size.width,size.height,search]);
 const origin=project(view.longitude,view.latitude,view.zoom);
 const tiles=useMemo(()=>{
  const n=2**view.zoom,arr=[],left=origin.x-size.width/2,top=origin.y-size.height/2;
  const x0=Math.floor(left/256),x1=Math.floor((left+size.width-1)/256),y0=Math.floor(top/256),y1=Math.floor((top+size.height-1)/256);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)if(x>=0&&x<n&&y>=0&&y<n)arr.push({key:view.zoom+'-'+x+'-'+y,url:'https://tile.openstreetmap.org/'+view.zoom+'/'+x+'/'+y+'.png',left:x*256-left,top:y*256-top});
  return arr;
 },[origin.x,origin.y,size.width,size.height,view.zoom]);
 const zoom=step=>{changed.current=true;setTileError(false);setView(v=>({...v,zoom:clamp(v.zoom+step,2,16)}));};
 const start=e=>{if(e.target.closest('button,a,input,label'))return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,origin};e.currentTarget.setPointerCapture(e.pointerId);};
 const end=e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)<4)return;changed.current=true;setTileError(false);setView(v=>({...v,...unproject(d.origin.x-dx,d.origin.y-dy,v.zoom)}));};
 return <div ref={node} className="relative min-h-[440px] overflow-hidden rounded-2xl bg-[#eef2f4] select-none" style={{height:'min(76vh, 760px)',touchAction:'none'}} data-host-road-map="true" data-map-renderer="raster" data-map-status={tileReady?'ready':'loading'} role="region" aria-label="Compatibility road map" onPointerDown={start} onPointerUp={end} onPointerCancel={()=>{drag.current=null;}}>
  <div className="pointer-events-none absolute inset-0">{tiles.map(t=><img key={t.key} src={t.url} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin" onLoad={()=>{setTileReady(true);setTileError(false);}} onError={()=>setTileError(true)} className="absolute h-64 w-64 max-w-none" style={{left:t.left,top:t.top,width:256,height:256,maxWidth:'none'}}/>)}</div>
  {properties.slice(0,100).map(p=>{const point=markerPosition(p);if(!point)return null;const xy=project(point[0],point[1],view.zoom),left=xy.x-origin.x+size.width/2,top=xy.y-origin.y+size.height/2;if(left<0||left>size.width||top<0||top>size.height)return null;return <button type="button" key={p.id} aria-label={p.title+' · approximate area'} onClick={()=>onOpen(p.id)} className="host-map-price-pin absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs font-bold text-[#193246] shadow" style={{left,top}}><img src={VENUE_ARTWORK[p.category]||VENUE_ARTWORK.other} alt="" className={categorySelected?'h-10 w-10 object-contain':'h-6 w-6 object-contain'}/>{!categorySelected&&money(rentalPrice(p,unit))}</button>;})}
  <div className="absolute left-3 top-3 z-20 space-y-2"><label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#193246] shadow"><input type="checkbox" checked={search} onChange={e=>setSearch(e.target.checked)}/>Search as I move the map</label>{!search&&<button type="button" className="rounded-lg bg-white px-3 py-2 text-sm shadow" onClick={()=>callback.current(bounds)}>Search this area</button>}</div>
  <div className="absolute right-3 top-3 z-20 flex flex-col rounded-xl bg-white shadow"><button type="button" aria-label="Zoom in" className="p-3 text-[#193246]" onClick={()=>zoom(1)}><Plus size={18}/></button><button type="button" aria-label="Zoom out" className="p-3 text-[#193246]" onClick={()=>zoom(-1)}><Minus size={18}/></button></div>
  {tileError&&<p role="status" className="absolute bottom-24 left-3 right-3 rounded-lg bg-white p-2 text-xs text-[#193246] shadow">Some map tiles are unavailable. The listing results remain accessible.</p>}
  <button type="button" className="absolute bottom-14 right-3 z-20 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#193246] shadow" onClick={onRetry}><RefreshCw size={13} className="inline mr-1"/>Retry OpenFreeMap</button>
  <p className="absolute inset-x-3 bottom-3 z-20 rounded-lg bg-white/95 p-2 text-center text-[11px] text-[#486379]">Compatibility map · approximate locations · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a></p>
 </div>;
}
