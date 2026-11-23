/** Shared visual language for HostConnect and Content Connect X.
 * Uses original transparent PNG/WebP artwork when deployed under /public.
 * No remote third-party artwork is loaded. Missing files degrade accessibly.
 */
import React from 'react';
import {Home,Building2,Warehouse,Clapperboard,Camera,Landmark,Trees,Waves,LifeBuoy,Package,Video,UserRound,Scissors,Palette,Shirt,Film,Briefcase,Layers} from 'lucide-react';

export const PROPERTY_CATEGORIES=[
 {key:'all',label:'All properties',category:'',Icon:Layers},
 {key:'house',label:'Houses',category:'house',image:'/house.png',Icon:Home},
 {key:'condo',label:'Condos',category:'condo',image:'/condo.png',Icon:Building2},
 {key:'warehouse',label:'Commercial warehouses',category:'warehouse',image:'/commercial_warehouse.png',Icon:Warehouse},
 {key:'dungeon',label:'BDSM dungeons',category:'dungeon',image:'/bdsm_dungeon.png',Icon:Landmark},
 {key:'film_studio',label:'Production studios',category:'film_studio',image:'/production_studio.png',Icon:Clapperboard},
 {key:'photo_studio',label:'Photo studios',category:'photo_studio',image:'/Studio.png',Icon:Camera},
 {key:'private_beach',label:'Private beaches',category:'private_beach',image:'/private_beach.png',Icon:Waves},
 {key:'pool',label:'Outdoor pools',category:'',amenity:'pool',image:'/outdoor_pool.png',Icon:LifeBuoy},
 {key:'grass',label:'Grassy areas',category:'outdoor',image:'/outdoor_grassy_area.png',Icon:Trees},
];
export const DISCOVERY_CATEGORIES=[
 {key:'videographer',label:'Videographers',role:'videographer',image:'/Videographer.png',Icon:Video},
 {key:'photographer',label:'Photographers',role:'photographer',image:'/Photographer.png',Icon:Camera},
 {key:'agent',label:'Agents',role:'agent',image:'/Agent.png',Icon:Briefcase},
 {key:'studio',label:'Studios',role:'studio',image:'/Studio.png',Icon:Clapperboard},
 {key:'director',label:'Directors / producers',role:'director_producer',image:'/Director.png',Icon:Film},
 {key:'hair',label:'Hair services',role:'hair_stylist',image:'/hair_services.png',Icon:Scissors},
 {key:'makeup',label:'Makeup services',role:'makeup_artist',image:'/makeup_services.png',Icon:Palette},
 {key:'wardrobe',label:'Wardrobe stylists',role:'wardrobe_stylist',image:'/Wardrobe.png',Icon:Shirt},
 {key:'editor',label:'Video editors',role:'video_editor',image:'/Video%20Editor.png',Icon:Film},
 {key:'equipment',label:'Equipment rentals',role:'equipment_rental',image:'/Equipment_Rental.png',Icon:Package},
 {key:'hosts',label:'Hosts',destination:'hosting',image:'/house.png',Icon:Home},
 {key:'verified',label:'Verified creators',role:'creator',image:'/Verified%20Creator.png',Icon:UserRound}
];
/** Exact case-sensitive filenames from both repositories' public/ directories.
 * Asset URLs are rooted at / and spaces are percent encoded.
 * Fallback icons are reserved for the two generic All categories without artwork.
 */
export function CategoryArtwork({item,size=54}){
 const Icon=item.Icon||Layers;
 return <span className="grid shrink-0 place-items-center" style={{width:size,height:size}} aria-hidden="true">
  {item.image?<img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain"/>:
   <Icon size={Math.round(size*.69)} strokeWidth={1.5}/>}
 </span>;
}
export function CategoryStrip({items,value,onSelect,activeColor='var(--cc-link)',large=false}) {
 return <nav aria-label="Browse categories" className={"w-full overscroll-x-contain "+(large?"overflow-x-auto lg:overflow-visible":"overflow-x-auto")}> 
  <div className={"mx-auto flex items-start justify-center gap-2 px-3 py-3 sm:gap-4 "+(large?"w-max min-w-max lg:w-full lg:min-w-0 lg:max-w-[1500px] lg:flex-wrap":"w-max min-w-max")}>
   {items.map(item=><button type="button" key={item.key} aria-pressed={value===item.key}
    onClick={()=>onSelect(item)} style={{borderBottomColor:value===item.key?activeColor:'transparent'}}
    className={"flex shrink-0 snap-start flex-col items-center justify-start gap-2 border-b-[3px] px-1 py-2 text-center text-xs font-semibold text-[var(--cc-text-primary)] transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 "+(large?"min-h-[122px] w-[116px] sm:w-[130px]":"min-h-[104px] w-[94px] sm:w-[102px]")}>
    <CategoryArtwork item={item} size={large?72:54}/><span className="leading-4">{item.label}</span>
   </button>)}
  </div>
 </nav>;
}
