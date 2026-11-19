/** Informational, never an authorization to film or issue a contract. */
import React from 'react';
import {AlertCircle,CheckCircle2,ClipboardCheck} from 'lucide-react';
import {summarizeProductionReadiness} from './productionReadinessPolicy.mjs';
export default function ProductionReadinessChecklist({detail}){
 const status=summarizeProductionReadiness(detail);
 return <section className="min-w-0 space-y-4 rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4 sm:p-5" aria-label="Production readiness checklist" data-production-readiness="true">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><ClipboardCheck size={19} className="text-[var(--cc-link)]"/>Production readiness</h3><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Review what is confirmed and what needs action before a production.</p></div>
    <span className="rounded-full border border-[var(--cc-border)] bg-white px-3 py-1 text-xs font-semibold">{status.complete} / {status.total} checks</span>
  </header>
  <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={status.total||1} aria-valuenow={status.complete} aria-label="Production readiness checks confirmed"><div className="h-full rounded-full bg-[var(--cc-link)] transition-[width] motion-reduce:transition-none" style={{width:(status.total?100*status.complete/status.total:0)+'%'}}/></div>
  <ul className="grid min-w-0 gap-2 sm:grid-cols-2">{status.items.map(item=><li key={item.id} className="min-w-0 rounded-xl border border-[var(--cc-border)] bg-white p-3"><div className="flex items-start gap-2">{item.status==='confirmed'?<CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-700" aria-label="Confirmed"/>:<AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-800" aria-label="Needs action"/>}<div className="min-w-0"><h4 className="text-sm font-semibold">{item.label}</h4>{item.status!=='confirmed'&&<p className="mt-1 text-xs leading-5 text-[var(--cc-text-secondary)]">{item.help}</p>}</div></div></li>)}</ul>
  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">This checklist is a planning guide only. It does not authorize filming, verify consent, sign an agreement or confirm a property reservation. Each required action is validated independently by its server/provider workflow.</p>
 </section>;
}
