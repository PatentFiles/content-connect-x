/** Local contact limits are based on public city centers, never home coordinates. */
const freeActions=[
 'list_connection_requests','request_connection','respond_connection',
 'list_conversations','create_conversation','list_messages','send_message',
 'mark_conversation_read','edit_message','delete_message','react_message',
 'list_notifications','mark_notification_read'
];
export const isFreeAction=action=>freeActions.includes(action);
const states={
 california:'ca',arizona:'az',nevada:'nv',florida:'fl',illinois:'il',
 georgia:'ga','new york':'ny',washington:'wa',oregon:'or',texas:'tx',
 colorado:'co',newjersey:'nj','new jersey':'nj',massachusetts:'ma'
};
const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const state=v=>states[norm(v)]||norm(v);
const nation=v=>['us','usa','united states','united states of america'].includes(norm(v))?'united states':norm(v);
export function milesBetween(a,b){
 const toRad=Math.PI/180;
 const lat1=Number(a.latitude)*toRad,lat2=Number(b.latitude)*toRad;
 const dLat=lat2-lat1,dLon=(Number(b.longitude)-Number(a.longitude))*toRad;
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function localContactStatus(me,them,areas=[]){
 if(!me?.city||!them?.city||!me?.country||!them?.country)
  return {allowed:false,reason:'Both members need a city and country on their profiles.'};
 const x=nation(me.country),y=nation(them.country);
 if(x!==y)return {allowed:false,reason:'The other member is outside your local country.'};
 const findArea=p=>(areas||[]).find(a=>
  norm(a.city)===norm(p.city)&&nation(a.country)===nation(p.country)&&
  (!state(p.state)||state(a.region)===state(p.state)));
 const a=findArea(me),b=findArea(them);
 if(a&&b)return {allowed:milesBetween(a,b)<=25,reason:'Distance is calculated from city centers.'};
 if(norm(me.city)===norm(them.city)&&state(me.state)&&state(them.state)&&state(me.state)===state(them.state))
  return {allowed:true,reason:'Same-city approximation.'};
 return {allowed:false,reason:'Nearby-city coordinates are unavailable; add an approved map area or use Premium.'};
}
