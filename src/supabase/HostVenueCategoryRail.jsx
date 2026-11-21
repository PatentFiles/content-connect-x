/** Airbnb-like centered category navigation for the live Host Connect venue inventory.
 * The category ID (not the image name or display label) controls the filter.
 * Unuploaded art leaves an empty fixed-height slot; it never shows a generic icon.
 */
import React,{useEffect,useState} from 'react';
import {HOST_VENUE_CATEGORIES} from './hostVenueCategories.mjs';

function VenueArtwork({item}){
 const [missing,setMissing]=useState(false);
 useEffect(()=>setMissing(false),[item.image]);
 return <span className="flex h-[70px] w-full shrink-0 items-center justify-center" aria-hidden="true">
  {item.image&&!missing&&<img src={item.image} alt="" loading="lazy" decoding="async"
   onError={()=>setMissing(true)} className="h-[66px] w-[78px] object-contain"/>}
 </span>;
}
export default function HostVenueCategoryRail({selected='',onSelect=(_id)=>{void _id;}}){
 return <nav aria-label="Property categories" data-ccx-property-category-rail="true" className="w-full overflow-x-auto overscroll-x-contain">
  <div className="mx-auto flex w-max min-w-full items-start justify-center gap-1 px-2 py-3 sm:gap-3 lg:max-w-[1550px] lg:flex-wrap">
   {HOST_VENUE_CATEGORIES.map(item=>{
    const active=selected===item.id;
    return <button key={item.id||'all'} type="button" aria-pressed={active}
     onClick={()=>onSelect(item.id)}
     className={'flex min-h-[120px] w-[102px] shrink-0 flex-col items-center justify-start gap-1 border-b-[3px] px-2 py-1 text-center text-xs font-semibold leading-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12698f] sm:w-[110px] '+(active?'border-[#12698f] text-[#12698f]':'border-transparent text-[#435c6d] hover:border-[#b3cbd9]')}>
     <VenueArtwork item={item}/>
     <span>{item.label}</span>
    </button>;
   })}
  </div>
 </nav>;
}
