/** Readiness is informational until every server-side provider gate exists.
 * Never use this UI calculation to grant access, legal consent or a booking.
 * Inputs are member-authorized private detail API results, not public profile data.
 */
export function summarizeProductionReadiness(detail,{now=new Date().toISOString()}={}){
 if(!detail?.collaboration)return {items:[],complete:0,total:0,canAuthorize:false};
 const plan=detail.plan||{},members=Array.isArray(detail.members)?detail.members:[],
  invitations=Array.isArray(detail.invitations)?detail.invitations:[],
  consents=Array.isArray(detail.consents)?detail.consents:[],
  contracts=Array.isArray(detail.contracts)?detail.contracts:[];
 const done=(id,label,ok,help)=>({id,label,status:ok?'confirmed':'action_required',help});
 const activeMembers=members.filter(m=>m?.user_id);
 const hasOther=activeMembers.length>=2;
 const allAccepted=hasOther&&!invitations.some(i=>i.status==='pending'||i.status==='declined');
 const identified=activeMembers.length>0&&activeMembers.every(m=>m.admitted===true&&m.restricted!==true);
 const scheduleValid=typeof plan.starts_at==='string'&&typeof plan.ends_at==='string'
   &&Number.isFinite(Date.parse(plan.starts_at))&&Number.isFinite(Date.parse(plan.ends_at))
   &&Date.parse(plan.starts_at)>Date.parse(now)&&Date.parse(plan.ends_at)>Date.parse(plan.starts_at)
   &&typeof plan.timezone==='string'&&plan.timezone.length>0;
 const scoped=typeof plan.scope_of_work==='string'&&plan.scope_of_work.trim().length>0;
 const consentsValid=hasOther&&activeMembers.every(m=>{
  const consent=consents.find(c=>c.user_id===m.user_id);
  return consent?.participation_consent===true&&!consent.revoked_at;
 });
 const recordedSigned=contracts.some(c=>c.locked_at&&['signed','completed','executed'].includes(c.status)
   &&activeMembers.length>0&&activeMembers.every(m=>c.signatures?.some(s=>s.signer_id===m.user_id)));
 // Document signatures are separately subjected to approved signing-provider acceptance.
 const checklist=[
  done('participants','At least two accepted professionals',allAccepted,'Invite the participating professionals and await their acceptance.'),
  done('identity','Every participant admitted and unrestricted',identified,'The backend must confirm each collaborator has completed eligibility checks.'),
  done('scope','Scope, activities and deliverables proposed',scoped,'Describe the work to be agreed upon; proposed scope is not consent.'),
  done('schedule','Valid future dates and authoritative time zone',scheduleValid,'Choose both times in the actual production location time zone.'),
  done('venue','Venue / Host Connect booking',!plan.property_id&&!!plan.venue_label,'An unconfirmed property selection is not a reservation; confirm it through Host Connect.'),
  done('consent','Individual participation consent',consentsValid,'Every participant must independently accept and may later withdraw.'),
  done('signatures','Signed, immutable agreement evidence',recordedSigned,'A draft agreement is not a signature. Verify completed provider envelopes.'),
  done('clearance','Required work-clearance confirmation',!detail.collaboration.requires_work_clearance,'If required, server-confirmed clearance and sharing consent must be current.')
 ];
 // A checklist is NOT an authorization, even if its status is all green.
 return {items:checklist,complete:checklist.filter(i=>i.status==='confirmed').length,total:checklist.length,canAuthorize:false};
}
