/** Legacy listing tools render the exact same fixed feature catalog.
 * Arbitrary custom amenity additions are no longer offered. */
import React from 'react';
import {Check,SlidersHorizontal} from 'lucide-react';
import {PROPERTY_FEATURE_GROUPS} from '../../supabase/functions/_shared/propertyFeatureCatalog.mjs';
const amenities=PROPERTY_FEATURE_GROUPS.flatMap(group=>group.items.map(([key,label])=>({key,label,category:group.title})));
export function usePropertyAmenities(){return {amenities,error:'',reload:async()=>{}};}
/** @param {{values:string[],onChange:(v:string[])=>void,allowCustom?:boolean,expanded?:boolean,title?:string}} props */
export default function PropertyAmenities({values=[],onChange,expanded=false,title='Property features'}){
 const selected=values.filter(v=>amenities.some(a=>a.key===v));
 return <details className="oh-amenity-panel" open={expanded||undefined}>
  <summary><span><SlidersHorizontal size={18}/>{title}</span><small>{selected.length?selected.length+' selected':'Expand all options'}</small></summary>
  <div className="oh-amenity-content space-y-4">{PROPERTY_FEATURE_GROUPS.map(group=><fieldset key={group.title}><legend className="mb-2 font-semibold">{group.title}</legend>
   <div className="oh-amenity-grid">{group.items.map(([key,label])=><button type="button" key={key} className={'oh-option-tile '+(selected.includes(key)?'oh-option-selected':'oh-option-idle')} role="checkbox" aria-checked={selected.includes(key)} onClick={()=>onChange(selected.includes(key)?selected.filter(v=>v!==key):[...selected,key])}>
    <span>{label}</span><span className="oh-option-check" aria-hidden="true">{selected.includes(key)&&<Check size={15}/>}</span>
   </button>)}</div></fieldset>)}</div>
 </details>;
}
