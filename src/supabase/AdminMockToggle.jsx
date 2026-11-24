/** Shared admin-only presentation switch. The parent owns server-authorized
 * state; never show ON until the demo endpoint has returned valid data.
 */
import React from 'react';

export default function AdminMockToggle({enabled=false,busy=false,onToggle=()=>{}}){
 return <button type="button" role="switch" aria-label="Mock data" aria-checked={enabled}
  aria-busy={busy} disabled={busy} data-admin-mock-toggle="true" data-state={enabled?'on':'off'}
  title={enabled?'Turn off mock data and return to live records':'Turn on administrator-only mock data'}
  onClick={()=>onToggle()}
  className="inline-flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-xs font-semibold text-[var(--cc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-focus)] disabled:cursor-wait disabled:opacity-70 sm:flex-row sm:gap-2 sm:px-2">
  <span className="whitespace-nowrap text-[11px] leading-3 sm:text-xs">Mock data</span>
  <span data-mock-track="true" aria-hidden="true" className="relative block h-7 w-[58px] shrink-0 rounded-full"
   style={{backgroundColor:enabled?'#15803d':'#b91c1c'}}>
   <span className={'absolute top-1/2 -translate-y-1/2 text-[10px] font-bold leading-none text-white '+(enabled?'left-1.5':'right-1.5')}>{enabled?'ON':'OFF'}</span>
   <span data-mock-thumb="true" className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm motion-safe:transition-transform motion-safe:duration-200"
    style={{transform:enabled?'translateX(30px)':'translateX(0px)'}}/>
  </span>
 </button>;
}
