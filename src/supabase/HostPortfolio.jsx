/** Owner actions and actual listings; no demo properties or invented activity. */
import React,{useEffect,useRef,useState} from 'react';
import {Building2,Plus,Settings2,MapPinned,ArrowUpRight,ChevronLeft,ChevronRight,ImageIcon,Heart,Star} from 'lucide-react';
import {usd} from './hostingApi';

/** @param {{listing:any,onOpen:(id:string)=>void,host?:boolean,favorite?:boolean,onFavorite?:(id:string)=>void}} props */
export function PropertyPreviewCard({listing,onOpen,host=false,favorite=false,onFavorite}){
 const [index,setIndex]=useState(0);
 const photos=listing.photos||[];
 const photo=photos[Math.min(index,Math.max(0,photos.length-1))];
 const next=direction=>setIndex(current=>(current+direction+photos.length)%photos.length);
 return <article className="oh-property-preview">
  <div className="oh-property-preview-image">
   <button type="button" className="oh-property-photo-link" onClick={()=>onOpen(listing.id)} aria-label={'Open '+listing.title}>
    {photo?.url?<img src={photo.url} alt={photo.caption||listing.title} loading="lazy"/>:
     <span className="oh-property-placeholder"><ImageIcon size={34}/><span>{host?'Add property photos':'Photos awaiting approval'}</span></span>}
   </button>
   {host&&<span className="oh-property-status">{String(listing.status||'draft').replaceAll('_',' ')}</span>}
   {onFavorite&&<button type="button" className="oh-property-heart" onClick={()=>onFavorite(listing.id)} aria-label={favorite?'Remove from saved properties':'Save property'} aria-pressed={favorite}>
    <Heart size={21} fill={favorite?'currentColor':'none'}/></button>}
   {photos.length>1&&<><button type="button" className="oh-photo-step oh-photo-step-prev" onClick={()=>next(-1)} aria-label={'Previous photo of '+listing.title}><ChevronLeft size={16}/></button>
    <button type="button" className="oh-photo-step oh-photo-step-next" onClick={()=>next(1)} aria-label={'Next photo of '+listing.title}><ChevronRight size={16}/></button>
    <span className="oh-photo-dots" aria-hidden="true">{photos.slice(0,5).map((p,i)=><i key={p.id||i} className={i===index?'is-active':''}/>)}</span></>}
  </div>
  <button type="button" className="oh-property-preview-info" onClick={()=>onOpen(listing.id)}>
   <span className="oh-property-title-line"><strong>{listing.title}</strong>{listing.rating_count>0&&<span><Star size={13}/>{listing.rating_average}</span>}</span>
   <span className="oh-property-location">{listing.public_address||[listing.city,listing.state,listing.country].filter(Boolean).join(', ')||'Location not added'}</span>
   <span className="oh-property-facts">{listing.capacity||0} people · {listing.minimum_hours||1}-hour minimum</span>
   <span className="oh-property-price"><strong>{usd(listing.hourly_rate)}</strong> / hour <ArrowUpRight size={16}/></span>
  </button>
 </article>;
}

/** @param {{listings:any[],onSelect:(listing:any)=>void,onNew:()=>void,onDefaults:()=>void,onMap:()=>void,busy?:boolean}} props */
export default function HostPortfolio({listings,onSelect,onNew,onDefaults,onMap,busy=false}){
 const track=useRef(/** @type {HTMLDivElement|null} */(null));
 const [position,setPosition]=useState({left:false,right:false});
 const update=()=>{
  const node=track.current;if(!node)return;
  setPosition({left:node.scrollLeft>3,right:node.scrollLeft+node.clientWidth<node.scrollWidth-3});
 };
 useEffect(()=>{
  const node=track.current;if(!node)return;
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[listings.length]);
 const scroll=direction=>{
  const node=track.current;if(!node)return;
  node.scrollBy({left:direction*node.clientWidth*.85,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 return <div className="oh-portfolio-row">
  <aside className="oh-listings-actions">
   <div><span className="oh-section-kicker">HOST WORKSPACE</span><h2><Building2 size={22}/>Your Listings <span>{listings.length}</span></h2>
    <p>One home for your spaces. Start a listing, set your rules, or explore your local market.</p></div>
   <div className="oh-action-stack">
    <button type="button" className="oh-new-space-action" onClick={onNew} disabled={busy}>
     <span className="oh-action-icon"><Plus size={24}/></span><span><strong>New Space</strong><small>Turn your property into a listing</small></span><ArrowUpRight size={20}/>
    </button>
    <button type="button" className="oh-workspace-action" onClick={onDefaults} disabled={busy}><Settings2 size={20}/><span><strong>Set Default Rules</strong><small>Save time on your next listing</small></span><ChevronRight size={16}/></button>
    <button type="button" className="oh-workspace-action" onClick={onMap}><MapPinned size={20}/><span><strong>View Local Market</strong><small>Compare nearby asking prices</small></span><ChevronRight size={16}/></button>
   </div>
   <p className="oh-actions-footnote">Your property. Your rules. Your pricing.</p>
  </aside>
  <section className="oh-portfolio-panel" aria-label="Your property carousel">
   <header className="oh-portfolio-heading"><div><span className="oh-section-kicker">YOUR PORTFOLIO</span><h2>Your properties, all in one place</h2><p>Select a space to edit its details, photos and availability.</p></div>
    <div className="oh-carousel-controls"><button type="button" className="oh-circle-control" disabled={!position.left} onClick={()=>scroll(-1)} aria-label="Previous properties"><ChevronLeft size={18}/></button>
     <button type="button" className="oh-circle-control" disabled={!position.right} onClick={()=>scroll(1)} aria-label="Next properties"><ChevronRight size={18}/></button></div>
   </header>
   {listings.length?<div ref={track} onScroll={update} className="oh-property-carousel" role="region" aria-roledescription="carousel" aria-label="Your listings" tabIndex={0}>
    {listings.map(item=><div key={item.id} className="oh-property-slide"><PropertyPreviewCard listing={item} host onOpen={()=>onSelect(item)}/></div>)}
   </div>:<div className="oh-portfolio-empty"><span><Building2 size={40}/></span><h3>Your next opportunity starts with a space</h3><p>Click <strong>New Space</strong> to add your first property. Your photos and listing details will appear here.</p></div>}
  </section>
 </div>;
}
