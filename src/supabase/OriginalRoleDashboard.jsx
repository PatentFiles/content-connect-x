/** Original role dashboard cards use the same destinations as the sidebar. */
import React from 'react';
import {ArrowRight,ShieldCheck,UserRound} from 'lucide-react';
import {getNavigationForRole} from './originalRoleNav';
import {TAB_FOR_PAGE} from './roleNavigationData.mjs';
import {isModuleVisible} from './featureModules.mjs';
import {roleTitle} from './roleWorkspacePolicy.mjs';
const descriptions={Testing:'Private testing records and work clearance',Discovery:'Find verified people in your city',Search:'Search other cities and professional roles',Favorites:'Profiles you have saved',Connections:'Your professional connections',Messages:'Private conversations',Collaborations:'Production collaborations and invitations',Contracts:'Agreements and documents',Properties:'Studios and filming locations',Roster:'The creators you represent',Portfolio:'Your photographs, reels and work links'};
export default function OriginalRoleDashboard({profile,verified,paid,onNavigate,roleOverride,features}){
 const role=roleOverride||profile?.role_type||'creator';
 const modules=getNavigationForRole(role).filter(item=>!['Dashboard','Profile','Settings','Verification'].includes(item.path)&&isModuleVisible(TAB_FOR_PAGE[item.path],features));
 return <section className="space-y-6">
  <header><h1 className="text-2xl font-bold">{roleTitle(role)} Dashboard</h1><p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>Welcome{profile?.display_name?', '+profile.display_name:''}. Manage your professional workspace.</p></header>
  <div className="grid gap-3 sm:grid-cols-3"><div className="ccx-surface p-4"><p className="text-xs text-[#AABBD4]">Profile</p><p className="mt-2 font-semibold">{profile?.profile_complete?'Completed':'Finish setup'}</p></div><div className="ccx-surface p-4"><p className="text-xs text-[#AABBD4]">Verification</p><p className="mt-2 flex items-center gap-2 font-semibold"><ShieldCheck size={16}/>{verified?'Approved':'Required'}</p></div><div className="ccx-surface p-4"><p className="text-xs text-[#AABBD4]">Workspace</p><p className="mt-2 font-semibold">{roleTitle(role)}</p></div></div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(({path,label,icon:Icon})=><button key={path} type="button" onClick={()=>onNavigate(TAB_FOR_PAGE[path])} className="group rounded-xl border p-5 text-left transition-colors hover:border-[#4F8CFF]" style={{borderColor:'var(--cc-border)',background:'var(--cc-surface)'}}><div className="mb-4 flex items-center justify-between"><Icon size={23} style={{color:'var(--cc-blue)'}}/><ArrowRight size={17} style={{color:'var(--cc-text-muted)'}}/></div><h2 className="font-semibold">{label}</h2><p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>{descriptions[path]}</p></button>)}</div>
  <button type="button" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" onClick={()=>onNavigate('profile')}><UserRound size={17}/>My {roleTitle(role)} profile</button>
 </section>;
}
