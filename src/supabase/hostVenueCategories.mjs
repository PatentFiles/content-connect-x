/** Canonical Host Connect X venue category IDs.
 * Labels and filters match Host Connect listing categories exactly.
 * Upload future images to /public using the exact file name after image:
 * Existing custom artwork is referenced directly; absent artwork stays blank.
 */
export const HOST_VENUE_CATEGORIES=Object.freeze([
 {id:'',label:'All spaces',image:null},
 {id:'house',label:'House',image:'/house.png'},
 {id:'condo',label:'Condo',image:'/condo.png'},
 {id:'warehouse',label:'Warehouse',image:'/commercial_warehouse.png'},
 {id:'film_studio',label:'Film studio',image:'/production_studio.png'},
 {id:'photo_studio',label:'Photo studio',image:'/photo_studio.png'},
 {id:'resort',label:'Resort',image:'/resort.png'},
 {id:'villa',label:'Villa',image:'/villa.png'},
 {id:'loft',label:'Loft',image:'/loft.png'},
 {id:'set',label:'Production set',image:'/production_set.png'},
 {id:'outdoor',label:'Outdoor estate',image:'/outdoor_grassy_area.png'},
 {id:'private_beach',label:'Private beach',image:'/private_beach.png'},
 {id:'dungeon',label:'Specialty set',image:'/bdsm_dungeon.png'},
 {id:'other',label:'Other verified venue',image:'/other_verified_venue.png'},
 {id:'hotel',label:'Hotel',image:'/hotel.png'}
]);
export const HOST_VENUE_IDS=Object.freeze(HOST_VENUE_CATEGORIES.filter(v=>v.id).map(v=>v.id));
