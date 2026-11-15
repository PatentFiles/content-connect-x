/**
 * Availability calendar inspired by OpenStay's occupancy grid.
 * The UI is informational; only the database booking trigger reserves slots.
 */
import React,{useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,CalendarDays} from 'lucide-react';

const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const isBlocked=(day,periods)=>{
  const start=new Date(day.getFullYear(),day.getMonth(),day.getDate());
  const end=new Date(start);end.setDate(end.getDate()+1);
  return periods.some(p=>new Date(p.starts_at)<end&&new Date(p.ends_at)>start);
};
export default function HostingCalendar({periods=[],onSelect,selectedDate}) {
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const cells=useMemo(()=>{
   const year=month.getFullYear(),index=month.getMonth();
   const first=new Date(year,index,1);
   const dayOffset=(first.getDay()+6)%7;
   const count=new Date(year,index+1,0).getDate();
   return Array.from({length:dayOffset+count},(_,i)=>{
     const day=i-dayOffset+1;
     return day>0?new Date(year,index,day):null;
   });
 },[month]);
 const selected=selectedDate?new Date(selectedDate):null;
 const move=step=>setMonth(current=>new Date(current.getFullYear(),current.getMonth()+step,1));
 return <div className="rounded-xl border border-[#34465E] bg-[#0C1726] p-4">
   <div className="flex items-center justify-between">
     <h4 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16}/> {month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h4>
     <div className="flex gap-2"><button className="rounded-lg p-2 hover:bg-[#283B55]" onClick={()=>move(-1)} aria-label="Previous month"><ChevronLeft size={16}/></button><button className="rounded-lg p-2 hover:bg-[#283B55]" onClick={()=>move(1)} aria-label="Next month"><ChevronRight size={16}/></button></div>
   </div>
   <div className="mt-3 grid grid-cols-7 gap-1 text-center">{days.map(d=><span key={d} className="py-1 text-[11px] font-semibold text-[#8FA7C4]">{d}</span>)}
     {cells.map((date,i)=>{
       if(!date)return <span key={'empty-'+i}/>;
       const blocked=isBlocked(date,periods);
       const chosen=selected&&selected.toDateString()===date.toDateString();
       const past=date<new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
       return <button key={date.toISOString()} type="button"
         disabled={!onSelect||blocked||past}
         onClick={()=>onSelect?.(date)}
         title={blocked?'At least part of this date is reserved':'Choose this date'}
         className={'aspect-square rounded-lg text-xs font-medium transition '+
         (chosen?'bg-blue-600 text-white':blocked?'bg-rose-950/60 text-rose-300':past?'text-[#4B607C]':'bg-[#1B2B40] text-[#C2D4E9] hover:bg-blue-500/25')+
         (!onSelect?' cursor-default':'')}>
         {date.getDate()}
       </button>;
     })}
   </div>
   <div className="mt-3 flex gap-3 text-[11px] text-[#9BB1C9]"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-[#1B2B40]"/>Dates without reservations</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-rose-900"/>At least partly reserved</span></div>
   <p className="mt-2 text-[11px] text-[#8298B7]">Partially occupied dates are shown as reserved. Exact hours remain subject to host buffers and availability checks.</p>
 </div>;
}