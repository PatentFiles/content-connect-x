/** Single guided frontend for the existing protected collaboration creation.
 * This does not sign contracts, confirm a reservation or bypass provider checks.
 */
import React,{useEffect,useRef,useState} from 'react';
import MemberPicker from './MemberPicker';
import {WIZARD_STEPS,productionTimeZoneChoices,validateProductionWizardStep,localDateTimeToUtc} from './productionWizardPolicy.mjs';
const field='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm';
const action='ccx-primary min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50';
const muted='text-[var(--cc-text-secondary)]';
const roles=[['creator','Creator'],['photographer','Photographer'],['videographer','Videographer'],['video_editor','Video editor'],['studio','Studio'],['agent','Agent']];
export default function CollaborationCreationWizard({user,title,setTitle,description,setDescription,plan,setPlan,requiresClearance,setRequiresClearance,target,setTarget,role,setRole,properties=[],onCreate,onCancel,busy=false}){
 const [index,setIndex]=useState(0),[error,setError]=useState('');
 const heading=useRef(null);
 useEffect(()=>{heading.current?.focus();},[index]);
 const update=(key,value)=>setPlan(p=>({...p,[key]:value}));
 const changeStep=(next)=>{
  if(next>index){
   try{const message=validateProductionWizardStep(index,{title,plan,target,userId:user?.id});if(message){setError(message);return;}}catch(e){setError(e.message);return;}
  }
  setError('');setIndex(next);
 };
 const finish=e=>{
  e.preventDefault();
  try{
   for(let i=0;i<4;i++){
    const message=validateProductionWizardStep(i,{title,plan,target,userId:user?.id});
    if(message){setIndex(i);setError(message);return;}
   }
  }catch(e){setError(e.message);return;}
  setError('');
  void onCreate(e);
 };
 const timeZones=productionTimeZoneChoices();
 return <form onSubmit={finish} className="ccx-surface min-w-0 space-y-5 rounded-2xl p-4 sm:p-6" aria-label="Create collaboration steps" data-collaboration-wizard="true">
  <header className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Create collaboration</h2><p className={'text-xs '+muted}>Step {index+1} of {WIZARD_STEPS.length}</p></div>
   <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cc-surface-hover)]" role="progressbar" aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length} aria-label="Collaboration setup progress"><div className="h-full rounded-full bg-[var(--cc-link)] transition-[width] duration-300 motion-reduce:transition-none" style={{width:(index+1)*100/WIZARD_STEPS.length+'%'}}/></div>
   <nav aria-label="Collaboration setup steps" className="grid grid-cols-5 gap-1 sm:gap-2">{WIZARD_STEPS.map((s,i)=><button key={s.id} type="button" disabled={i>index||busy} onClick={()=>changeStep(i)} className={'min-w-0 rounded-lg px-1 py-2 text-center text-[10px] sm:text-xs '+(index===i?'bg-[var(--cc-surface-hover)] font-semibold text-[var(--cc-link)]':'text-[var(--cc-text-secondary)]')} aria-current={index===i?'step':undefined}><span className="block">{i+1}</span><span className="break-words">{s.title}</span></button>)}</nav>
  </header>
  <div className="ccx-wizard-step min-w-0 space-y-4" key={WIZARD_STEPS[index].id}>
   <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{WIZARD_STEPS[index].title}</h3>
   {index===0&&<><p className={'text-sm '+muted}>Describe the production. Only invited and authorized members may access its private details.</p>
    <label className="block text-sm">Production title<input className={field} value={title} minLength={3} maxLength={140} required onChange={e=>setTitle(e.target.value)} placeholder="Production title"/></label>
    <label className="block text-sm">Project overview<textarea className={field} rows={4} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Professional project purpose and expected deliverables"/></label>
   </>}
   {index===1&&<><p className={'text-sm '+muted}>Times are saved using the production location's time zone. Avoid ambiguous clock-change hours.</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
     <label className="block min-w-0 text-sm">Start (at production location)<input className={field} type="datetime-local" value={plan.starts_at||''} onChange={e=>update('starts_at',e.target.value)}/></label>
     <label className="block min-w-0 text-sm">End (at production location)<input className={field} type="datetime-local" value={plan.ends_at||''} onChange={e=>update('ends_at',e.target.value)}/></label>
    </div>
    <label className="block text-sm">Production time zone<select className={field} value={plan.timezone||'UTC'} onChange={e=>update('timezone',e.target.value)}>{[...new Set([plan.timezone,...timeZones])].filter(Boolean).map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
     <label className="block text-sm">City<input className={field} value={plan.city||''} maxLength={160} onChange={e=>update('city',e.target.value)}/></label>
     <label className="block text-sm">Location or studio label<input className={field} value={plan.venue_label||''} maxLength={240} onChange={e=>update('venue_label',e.target.value)}/></label>
    </div>
    <label className="block text-sm">Proposed Host Connect property<select className={field} value={plan.property_id||''} onChange={e=>{const selected=properties.find(p=>p.id===e.target.value);setPlan(p=>({...p,property_id:e.target.value,city:selected?.city||p.city,timezone:selected?.timezone||p.timezone}));}}><option value="">None selected</option>{properties.map(p=><option value={p.id} key={p.id}>{p.title} — {[p.city,p.state,p.country].filter(Boolean).join(', ')}</option>)}</select><span className={'mt-1 block text-xs '+muted}>Selecting a listing is a proposal, not a reservation. Booking requires separate confirmation.</span></label>
   </>}
   {index===2&&<><p className={'text-sm '+muted}>Clearly distinguish proposed work from what participants later confirm was actually completed. Additional activities require new voluntary agreement.</p>
    {[['scope_of_work','Proposed professional scope'],['activities','Proposed activities (comma-separated)'],['deliverables','Deliverables and deadlines'],['usage_rights','Permitted usage and distribution rights']].map(([key,label])=><label key={key} className="block text-sm">{label}<textarea className={field} value={plan[key]||''} onChange={e=>update(key,e.target.value)} rows={2} maxLength={key==='activities'?6000:4000} required={key==='scope_of_work'}/></label>)}
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={requiresClearance} onChange={e=>setRequiresClearance(e.target.checked)}/>Require provider-confirmed work clearance, when applicable, before signing.</label>
   </>}
   {index===3&&<><p className={'text-sm '+muted}>You may save a private plan without an invitee. Invitations require an accepted friendship or genuine two-way conversation and are not sent until final confirmation.</p>
    <MemberPicker label="Invite a verified professional (optional)" value={target} excludeIds={[user?.id].filter(Boolean)} onChange={(id,person)=>{setTarget(id);if(person?.role_type)setRole(person.role_type);}}/>
    <label className="block text-sm">Proposed professional role<select className={field} value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </>}
   {index===4&&<><p className={'text-sm '+muted}>Review your draft. Creating it does not sign a contract, grant consent, approve a property booking, or permit publication.</p>
    <dl className="grid gap-3 rounded-xl border border-[var(--cc-border)] p-4 text-sm">{[['Title',title],['Overview',description||'Not specified'],['Local start',plan.starts_at||'Not scheduled'],['Local end',plan.ends_at||'Not scheduled'],['Time zone',plan.timezone],['City',plan.city||'Not specified'],['Venue',plan.venue_label||'Not specified'],['Proposed scope',plan.scope_of_work],['Activities',plan.activities||'Not specified'],['Deliverables',plan.deliverables||'Not specified'],['Invitee',target?'Selected verified professional':'No invitation yet'],['Clearance required',requiresClearance?'Yes':'No']].map(([label,value])=><div key={label}><dt className={'text-xs '+muted}>{label}</dt><dd className="break-words whitespace-pre-wrap">{value}</dd></div>)}</dl>
    <p className={'text-xs '+muted}>{plan.starts_at&&plan.ends_at?'The saved UTC timestamps are '+localDateTimeToUtc(plan.starts_at,plan.timezone)+' to '+localDateTimeToUtc(plan.ends_at,plan.timezone)+'.':''}</p>
   </>}
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cc-border)] pt-4">
   <button type="button" className="ccx-secondary min-h-11 rounded-xl px-4" disabled={busy} onClick={()=>index===0?onCancel():changeStep(index-1)}>{index===0?'Cancel':'Back'}</button>
   {index===WIZARD_STEPS.length-1?<button type="submit" className={action} disabled={busy}>{busy?'Saving…':'Save collaboration'}</button>:<button type="button" className={action} disabled={busy} onClick={()=>changeStep(index+1)}>Continue</button>}
  </footer>
 </form>;
}
