/** Consolidated admin hub. Each domain remains an isolated, reusable component. */
import React,{useState} from 'react';
import AdminProductControls from './AdminProductControls';
import IntegrationHealth from './IntegrationHealth';
import PassClearanceHub from './PassClearanceHub';
import SecurityCenter from './SecurityCenter';
import MembershipPlanAdmin from './MembershipPlanAdmin';
import IdentityEvidenceAdmin from './IdentityEvidenceAdmin';
import IdentityPilot from './IdentityPilot';
import AIAgentAdmin from './AIAgentAdmin';
import VideoProviderSettings from './VideoProviderSettings';
import AdminTrustInbox from './AdminTrustInbox';
import AdminOperations from './AdminOperations';
import AdminSafetyOperations from './AdminSafetyOperations';
import LawEnforcementAdmin from './LawEnforcementAdmin';
const sections=[
 {key:'operations',title:'Operational readiness'},
 {key:'features',title:'Modules & rollouts'},
 {key:'pricing',title:'Membership pricing'},
 {key:'integrations',title:'APIs & provider keys'},
 {key:'identity-test',title:'Test my ID'},
 {key:'identity',title:'Identity evidence'},
 {key:'testing',title:'Testing & PASS reviews'},
 {key:'support-inbox',title:'Support & requests'},
 {key:'safety-settings',title:'Safety operator & policies'},
 {key:'law-enforcement',title:'Law enforcement access'},
 {key:'video-provider',title:'Video meetings'},
 {key:'ai-safety',title:'AI agents & risk'},
 {key:'security',title:'Account security'}
];
export default function AdminConsole({initialSection='features',onFeatureChange}){
 const [section,setSection]=useState(initialSection);
 return <div className="space-y-5">
  <header className="space-y-2">
   <p className="text-xs font-semibold uppercase tracking-widest text-[var(--cc-link)]">Content Connect X administration</p>
   <h1 className="text-2xl font-bold">Platform control center</h1>
   <p className="text-sm text-[var(--cc-text-secondary)]">Turn individual modules on or off, control membership rollouts, connect providers, and review private testing submissions. Privileged changes require administrator permissions. Provider credential changes and confidential operations require two-factor authentication. Credentials are never stored in browser settings.</p>
  </header>
  <div role="tablist" aria-label="Administration areas" className="flex flex-wrap gap-2">
   {sections.map(item=><button key={item.key} type="button" role="tab" aria-selected={section===item.key}
    onClick={()=>setSection(item.key)} className={(section===item.key?'ccx-primary':'ccx-secondary')+' rounded-xl px-3 py-2.5 text-sm'}>{item.title}</button>)}
  </div>
  <div role="tabpanel">
   {section==='operations'&&<AdminOperations onSelect={setSection}/>}
   {section==='features'&&<AdminProductControls onFeatureChange={onFeatureChange}/>}
   {section==='pricing'&&<MembershipPlanAdmin/>}
   {section==='integrations'&&<IntegrationHealth/>}
   {section==='identity-test'&&<IdentityPilot/>}
   {section==='identity'&&<IdentityEvidenceAdmin/>}
   {section==='testing'&&<PassClearanceHub isAdmin/>}
   {section==='support-inbox'&&<AdminTrustInbox/>}
   {section==='safety-settings'&&<AdminSafetyOperations/>}
   {section==='law-enforcement'&&<LawEnforcementAdmin/>}
   {section==='video-provider'&&<VideoProviderSettings/>}
   {section==='ai-safety'&&<AIAgentAdmin/>}
   {section==='security'&&<SecurityCenter/>}
  </div>
 </div>;
}
