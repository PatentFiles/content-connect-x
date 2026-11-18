/** Shared live amenity catalog. Custom labels are text, not executable markup. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Check,Plus,SlidersHorizontal} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {rentalAmenities} from './hostingApi';
export function usePropertyAmenities(){
 const [amenities,setAmenities]=useState(rentalAmenities.map(([key,label])=>({key,label,category:'standard'})));
 const [error,setError]=useState('');
 const generation=useRef(0);
 const reload=useCallback(async()=>{const request=++generation.current;const all=[];
  for(let start=0;;start+=1000){
   const {data,error}=await supabase.from('property_amenity_catalog').select('key,label,category').eq('active',true).order('category').order('label').range(start,start+999);
   if(request!==generation.current)return;
   if(error){setError('The live amenity catalog could not be loaded. '+error.message);return;}
   all.push(...(data||[]));if(!data||data.length<1000)break;
  }
  setError('');setAmenities(all);
 },[]);
 useEffect(()=>{void reload();const update=()=>void reload();window.addEventListener('ccx-amenities-changed',update);return()=>window.removeEventListener('ccx-amenities-changed',update);},[reload]);
 return {amenities,error,reload};
}
/** @param {{values:string[],onChange:(v:string[])=>void,allowCustom?:boolean,expanded?:boolean,title?:string}} props */
export default function PropertyAmenities({values=[],onChange,allowCustom=false,expanded=false,title='Amenities'}){
 const {amenities,error:loadError,reload}=usePropertyAmenities();
 const [other,setOther]=useState(''),[adding,setAdding]=useState(false),[error,setError]=useState('');
 const add=async()=>{setAdding(true);setError('');try{const {data,error}=await supabase.rpc('ccx_add_property_amenity',{p_label:other});if(error)throw error;
  onChange([...new Set([...values,data.key])]);setOther('');await reload();window.dispatchEvent(new Event('ccx-amenities-changed'));
 }catch(e){setError(e.message);}finally{setAdding(false);}};
 return <details className="oh-amenity-panel" open={expanded||undefined}>
  <summary><span><SlidersHorizontal size={18}/>{title}</span><small>{values.length?values.length+' selected':'Expand all options'}</small></summary>
  <div className="oh-amenity-content">
   {loadError&&<p role="alert" className="oh-inline-error">{loadError}<button type="button" onClick={()=>void reload()} className="ml-2 underline">Retry</button></p>}
   <div className="oh-amenity-grid">{amenities.map(item=><button type="button" key={item.key} className={'oh-option-tile '+(values.includes(item.key)?'oh-option-selected':'oh-option-idle')} role="checkbox" aria-checked={values.includes(item.key)} onClick={()=>onChange(values.includes(item.key)?values.filter(v=>v!==item.key):[...values,item.key])}>
    <span>{item.label}</span><span className="oh-option-check" aria-hidden="true">{values.includes(item.key)&&<Check size={15}/>}</span>
   </button>)}</div>
   {allowCustom&&<div className="oh-add-amenity"><label><strong>Other — add an amenity</strong><span>This becomes a reusable option for future listings. Allowed production activities are set separately.</span><input value={other} maxLength={70} placeholder="For example: Heated outdoor shower" onChange={e=>setOther(e.target.value)}/></label><button type="button" className="oh-gallery-primary" disabled={adding||other.trim().length<2} onClick={add}><Plus size={17}/>{adding?'Adding…':'Add amenity'}</button></div>}
   {error&&<p role="alert" className="oh-inline-error">{error}</p>}
  </div>
 </details>;
}
