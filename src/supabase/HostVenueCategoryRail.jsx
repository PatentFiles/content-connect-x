/** Nine accessible quick links in a wrapping grid (including on phones).
 * A native dropdown offers every backend-supported searchable venue type.
 * Never infer a filter from an image filename: category IDs are authoritative.
 */
import React,{useEffect,useState} from 'react';
import {HOST_VENUE_CATEGORIES,HOST_VENUE_QUICK_LINKS} from './hostVenueCategories.mjs';

function VenueArtwork({item}){
 const [missing,setMissing]=useState(false);
 useEffect(()=>setMissing(false),[item.image]);
 return <span className="grid h-[58px] w-full shrink-0 place-items-center sm:h-[68px]" aria-hidden="true">
  {item.image&&!missing&&<img src={item.image} alt="" loading="lazy" decoding="async"
   onError={()=>setMissing(true)} className="h-[56px] w-[68px] max-w-full object-contain sm:h-[66px] sm:w-[78px]"/>}
 </span>;
}
export default function HostVenueCategoryRail({selected='',onSelect=(_id)=>{void _id;}}){
 return <section className="space-y-3" data-ccx-property-category-rail="true">
  <nav aria-label="Property category quick links" className="w-full min-w-0">
   <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 lg:gap-3">
    {HOST_VENUE_QUICK_LINKS.map(item=>{
     const active=selected===item.id;
     return <button key={item.id} type="button" aria-pressed={active}
      aria-label={'Find '+item.label.toLowerCase()+' venues'}
      onClick={()=>onSelect(active?'':item.id)}
      className={'flex min-h-[112px] min-w-0 flex-col items-center justify-start gap-1 rounded-xl border px-1.5 py-2 text-center text-[11px] font-semibold leading-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12698f] sm:min-h-[122px] sm:px-2 sm:text-xs '+(active?'border-[#12698f] bg-[#e8f5fc] text-[#12698f] shadow-sm':'border-[#e1e9ef] bg-white text-[#435c6d] hover:border-[#91bdd5] hover:shadow-sm')}>
      <VenueArtwork item={item}/>
      <span className="min-w-0 break-words">{item.label}</span>
     </button>;
    })}
   </div>
  </nav>
  <label htmlFor="ccx-venue-category-select" className="block text-xs font-semibold text-[#36576a]">
   More property types
   <select id="ccx-venue-category-select" value={selected}
    onChange={event=>onSelect(event.target.value)}
    className="mt-2 min-h-11 w-full rounded-xl border border-[#cbdde8] bg-white px-3 text-sm text-[#193246] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12698f] sm:max-w-[320px]">
    <option value="">All property types</option>
    {HOST_VENUE_CATEGORIES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
   </select>
  </label>
 </section>;
}
