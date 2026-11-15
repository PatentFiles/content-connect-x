/** Public-area-only Web Mercator helpers. No private property coords are used. */
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function project(lon,lat,zoom=4){
 const scale=256*2**zoom;
 const a=clamp(Number(lat),-85.05113,85.05113)*Math.PI/180;
 return {x:(Number(lon)+180)/360*scale,
  y:(1-Math.log(Math.tan(a)+1/Math.cos(a))/Math.PI)/2*scale};
}
export function unproject(x,y,zoom=4){
 const scale=256*2**zoom;
 const lon=x/scale*360-180;
 const angle=Math.PI*(1-2*y/scale);
 const lat=180/Math.PI*Math.atan(Math.sinh(angle));
 return {longitude:clamp(lon,-180,180),latitude:clamp(lat,-85,85)};
}
export function mapBounds(center,width,height,zoom){
 const point=project(center.longitude,center.latitude,zoom);
 const sw=unproject(point.x-width/2,point.y+height/2,zoom);
 const ne=unproject(point.x+width/2,point.y-height/2,zoom);
 return {west:sw.longitude,east:ne.longitude,south:sw.latitude,north:ne.latitude};
}
export function kmBetween(a,b){
 const rad=Math.PI/180;
 const dLat=(Number(b.latitude)-Number(a.latitude))*rad;
 const dLon=(Number(b.longitude)-Number(a.longitude))*rad;
 const v=Math.sin(dLat/2)**2+
  Math.cos(Number(a.latitude)*rad)*Math.cos(Number(b.latitude)*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));
}
export function inside(bounds,point){
 return point.longitude>=bounds.west&&point.longitude<=bounds.east&&
  point.latitude>=bounds.south&&point.latitude<=bounds.north;
}
