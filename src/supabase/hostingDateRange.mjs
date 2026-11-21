/** Host Connect day-only bookings. The venue's IANA timezone is authoritative.
 * Every stay starts at 3 p.m. and ends at 3 p.m. on a later local calendar day;
 * DST changes never produce a fractional night or an hourly booking.
 */
export const DAILY_CHECKIN_TIME='15:00';
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
 if(!first||last)return {start:mergeLocal(day,DAILY_CHECKIN_TIME),end:''};
 // A same-day checkout is not a full-day booking; prompt for another date.
 if(day===first)return {start:mergeLocal(first,DAILY_CHECKIN_TIME),end:''};
 if(day<first)return {start:mergeLocal(day,DAILY_CHECKIN_TIME),end:mergeLocal(first,DAILY_CHECKIN_TIME)};
 return {start:mergeLocal(first,DAILY_CHECKIN_TIME),end:mergeLocal(day,DAILY_CHECKIN_TIME)};
}
export function nightsBetween(start,end){
 const a=datePortion(start),b=datePortion(end);
 if(!a||!b)return 0;
 const days=Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
 return Number.isSafeInteger(days)&&days>=1&&days<=365?days:0;
}
export function validRange(start,end){
 return start===mergeLocal(datePortion(start),DAILY_CHECKIN_TIME)&&
   end===mergeLocal(datePortion(end),DAILY_CHECKIN_TIME)&&nightsBetween(start,end)>0;
}
/** Calculate a 3 p.m. local civil date in the venue's IANA timezone.
 * The engine stores UTC instants, but charges one full local calendar day even
 * across 23/25-hour DST transitions. Never use the visitor's timezone.
 */
export function venueDateToIso(day,timeZone='America/Los_Angeles'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day+'T00:00:00Z')))throw Error('Select a booking calendar date.');
 const [year,month,date]=day.split('-').map(Number);
 const target=Date.UTC(year,month-1,date,15,0,0);
 const formatter=new Intl.DateTimeFormat('en-US',{
  timeZone,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 });
 let moment=target;
 for(let step=0;step<3;step++){
  const p=Object.fromEntries(formatter.formatToParts(new Date(moment)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const observed=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,0);
  moment+=target-observed;
  if(observed===target)break;
 }
 const final=Object.fromEntries(formatter.formatToParts(new Date(moment)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
 if(final.year!==year||final.month!==month||final.day!==date||final.hour!==15||final.minute!==0)
   throw Error('Booking local time could not be calculated. Check the venue timezone.');
 return new Date(moment).toISOString();
}
export function monthLabel(year,month){return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));}
export function calendarDays(year,month){
 const first=new Date(Date.UTC(year,month,1)),offset=first.getUTCDay();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {offset,days:Array.from({length:count},(_,i)=>String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'))};
}
