/** Calendar-day-only range helpers. The browser's local checkout time is kept
 * separate from the listing's authoritative server-side booking timezone.
 */
export const HALF_HOUR_SLOTS=Object.freeze(Array.from({length:48},(_,i)=>{
 const h=String(Math.floor(i/2)).padStart(2,'0'),m=i%2?'30':'00';
 return {value:h+':'+m,label:new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'UTC'}).format(new Date('2026-01-01T'+h+':'+m+':00Z'))};
}));
export const datePortion=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value||''))?String(value).slice(0,10):'';
export const timePortion=(value,fallback)=>/T\d{2}:(00|30)$/.test(String(value||''))?String(value).slice(11):fallback;
export const mergeLocal=(day,time)=>day?day+'T'+time:'';
export const isHalfHour=value=>/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):(?:00|30)$/.test(String(value||''));
export const timeFor=(day,value,defaultTime)=>mergeLocal(day,timePortion(value,defaultTime));
export function selectionForDay(day,start,end){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return {start,end};
 const first=datePortion(start),last=datePortion(end);
 // Two taps: first is check-in, second is checkout, regardless of month.
 if(!first||last)return {start:mergeLocal(day,timePortion(start,'09:00')),end:''};
 if(day<first)return {start:mergeLocal(day,timePortion(start,'09:00')),end:mergeLocal(first,timePortion(end,'17:00'))};
 if(day===first)return {start:mergeLocal(day,timePortion(start,'09:00')),end:mergeLocal(day,'17:00')};
 return {start,end:mergeLocal(day,timePortion(end,'11:00'))};
}
export function validRange(start,end){
 if(!isHalfHour(start)||!isHalfHour(end))return false;
 return new Date(end).getTime()>new Date(start).getTime();
}
export function monthLabel(year,month){return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));}
export function calendarDays(year,month){
 const first=new Date(Date.UTC(year,month,1)),offset=first.getUTCDay();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {offset,days:Array.from({length:count},(_,i)=>String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'))};
}
