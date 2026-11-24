/** Shared, public-city-level map presentation. No street coordinates or private data. */
export const ROAD_STYLE='https://tiles.openfreemap.org/styles/positron';
export const VENUE_ARTWORK=Object.freeze({house:'/house.png',condo:'/condo.png',apartment:'/condo.png',warehouse:'/commercial_warehouse.png',film_studio:'/production_studio.png',photo_studio:'/Studio.png',dungeon:'/bdsm_dungeon.png',outdoor:'/outdoor_grassy_area.png',private_beach:'/private_beach.png',pool:'/outdoor_pool.png',hotel:'/Hotel.png',resort:'/resort_villa.png',villa:'/resort_villa.png',loft:'/loft.png',other:'/house.png',set:'/production_studio.png',equipment:'/commercial_warehouse.png'});
export const finitePoint=p=>typeof p?.approx_lat==='number'&&typeof p.approx_lng==='number'&&Number.isFinite(p.approx_lat)&&Number.isFinite(p.approx_lng)&&Math.abs(p.approx_lat)<=85&&Math.abs(p.approx_lng)<=180;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function markerPosition(p){
 if(!finitePoint(p))return null;
 let hash=2166136261;
 for(const ch of String(p.id))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 const a=hash/4294967296*2*Math.PI,r=.006+(hash%17)*.00045;
 return [clamp(p.approx_lng+Math.cos(a)*r,-180,180),clamp(p.approx_lat+Math.sin(a)*r,-85,85)];
}
export function normalizeBounds(b){
 if(!b)return null;
 const w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth();
 if(![w,e,s,n].every(Number.isFinite))return null;
 const norm=v=>((v+180)%360+360)%360-180;
 return {west:e-w>=360?-180:norm(w),east:e-w>=360?180:norm(e),south:clamp(s,-85,85),north:clamp(n,-85,85)};
}
export function money(cents){return Number.isFinite(cents)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100):'—';}
export function rentalPrice(item,unit='day'){
 const rate=unit==='hour'?item.hourly_rate_cents:item.daily_rate_cents;
 return Number.isFinite(rate)&&rate>0?rate:null;
}
