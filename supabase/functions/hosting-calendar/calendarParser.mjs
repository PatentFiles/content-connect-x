export const parseDate=(line,venueTz)=>{
 const pos=line.indexOf(':');if(pos<0)return null;
 const details=line.slice(0,pos),value=line.slice(pos+1).trim();
 const match=value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
 if(!match)return null;
 const nums=[...match.slice(1,7)].map((x,i)=>x?Number(x):i<3?1:0);
 const stamp=Date.UTC(nums[0],nums[1]-1,nums[2],nums[3],nums[4],nums[5]);
 if(!Number.isFinite(stamp)||nums[0]<1900||nums[1]<1||nums[1]>12||nums[2]<1||nums[2]>31||nums[3]>23||nums[4]>59||nums[5]>59)return null;
 const utc=new Date(stamp);
 if(utc.getUTCFullYear()!==nums[0]||utc.getUTCMonth()+1!==nums[1]||utc.getUTCDate()!==nums[2])return null;
 if(match[7]==='Z')return new Date(stamp).toISOString();
 const tz=details.match(/TZID=([^;:]+)/)?.[1]||(!match[4]?venueTz:null);
 if(!tz)return null;
 try{
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,hourCycle:'h23',
   year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  let attempt=stamp;
  for(let i=0;i<4;i++){
   const parts=Object.fromEntries(formatter.formatToParts(new Date(attempt)).map(x=>[x.type,Number(x.value)]));
   const localStamp=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour%24,parts.minute,parts.second);
   attempt+=stamp-localStamp;
  }
  const final=Object.fromEntries(formatter.formatToParts(new Date(attempt)).map(x=>[x.type,Number(x.value)]));
  if(final.year!==nums[0]||final.month!==nums[1]||final.day!==nums[2]||final.hour%24!==nums[3]||final.minute!==nums[4]||final.second!==nums[5])return null;
  return new Date(attempt).toISOString();
 }catch{return null;}
};
export function parseEvents(raw,tz,now=Date.now()){
 const unfolded=raw.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'').replace(/\r/g,'');
 if(!unfolded.includes('BEGIN:VCALENDAR')||!unfolded.includes('END:VCALENDAR'))throw Error('Not a complete iCalendar file');
 const blocks=unfolded.split('BEGIN:VEVENT').slice(1);
 if(blocks.length>500)throw Error('Calendar is too large');
 let unsupported=0;
 const out=[];
 for(const section of blocks){
  if(!section.includes('END:VEVENT')){unsupported++;continue;}
  const lines=section.slice(0,section.indexOf('END:VEVENT')).split('\n').map(v=>v.trim());
  // Do not silently collapse a recurring series and free previously blocked dates.
  if(lines.some(x=>/^(RRULE|RDATE|EXDATE|RECURRENCE-ID)(;|:)/i.test(x)))
   throw Error('Recurring calendar events require expansion by the source provider; existing blocks were kept');
  if(lines.find(x=>x==='STATUS:CANCELLED'))continue;
  const start=lines.find(x=>x.startsWith('DTSTART:')||x.startsWith('DTSTART;'));
  const end=lines.find(x=>x.startsWith('DTEND:')||x.startsWith('DTEND;'));
  const uid=lines.find(x=>x.startsWith('UID:'))?.slice(4)?.trim();
  if(!start||!end||!uid){unsupported++;continue;}
  const a=parseDate(start,tz),b=parseDate(end,tz);
  if(!a||!b||Date.parse(b)<=Date.parse(a)||Date.parse(b)-Date.parse(a)>90*86400000){
   unsupported++;continue;
  }
  if(Date.parse(b)<now-30*86400000)continue;
  out.push({uid,starts_at:a,ends_at:b});
 }
 if(unsupported>0)throw Error('Calendar contains unsupported timezones or malformed events; existing imported blocks were kept');
 return out;
}
