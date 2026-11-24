import {isCalendarDate,venueDateToIso,nightsBetween} from './hostingDateRange.mjs';
/** Convert an unambiguous venue-local hour, not the visitor's time zone.
 * Reject nonexistent and repeated DST hours rather than silently moving them.
 */
export function venueHourToIso(day,hour,zone){
 if(!isCalendarDate(day)||!Number.isInteger(Number(hour))||Number(hour)<0||Number(hour)>23)throw Error('Select a valid venue-local start hour.');
 const target=Date.parse(day+'T'+String(hour).padStart(2,'0')+':00:00Z');
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const asUtc=ms=>{const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);};
 // Sample offset changes across the surrounding days (including half-hour zones).
 const offsets=new Set([-36,-12,0,12,36].map(h=>{const t=target+h*3600000;return asUtc(t)-t;}));
 const matches=[...offsets].map(o=>target-o).filter(ms=>asUtc(ms)===target);
 if(matches.length!==1)throw Error('That local hour is ambiguous or does not exist. Choose another start hour.');
 return new Date(matches[0]).toISOString();
}
export function rentalPeriod(property,mode,day,end,hour,duration){
 if(mode==='day'){
  const n=nightsBetween(day,end);if(n<1||n>90)throw Error('Choose 1–90 local calendar days.');
  return {rental_unit:'day',starts_at:venueDateToIso(day,property.timezone),ends_at:venueDateToIso(end,property.timezone)};
 }
 const n=Number(duration);
 if(mode!=='hour'||!Number.isFinite(property.hourly_rate_cents)||property.hourly_rate_cents<=0||!Number.isInteger(n)||n<(property.min_rental_hours||1)||n>24)throw Error('Select an offered hourly rental duration.');
 const start=venueHourToIso(day,Number(hour),property.timezone);
 return {rental_unit:'hour',starts_at:start,ends_at:new Date(Date.parse(start)+n*3600000).toISOString()};
}
export function rentalSelectionValid(property,mode,day,end,hour,duration){
 try{if(!property)return false;rentalPeriod(property,mode,day,end,hour,duration);return true;}catch{return false;}
}
