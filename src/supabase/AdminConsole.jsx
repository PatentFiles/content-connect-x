/** Consolidated admin hub. Each domain remains an isolated, reusable component. */
import React,{useState} from 'react';
import AdminProductControls from './AdminProductControls';
import IntegrationHealth from './IntegrationHealth';
import PassClearanceHub from './PassClearanceHub';
import SecurityCenter from './SecurityCenter';
const sections=[
 {key:'features',title:'Modules & rollouts'},
 {key:'integrations',title:'APIs & provider keys'},
 {key:'testing',title:'Testing & PASS reviews'},
 {key:'security',title:'Account security'}
];
export default function AdminConsole({initialSection='features'}){
 const [section,setSection]=useState(initialSection);
 return <div className="space-y-5">
  <header className="space-y-2">
   <p className="text-xs font-semibold uppercase tracking-widest text-[#FF84D7]">Content Connect X administration</p>
   <h1 className="text-2xl font-bold">Platform control center</h1>
   <p className="text-sm text-[#ACBED6]">Turn individual modules on or off, control membership rollouts, connect providers, and review private testing submissions. Privileged changes require administrator MFA. Credentials are never stored in browser settings.</p>
  </header>
  <div role="tablist" aria-label="Administration areas" className="flex flex-wrap gap-2">
   {sections.map(item=><button key={item.key} type="button" role="tab" aria-selected={section===item.key}
    onClick={()=>setSection(item.key)} className={(section===item.key?'ccx-primary':'ccx-secondary')+' rounded-xl px-3 py-2.5 text-sm'}>{item.title}</button>)}
  </div>
  <div role="tabpanel">
   {section==='features'&&<AdminProductControls/>}
   {section==='integrations'&&<IntegrationHealth/>}
   {section==='testing'&&<PassClearanceHub isAdmin/>}
   {section==='security'&&<SecurityCenter/>}
  </div>
 </div>;
}
