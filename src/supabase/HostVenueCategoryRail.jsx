/** Accessible multi-select venue shortcuts. Quick grid never scrolls on mobile;
 * dropdown checkboxes and full Filters share the exact same controlled IDs.
 */
import React,{useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,X} from 'lucide-react';
import {HOST_VENUE_CATEGORIES,HOST_VENUE_QUICK_LINKS} from './hostVenueCategories.mjs';

function VenueArtwork({item}){
 const [missing,setMissing]=useState(false);
 useEffect(()=>setMissing(false),[item.image]);
 return <span className="grid h-[58px] w-full shrink-0 place-items-center sm:h-[68px]" aria-hidden="true">
  {item.image&&!missing&&<img src={item.image} alt="" loading="lazy" decoding="async"
   onError={()=>setMissing(true)} className="h-[56px] w-[68px] max-w-full object-contain sm:h-[66px] sm:w-[78px]"/>}
 </span>;
}
export default function HostVenueCategoryRail({selectedTypes=[],onChangeTypes=(_ids)=>{void _ids;}}){
 const [open,setOpen]=useState(false);
 const dropdownRef=useRef(null),triggerRef=useRef(null);
 useEffect(()=>{
  if(!open)return;
  const onPointer=event=>{
   if(!dropdownRef.current?.contains(event.target)&&!triggerRef.current?.contains(event.target))setOpen(false);
  };
  const onKey=event=>{
   if(event.key==='Escape'){event.stopPropagation();setOpen(false);triggerRef.current?.focus();}
  };
  document.addEventListener('pointerdown',onPointer);
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onKey);};
 },[open]);
 const toggle=id=>{
  const next=selectedTypes.includes(id)?selectedTypes.filter(key=>key!==id):[...selectedTypes,id];
  onChangeTypes(next);
 };
 const selectedLabel=!selectedTypes.length?'All property types':
  selectedTypes.length===1?HOST_VENUE_CATEGORIES.find(v=>v.id===selectedTypes[0])?.label||'1 selected':
  selectedTypes.length+' property types selected';
 return <section className="space-y-3" data-ccx-property-category-rail="true">
  <nav aria-label="Property category quick links" className="w-full min-w-0">
   <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 lg:gap-3">
    {HOST_VENUE_QUICK_LINKS.map(item=>{
     const active=selectedTypes.includes(item.id);
     return <button key={item.id} type="button" aria-pressed={active}
      aria-label={'Toggle '+item.label.toLowerCase()+' venues'}
      onClick={()=>toggle(item.id)}
      className={'relative flex min-h-[112px] min-w-0 flex-col items-center justify-start gap-1 rounded-xl border px-1.5 py-2 text-center text-[11px] font-semibold leading-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12698f] sm:min-h-[122px] sm:px-2 sm:text-xs '+(active?'border-[#12698f] bg-[#e8f5fc] text-[#12698f] shadow-sm':'border-[#e1e9ef] bg-white text-[#435c6d] hover:border-[#91bdd5] hover:shadow-sm')}>
      {active&&<span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#12698f] text-white"><Check size={13} aria-hidden="true"/></span>}
      <VenueArtwork item={item}/>
      <span className="min-w-0 break-words">{item.label}</span>
     </button>;
    })}
   </div>
  </nav>
  <div className="flex flex-wrap items-end gap-3">
   <div className="relative min-w-0 flex-1 sm:max-w-[340px]">
    <span className="block text-xs font-semibold text-[#36576a]">More property types</span>
    <button ref={triggerRef} type="button" aria-haspopup="true" aria-expanded={open}
     aria-controls="ccx-venue-category-options"
     onClick={()=>setOpen(value=>!value)}
     className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#cbdde8] bg-white px-3 text-left text-sm text-[#193246] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12698f]">
     <span className="min-w-0 truncate">{selectedLabel}</span>
     <ChevronDown size={17} className={'shrink-0 transition-transform '+(open?'rotate-180':'')} aria-hidden="true"/>
    </button>
    {open&&<div id="ccx-venue-category-options" ref={dropdownRef} role="group"
     aria-label="Select multiple property types"
     className="absolute left-0 top-full z-40 mt-2 w-full max-h-[min(65vh,450px)] overflow-y-auto overscroll-contain rounded-xl border border-[#bcd3e1] bg-white p-2 shadow-2xl">
     <div className="flex items-center justify-between gap-3 border-b border-[#e3ecf2] px-2 py-2">
      <span className="text-xs font-semibold text-[#3d6177]">{selectedTypes.length} selected</span>
      <button type="button" onClick={()=>onChangeTypes([])} disabled={!selectedTypes.length}
       className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#12698f] disabled:opacity-40">
       <X size={15} aria-hidden="true"/>Clear</button>
     </div>
     {HOST_VENUE_CATEGORIES.map(item=><label key={item.id}
      className="ccx-choice-row flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-sm text-[#1f3b4b] hover:bg-[#ecf7fd]">
      <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#12698f]"
       checked={selectedTypes.includes(item.id)} onChange={()=>toggle(item.id)}/>
      <span className="min-w-0 flex-1">{item.label}</span>
     </label>)}
     <button type="button" onClick={()=>{setOpen(false);triggerRef.current?.focus();}}
      className="mt-2 min-h-11 w-full rounded-lg bg-[#12698f] px-3 text-sm font-semibold text-white">Done</button>
    </div>}
   </div>
   {selectedTypes.length>0&&<button type="button" onClick={()=>onChangeTypes([])}
    className="min-h-11 rounded-xl px-3 text-xs font-semibold text-[#12698f] hover:bg-[#ecf7fd]">
    Clear categories</button>}
  </div>
 </section>;
}
