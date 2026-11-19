/** Safe timezone conversion for the production wizard.
 * A local clock time is valid only when exactly one UTC instant maps to it.
 * This prevents silently shifting spring-forward gaps or choosing a
 * fall-back hour arbitrarily. All persisted events use ISO UTC timestamps
 * PLUS the production's authoritative IANA timezone.
 */
export const WIZARD_STEPS=Object.freeze([
 {id:'project',title:'Project'},
 {id:'schedule',title:'Schedule and venue'},
 {id:'scope',title:'Scope and consent'},
 {id:'people',title:'Professionals'},
 {id:'review',title:'Review'}
]);
export function normalizedTimeZone(value){
 if(typeof value!=='string'||value.length>80)throw Error('Choose a valid production time zone.');
 try{return new Intl.DateTimeFormat('en-US',{timeZone:value}).resolvedOptions().timeZone;}
 catch{throw Error('Choose a valid production time zone.');}
}
const pad2=n=>String(n).padStart(2,'0');
const parts=(ms,zone)=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms);
 return Object.fromEntries(p.map(x=>[x.type,x.value]));
};
const msFromParts=p=>Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));
export function localDateTimeToUtc(value,timeZone){
 if(value==null||value==='')return null;
 if(typeof value!=='string')throw Error('Enter a valid production date and time.');
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!m)throw Error('Use a complete production date and time.');
 const [y,month,d,h,min]=m.slice(1).map(Number);
 if(y<2000||y>2100||month<1||month>12||d<1||d>31||h>23||min>59)throw Error('Use a valid production date.');
 const clock=Date.UTC(y,month-1,d,h,min);
 if(!Number.isFinite(clock)||new Date(clock).toISOString().slice(0,16)!==value)throw Error('Use a valid production date.');
 const zone=normalizedTimeZone(timeZone);
 const candidates=new Set();
 for(const pivot of [clock-86400000,clock,clock+86400000]){
  const offset=msFromParts(parts(pivot,zone))-pivot;
  const instant=clock-offset;
  const actual=parts(instant,zone);
  if(Number(actual.year)===y&&Number(actual.month)===month&&Number(actual.day)===d&&Number(actual.hour)===h&&Number(actual.minute)===min)
   candidates.add(instant);
 }
 if(candidates.size===0)throw Error('This local time does not exist in the selected time zone. Choose a different hour.');
 if(candidates.size!==1)throw Error('This local time occurs twice because clocks change. Choose an unambiguous hour.');
 return new Date([...candidates][0]).toISOString();
}
export function validateProductionWizardStep(step,data){
 if(step===0&&(!data.title?.trim()||data.title.trim().length<3||data.title.length>140))
  return 'Enter a project title with at least three characters.';
 if(step===1){
  const zone=normalizedTimeZone(data.plan?.timezone||'UTC');
  const start=localDateTimeToUtc(data.plan?.starts_at,zone);
  const end=localDateTimeToUtc(data.plan?.ends_at,zone);
  if(!!start!==!!end)return 'Add both start and end times, or leave both unscheduled.';
  if(start&&end&&Date.parse(end)<=Date.parse(start))return 'End time must be after the start time.';
 }
 if(step===2&&!data.plan?.scope_of_work?.trim())return 'Explain the proposed professional scope before sending it for agreement.';
 if(step===3&&data.target&&data.target===data.userId)return 'You cannot invite yourself.';
 return null;
}
export const productionTimeZoneChoices=()=>{
 try{return Intl.supportedValuesOf('timeZone');}
 catch{return ['UTC','America/Phoenix','America/Los_Angeles','America/New_York','Europe/London','Australia/Sydney'];}
};
