/** Explain actual server prerequisites before mounting a protected workflow. */
import React from 'react';
import {ShieldAlert,RefreshCw} from 'lucide-react';
import {accessReason,accessCopy} from './moduleAccessPolicy.mjs';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import VerificationWorkspace from './VerificationWorkspace';
export default function ModuleAccessBoundary({tab,flags,onNavigate,children}){
 const workspace=useRoleWorkspace();
 if(tab==='verification')return <VerificationWorkspace user={workspace.user}/>;
 const reason=accessReason(tab,flags);
 if(reason==='ready')return children;
 // Existing role-specific preview components suppress all reads and writes.
 // A layout preview must never be confused with an editable second account.
 if(workspace.preview&&['roster','portfolio'].includes(tab)&&['role_required','verification_required','mfa_required','membership_required'].includes(reason))return children;
 const copy=accessCopy(reason);
 const retry=()=>window.dispatchEvent(new Event('focus'));
 return <section className="ccx-surface space-y-4 p-5" role={reason==='loading'?'status':'alert'}>
  <div className="flex items-center gap-2"><ShieldAlert size={21} className="text-[#FF8DD9]"/><h2 className="text-xl font-semibold">{copy.title}</h2></div>
  <p className="text-sm leading-6" style={{color:'var(--cc-text-secondary)'}}>{copy.description}</p>
  <div className="flex flex-wrap gap-3">{copy.tab&&(reason!=='disabled'||workspace.isAdmin)&&<button type="button" className="ccx-primary rounded-xl px-4 py-2.5 text-sm" onClick={()=>onNavigate(copy.tab)}>{copy.action}</button>}
   {reason!=='loading'&&<button type="button" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" onClick={retry}><RefreshCw size={16}/>Check again</button>}
  </div>
 </section>;
}
