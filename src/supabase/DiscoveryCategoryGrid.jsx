/** The same professional categories and labels as the signed-out homepage.
 * On phones the complete tile grid is a collapsible accordion, not a
 * horizontal scroller. Desktop always shows every category tile.
 */
import React,{useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {CategoryArtwork,DISCOVERY_CATEGORIES} from './CategoryArtwork';
import {PUBLIC_DISCOVERY_DETAILS} from './publicDiscoveryDetails.mjs';
const labelOf=item=>PUBLIC_DISCOVERY_DETAILS[item.key]?.label||item.label;
export default function DiscoveryCategoryGrid({value='',onSelect=(_item)=>{void _item;}}){
 const [expanded,setExpanded]=useState(false);
 const active=DISCOVERY_CATEGORIES.find(item=>item.key===value);
 return <section className="space-y-3" data-discovery-category-grid="true">
  <button type="button"
   className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-3 text-left text-[var(--cc-text-primary)] md:hidden"
   aria-expanded={expanded} aria-controls="ccx-discovery-category-options"
   onClick={()=>setExpanded(open=>!open)}>
   <span className="min-w-0"><span className="block text-sm font-semibold">Browse professional categories</span>
    <span className="mt-0.5 block truncate text-xs text-[var(--cc-text-secondary)]">{active?labelOf(active):'Tap to view all categories'}</span></span>
   <ChevronDown size={20} className={'shrink-0 transition-transform '+(expanded?'rotate-180':'')} aria-hidden="true"/>
  </button>
  <nav id="ccx-discovery-category-options" aria-label="Browse professional categories"
   className={(expanded?'grid':'hidden')+' w-full min-w-0 grid-cols-3 gap-2 sm:grid-cols-4 md:grid md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6'}>
   {DISCOVERY_CATEGORIES.map(item=>{
    const selected=value===item.key;
    return <button type="button" key={item.key} aria-pressed={selected}
     aria-label={'Show '+labelOf(item)}
     onClick={()=>onSelect(item)}
     className={'flex min-h-[116px] min-w-0 flex-col items-center justify-start gap-1 rounded-xl border px-1.5 py-2.5 text-center text-[11px] font-semibold leading-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-link)] sm:min-h-[124px] sm:text-xs '+(selected?'border-[var(--cc-link)] bg-[var(--cc-accent-surface)] text-[var(--cc-link)] shadow-sm':'border-[var(--cc-border)] bg-[var(--cc-surface)] text-[var(--cc-text-primary)] hover:border-[var(--cc-link)] hover:shadow-sm')}>
     <CategoryArtwork item={item} size={64}/>
     <span className="min-w-0 break-words">{labelOf(item)}</span>
    </button>;
   })}
  </nav>
 </section>;
}
