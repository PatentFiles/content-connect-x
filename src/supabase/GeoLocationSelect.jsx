/** Shared global country / state / city selector.
 * Data: @countrystatecity/countries-browser 3.0.1; ODbL 1.0 (see
 * https://countrystatecity.in). Data is fetched lazily from version-pinned
 * public CDN shards, not copied into this application's databases.
 */
import React,{useEffect,useMemo,useState} from 'react';
const BASE='https://cdn.jsdelivr.net/npm/@countrystatecity/countries-browser@3.0.1/dist/data/';
const memory=new Map();
async function load(path){
 if(!/^(countries\.json|states\/[A-Z]{2}\.json|cities\/[A-Z]{2}(?:-[A-Z0-9-]{1,6})?\.json)$/.test(path))
  throw Error('Invalid geography shard');
 if(!memory.has(path)){
  const promise=fetch(BASE+path,{cache:'force-cache',signal:AbortSignal.timeout(14000)})
   .then(r=>{if(!r.ok)throw Error('Location catalog unavailable');return r.json();})
   .then(rows=>{if(!Array.isArray(rows))throw Error('Invalid location catalog');return rows;})
   .catch(e=>{memory.delete(path);throw e;});
  memory.set(path,promise);
 }
 return memory.get(path);
}
/** @type {{country:string,countryCode:string,state:string,stateCode:string,city:string,latitude:number|null,longitude:number|null,timezone:string}} */
export const EMPTY_GEO=Object.freeze({country:'',countryCode:'',state:'',stateCode:'',city:'',latitude:null,longitude:null,timezone:''});
const norm=x=>String(x||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const control='w-full min-h-11 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--cc-focus)] disabled:opacity-60';
export default function GeoLocationSelect({value=EMPTY_GEO,onChange=(_next)=>{void _next;},required=false,compact=false,allowAny=false,disabled=false,labels=true,idPrefix='location'}){
 const [countries,setCountries]=useState([]),[states,setStates]=useState([]),[cities,setCities]=useState([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState('countries'),[retry,setRetry]=useState(0);
 const selectedCountry=useMemo(()=>countries.find(c=>c.iso2===value.countryCode||norm(c.name)===norm(value.country)),[countries,value.countryCode,value.country]);
 const countryCode=selectedCountry?.iso2||'';
 const selectedState=useMemo(()=>states.find(c=>c.iso2===value.stateCode||norm(c.name)===norm(value.state)),[states,value.stateCode,value.state]);
 const stateCode=selectedState?.iso2||'';
 useEffect(()=>{
  let active=true;setLoading('countries');
  load('countries.json').then(rows=>{if(active){setCountries(rows);setLoading('');setError('');}})
   .catch(()=>{if(active){setLoading('');setError('Country list unavailable.');}});
  return()=>{active=false;};
 },[retry]);
 useEffect(()=>{
  if(!countryCode){setStates([]);setCities([]);return;}
  let active=true;setLoading('states');
  load('states/'+countryCode+'.json').then(rows=>{if(active){setStates(rows);setLoading('');setError('');}})
   .catch(()=>{if(active){setStates([]);setLoading('');setError('State list unavailable.');}});
  return()=>{active=false;};
 },[countryCode,retry]);
 useEffect(()=>{
  if(!countryCode||(states.length>0&&!stateCode)){setCities([]);return;}
  let active=true;setLoading('cities');
  load('cities/'+countryCode+(stateCode?'-'+stateCode:'')+'.json')
   .then(rows=>{if(active){setCities(rows);setLoading('');setError('');}})
   .catch(()=>{if(active){setCities([]);setLoading('');setError('City list unavailable.');}});
  return()=>{active=false;};
 },[countryCode,stateCode,states.length,retry]);
 const chooseCountry=e=>{
  const match=countries.find(c=>c.iso2===e.target.value);
  onChange(match?{...EMPTY_GEO,country:match.name,countryCode:match.iso2}:{...EMPTY_GEO});
 };
 const chooseState=e=>{
  const match=states.find(c=>c.iso2===e.target.value);
  onChange({...value,state:match?.name||'',stateCode:match?.iso2||'',city:'',latitude:null,longitude:null,timezone:match?.timezone||''});
 };
 const chooseCity=e=>{
  const match=cities.find(c=>String(c.id)===e.target.value);
  onChange({...value,city:match?.name||'',latitude:match?Number(match.latitude):null,longitude:match?Number(match.longitude):null,timezone:match?.timezone||value.timezone||''});
 };
 const currentCity=cities.find(c=>norm(c.name)===norm(value.city));
 const make=(title,options,current,onSelect,locked)=>{
  const placeholder=loading?'Loading locations…':(allowAny?'Any ':'Choose ')+title.toLowerCase();
  return <label className="block min-w-0 text-xs font-medium">
   {labels&&<span className="mb-1 block text-[var(--cc-text-secondary)]">{title}</span>}
   <select className={control} id={idPrefix+'-'+title.toLowerCase()} aria-label={title}
    value={current} onChange={onSelect} required={required&&!locked} disabled={disabled||locked||!!loading}>
    <option value="">{placeholder}</option>
    {options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}
   </select>
  </label>;
 };
 return <div data-geo-selector="country-state-city" className="w-full">
  <div className={'grid gap-2 '+(compact?'grid-cols-1 sm:grid-cols-3':'grid-cols-1 md:grid-cols-3')}>
   {make('Country',countries.map(c=>({value:c.iso2,label:c.name})).sort((a,b)=>a.value==='US'?-1:b.value==='US'?1:a.label.localeCompare(b.label)),countryCode,chooseCountry,false)}
   {make('State',states.map(c=>({value:c.iso2,label:c.name})),stateCode,chooseState,!countryCode||states.length===0)}
   {make('City',cities.map(c=>({value:String(c.id),label:c.name})),currentCity?String(currentCity.id):'',chooseCity,!countryCode||(states.length>0&&!stateCode))}
  </div>
  {error&&<p className="mt-2 text-xs text-[var(--cc-text-secondary)]" role="alert">{error} <button type="button" className="underline text-[var(--cc-link)]" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>}
 </div>;
}
