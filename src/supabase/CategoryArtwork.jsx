/** Shared visual language for HostConnect and Content Connect X.
 * Uses original transparent PNG/WebP artwork when deployed under /public.
 * No remote third-party artwork is loaded. Missing files degrade accessibly.
 */
import React,{useState} from 'react';
import {Home,Building2,Warehouse,Clapperboard,Camera,Landmark,Trees,Waves,LifeBuoy,Package,Users,Video,UserRound,Scissors,Palette,Shirt,Film,Briefcase,Layers} from 'lucide-react';

export const PROPERTY_CATEGORIES=[
 {key:'all',label:'All properties',category:'',icon:'all',Icon:Layers},
 {key:'house',label:'Houses',category:'house',icon:'house',Icon:Home},
 {key:'condo',label:'Condos',category:'condo',icon:'condo',Icon:Building2},
 {key:'warehouse',label:'Warehouses',category:'warehouse',icon:'commercial_warehouse',Icon:Warehouse},
 {key:'dungeon',label:'BDSM dungeons',category:'dungeon',icon:'bdsm_dungeon',Icon:Landmark},
 {key:'film_studio',label:'Production studios',category:'film_studio',icon:'production_studio',Icon:Clapperboard},
 {key:'photo_studio',label:'Photo studios',category:'photo_studio',icon:'photo_studio',Icon:Camera},
 {key:'private_beach',label:'Private beaches',category:'private_beach',icon:'private_beach',Icon:Waves},
 {key:'pool',label:'Outdoor pools',category:'',amenity:'pool',icon:'outdoor_pool',Icon:LifeBuoy},
 {key:'grass',label:'Grassy areas',category:'outdoor',icon:'outdoor_grassy_area',Icon:Trees},
 {key:'outdoor',label:'Outdoor areas',category:'outdoor',icon:'outdoor',Icon:Trees},
 {key:'set',label:'Production sets',category:'set',icon:'production_set',Icon:Film},
 {key:'equipment',label:'Equipment rentals',category:'equipment',icon:'equipment_rental',Icon:Package}
];
export const DISCOVERY_CATEGORIES=[
 {key:'all',label:'Everyone',role:'',icon:'all',Icon:Users},
 {key:'videographer',label:'Videographers',role:'videographer',icon:'videographer',Icon:Video},
 {key:'photographer',label:'Photographers',role:'photographer',icon:'photographer',Icon:Camera},
 {key:'female_creator',label:'Female creators',role:'creator',gender:'woman',icon:'creator_female',Icon:UserRound},
 {key:'male_creator',label:'Male creators',role:'creator',gender:'man',icon:'creator_male',Icon:UserRound},
 {key:'agent',label:'Agents',role:'agent',icon:'agent',Icon:Briefcase},
 {key:'studio',label:'Studios',role:'studio',icon:'studio',Icon:Clapperboard},
 {key:'director',label:'Directors / producers',role:'director_producer',icon:'director_producer',Icon:Film},
 {key:'hair',label:'Hair services',role:'hair_stylist',icon:'hair_service',Icon:Scissors},
 {key:'makeup',label:'Makeup services',role:'makeup_artist',icon:'makeup_service',Icon:Palette},
 {key:'wardrobe',label:'Wardrobe stylists',role:'wardrobe_stylist',icon:'wardrobe_stylist',Icon:Shirt},
 {key:'editor',label:'Video editors',role:'video_editor',icon:'video_editor',Icon:Film}
];
// Explicit naming aliases support the original artwork labels and common export names.
// Real images must exist under the deployed public directory.
const ALIASES={
 all:['globe','all_categories'],house:['home','houses'],condo:['condominium','condos'],
 commercial_warehouse:['warehouse'],bdsm_dungeon:['dungeon'],production_studio:['studio_production','film_studio','studio'],
 photo_studio:['photography_studio'],private_beach:['beach'],outdoor_pool:['pool'],outdoor_grassy_area:['grassy_area','grass_area','grass','outdoor_grass'],
 creator_female:['female_creator','creator_woman'],creator_male:['male_creator','creator_man'],
 hair_service:['hair','hair_stylist'],makeup_service:['makeup','makeup_artist'],
 wardrobe_stylist:['wardrobe','stylist'],director_producer:['director','producer'],equipment_rental:['equipment']
};
const candidates=key=>{
 const names=[key,...(ALIASES[key]||[])].flatMap(x=>[x,x.replaceAll('_','-'),x.replaceAll('_',' ')]);
 return [...new Set(names.flatMap(x=>[x.toLowerCase(),x]))].flatMap(name=>
  ['/','/icons/','/category-icons/','/categories/','/assets/icons/'].flatMap(folder=>
   ['png','webp','svg'].map(ext=>folder+encodeURIComponent(name)+'.'+ext)));
};
export function CategoryArtwork({item,size=48}){
 const paths=candidates(item.icon||item.key);
 const [index,setIndex]=useState(0);
 const Icon=item.Icon||Layers;
 return <span className="grid shrink-0 place-items-center" style={{width:size,height:size}} aria-hidden="true">
  {index<paths.length?
   <img key={item.icon+'-'+index} src={paths[index]} alt="" loading="lazy" decoding="async"
    onError={()=>setIndex(i=>i+1)} className="h-full w-full object-contain"/>:
   <Icon size={Math.round(size*.69)} strokeWidth={1.5}/>}
 </span>;
}
export function CategoryStrip({items,value,onSelect,activeColor='var(--cc-link)'}) {
 return <nav aria-label="Browse categories" className="w-full">
  <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-center gap-x-3 gap-y-2 px-2 py-3 sm:gap-x-5">
   {items.map(item=><button type="button" key={item.key} aria-pressed={value===item.key}
    onClick={()=>onSelect(item)} style={{borderBottomColor:value===item.key?activeColor:'transparent'}}
    className="flex min-h-[104px] w-[94px] shrink-0 flex-col items-center justify-start gap-2 border-b-[3px] px-1 py-2 text-center text-xs font-semibold text-[var(--cc-text-primary)] transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-[108px]">
    <CategoryArtwork item={item} size={54}/><span className="leading-4">{item.label}</span>
   </button>)}
  </div>
 </nav>;
}
