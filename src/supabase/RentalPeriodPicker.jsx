/** A single date/hour chooser used by both brands. No calculated price is authoritative. */
import React from 'react';
import {rentalSelectionValid} from './hostRentalPeriod.mjs';
const input='mt-1 w-full min-h-11 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3 text-sm';
export default function RentalPeriodPicker({property,mode,onMode,day,onDay,end,onEnd,hour,onHour,duration,onDuration}){
 const hourly=Number.isFinite(property.hourly_rate_cents)&&property.hourly_rate_cents>0;
 return <div className="space-y-3" data-rental-period-picker="true">
  {hourly&&<div className="grid grid-cols-2 gap-2" role="group" aria-label="Rental duration type">
   {['day','hour'].map(unit=><button key={unit} type="button" aria-pressed={mode===unit} onClick={()=>onMode(unit)} className={'min-h-11 rounded-xl border px-3 text-sm font-semibold '+(mode===unit?'border-[#12698f] bg-[#e9f5fb] text-[#12698f]':'border-[var(--cc-border)]')}>{unit==='day'?'Daily':'Hourly'}</button>)}
  </div>}
  <p className="text-xs text-[var(--cc-text-secondary)]">{mode==='hour'?'Select an exact start hour and elapsed rental duration.':'Daily stays are 3 p.m. to 3 p.m. in the venue time zone.'} ({property.timezone})</p>
  <div className="grid grid-cols-2 gap-2">
   <label className="text-xs">{mode==='hour'?'Rental date':'Check-in'}<input className={input} type="date" value={day} onChange={e=>onDay(e.target.value)}/></label>
   {mode==='day'?<label className="text-xs">Checkout<input className={input} type="date" min={day||undefined} value={end} onChange={e=>onEnd(e.target.value)}/></label>:
    <label className="text-xs">Start hour<select className={input} value={hour} onChange={e=>onHour(Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}</select></label>}
  </div>
  {mode==='hour'&&<label className="block text-xs">Rental duration<select className={input} value={duration} onChange={e=>onDuration(Number(e.target.value))}>{Array.from({length:25-(property.min_rental_hours||1)},(_,i)=>i+(property.min_rental_hours||1)).map(n=><option key={n} value={n}>{n} {n===1?'hour':'hours'}</option>)}</select></label>}
  {day&&mode==='hour'&&!rentalSelectionValid(property,mode,day,end,hour,duration)&&<p className="text-xs text-amber-800">Choose a valid venue-local hour and duration.</p>}
 </div>;
}
