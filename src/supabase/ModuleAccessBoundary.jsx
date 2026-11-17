import React from 'react';
import {Loader2,RefreshCw,ShieldCheck} from 'lucide-react';
import {moduleAccessState} from './moduleAccessPolicy.mjs';
import {useRoleWorkspace} from './RoleWorkspaceContext';
const messages={
 verification_required:['Complete age verification','This module is enabled. Your account still needs independent age verification before its protected data and actions are available. Administrator access and role previews do not constitute verification.'],
 membership_required:['Premium membership required','This module is enabled, but its actions require an active Premium membership. Your saved records have not been removed.'],
 role_required:['Use the matching professional account','This module belongs to a different professional role. The dashboard selector previews a layout; it does not change your actual account or grant access to another role’s private records.'],
 disabled:['This module is currently turned off','An administrator has explicitly disabled this module. Existing records remain stored.'],
 rollout_excluded:['This module is not yet available to your account','The feature is enabled for a limited rollout. Your records remain unchanged.'],
 restricted:['Account access restricted','This account is restricted. Privacy and account-security pages remain available.'],
 unavailable:['Unable to check module access','The access service could not be reached. This is not the same as a disabled module.']
};
export default function ModuleAccessBoundary({children,tab,flags,access,status,error,verified,onRetry,onNavigate}){
 const workspace=useRoleWorkspace();
 const state=moduleAccessState(tab,{flags,access,status,error,verified});
 // Verified administrators may inspect the existing read-only role previews.
 // They are still never given write authority for a different actual role.
 if(state.code==='role_required'&&verified&&workspace.preview&&['roster','portfolio'].includes(tab))return <>{children}</>;
 if(state.code==='ready')return <>{children}</>;
 if(state.code==='loading')return <section className="ccx-surface flex items-center gap-3 p-5" role="status"><Loader2 size={20} className="animate-spin"/>Checking module access…</section>;
 const [title,description]=messages[state.code]||messages.unavailable;
 return <section className="ccx-surface space-y-4 p-5" data-access-state={state.code}>
  <h2 className="text-xl font-semibold">{title}</h2>
  <p className="text-sm text-[#B7C5DA]" role={state.code==='unavailable'?'alert':undefined}>{state.message||description}</p>
  <div className="flex flex-wrap gap-3">
   {state.code==='verification_required'&&<button type="button" className="ccx-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5" onClick={()=>onNavigate('verification')}><ShieldCheck size={17}/>Complete verification</button>}
   {state.code==='membership_required'&&<button type="button" className="ccx-primary rounded-xl px-4 py-2.5" onClick={()=>onNavigate('membership')}>View membership</button>}
   <button type="button" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5" onClick={()=>{void onRetry?.();}}><RefreshCw size={16}/>Check again</button>
   <button type="button" className="ccx-secondary rounded-xl px-4 py-2.5" onClick={()=>onNavigate('dashboard')}>Back to dashboard</button>
  </div>
 </section>;
}
