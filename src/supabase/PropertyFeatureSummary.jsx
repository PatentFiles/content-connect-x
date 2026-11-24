/** Display the same approved features in listing detail, with no raw enum labels. */
import React from 'react';
import {Check} from 'lucide-react';
import {amenityGroups,accessibility} from '../../supabase/functions/_shared/propertyFeatureCatalog.mjs';
export default function PropertyFeatureSummary({property}){
 const groups=[...amenityGroups.map(group=>({...group,items:group.items.filter(([id])=>property?.amenities?.includes(id))})),
  {title:'Accessibility',items:accessibility.filter(([id])=>property?.accessibility_features?.includes(id))}].filter(g=>g.items.length);
 if(!groups.length)return null;
 return <section className="space-y-4 border-t border-[var(--cc-border)] pt-4" aria-label="Property features"><h3 className="font-semibold">Property features</h3>
  {groups.map(group=><div key={group.title}><h4 className="mb-2 text-sm font-semibold">{group.title}</h4><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{group.items.map(([id,label])=><span key={id} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-[var(--cc-link)]"/>{label}</span>)}</div></div>)}
  <p className="text-xs text-[var(--cc-text-secondary)]">Host-declared features. Confirm any specific accessibility, equipment or privacy requirements with the host before booking.</p>
 </section>;
}
