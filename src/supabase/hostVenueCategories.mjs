/** Canonical discoverable Host Connect X venue types.
 * Quick links are a curated visual grid; the select and Filters cover every
 * active type. 'pool' is a real Host category AND a search shortcut for
 * properties that advertise the existing 'pool' amenity.
 * Legacy 'set' listings are still readable by ID but no longer offered as
 * a new category or discovery shortcut.
 */
export const HOST_VENUE_CATEGORIES=Object.freeze([
 {id:'house',label:'House',image:'/house.png',quick:true},
 {id:'condo',label:'Condo',image:'/condo.png',quick:true},
 {id:'warehouse',label:'Warehouse',image:'/commercial_warehouse.png',quick:true},
 {id:'film_studio',label:'Film studio',image:'/production_studio.png',quick:true},
 {id:'photo_studio',label:'Photo studio',image:'/Studio.png',quick:true},
 {id:'dungeon',label:'Dungeon',image:'/bdsm_dungeon.png',quick:true},
 {id:'outdoor',label:'Outdoor area',image:'/outdoor_grassy_area.png',quick:true},
 {id:'private_beach',label:'Beach',image:'/private_beach.png',quick:true},
 {id:'pool',label:'Swimming pool',image:'/outdoor_pool.png',quick:true},
 {id:'resort',label:'Resort',image:'/resort.png'},
 {id:'villa',label:'Villa',image:'/villa.png'},
 {id:'loft',label:'Loft',image:'/loft.png'},
 {id:'hotel',label:'Hotel',image:'/hotel.png'},
 {id:'other',label:'Other verified venue',image:'/other_verified_venue.png'}
]);
export const HOST_VENUE_QUICK_LINKS=Object.freeze(HOST_VENUE_CATEGORIES.filter(v=>v.quick));
export const HOST_VENUE_IDS=Object.freeze(HOST_VENUE_CATEGORIES.map(v=>v.id));
export const venueMatchesType=(property,id)=>{
 if(!id)return true;
 if(id==='pool')return property?.category==='pool'||Boolean(property?.amenities?.includes('pool'));
 return property?.category===id;
};
export const venueMatchesTypes=(property,ids)=>!ids?.length||ids.some(id=>venueMatchesType(property,id));
