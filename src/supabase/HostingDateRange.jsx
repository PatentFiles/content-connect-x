/** Two-tap whole-calendar-day booking picker: always 3 p.m. venue local.
 * Never offers hourly or partial-day reservations. Server enforces the same.
 */
import React,{useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,ChevronDown,ChevronUp} from 'lucide-react';
import {datePortion,selectionForDay,validRange,monthLabel,calendarDays,DAILY_CHECKIN_TIME,nightsBetween} from './hostingDateRange.mjs';
export default function HostingDateRange({start='',end='',onChange,compact=false,optional=false,defaultOpen=false,label='Check-in and checkout'}){
 const today=new Date(),startDay=datePortion(start);
 const [yearMonth,setYearMonth]=useState(()=>{
  const day=startDay?new Date(startDay+'T12:00:00'):today;
  return {year:day.getFullYear(),month:day.getMonth()};
 });
 const [open,setOpen]=useState(defaultOpen);
 const changeMonth=delta=>setYearMonth(({year,month})=>{
  const day=new Date(year,month+delta,1);
  return {year:day.getFullYear(),month:day.getMonth()};
 });
 const choose=day=>{
  const next=selectionForDay(day,start,end);
  onChange(next);
  if(next.end)setOpen(false);
 };
 const {days,offset}=calendarDays(yearMonth.year,yearMonth.month);
 const todayISO=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const ready=validRange(start,end);
 const readable=day=>day?new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Choose date';
 return <section className={'space-y-2 '+(compact?'':'rounded-xl border border-[var(--cc-border)] p-3')} data-host-date-range="true">
  <button type="button" aria-expanded={open} aria-label={label+' calendar'} onClick={()=>setOpen(v=>!v)}
   className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2 text-left text-sm">
   <span className="flex items-center gap-2"><CalendarDays size={17}/><span><strong className="block">{label}</strong><span className="text-xs text-[var(--cc-text-secondary)]">{datePortion(start)?readable(datePortion(start)):'Choose check-in'} → {datePortion(end)?readable(datePortion(end)):'Choose checkout'}</span></span></span>
   {open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {open&&<div className="space-y-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3" aria-label="Choose check-in then checkout dates">
   <div className="flex items-center justify-between gap-2">
    <button type="button" aria-label="Previous month" className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button>
    <strong className="text-sm">{monthLabel(yearMonth.year,yearMonth.month)}</strong>
    <button type="button" aria-label="Next month" className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button>
   </div>
   <p className="text-xs text-[var(--cc-text-secondary)]">{datePortion(start)&&!datePortion(end)?'Select checkout date (second click).':'Choose arrival date, then a later departure date. Every stay is billed by the day.'}</p>
   <div className="grid grid-cols-7 gap-1 text-center text-xs">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=><span key={x} className="py-1 font-semibold">{x}</span>)}
    {Array.from({length:offset},(_,i)=><span key={'pad-'+i}/>)}
    {days.map(day=><button key={day} type="button" onClick={()=>choose(day)} disabled={day<todayISO}
      aria-label={readable(day)} aria-pressed={day===datePortion(start)||day===datePortion(end)}
      className={'min-h-9 rounded-md text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-25 '+(
       day===datePortion(start)||day===datePortion(end)?'bg-[var(--cc-action)] font-bold text-[var(--cc-text-primary)]':
       datePortion(start)&&datePortion(end)&&day>datePortion(start)&&day<datePortion(end)?'bg-[var(--cc-surface-hover)]':'hover:bg-[var(--cc-surface-hover)]'
      )}>{Number(day.slice(8))}</button>)}
   </div>
  </div>}
  <p className="rounded-xl bg-[var(--cc-surface-subtle)] px-3 py-2 text-xs text-[var(--cc-text-secondary)]">
   Check-in <strong>3:00 p.m.</strong> · Checkout <strong>3:00 p.m.</strong> ({DAILY_CHECKIN_TIME} venue local time) · {ready?nightsBetween(start,end)+' day'+(nightsBetween(start,end)>1?'s':''):'Choose consecutive or later checkout day'}.
  </p>
  {start&&end&&!ready&&<p role="alert" className="text-xs text-red-700">Checkout must be on a later calendar date.</p>}
  {optional&&(start||end)&&<button type="button" className="min-h-10 text-xs underline" onClick={()=>{onChange({start:'',end:''});}}>Clear dates</button>}
 </section>;
}
