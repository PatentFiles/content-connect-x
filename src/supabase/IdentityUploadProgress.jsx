/** Never simulate a percentage. The browser measures transferred bytes; only
 * the server's matching receipt can display Saved privately. */
import React from 'react';
import {CheckCircle2,Loader2} from 'lucide-react';
export default function IdentityUploadProgress({progress,label}){
 if(!progress)return null;
 const {phase,percent}=progress;
 const completed=phase==='complete',failed=phase==='error';
 const text=completed?'Saved privately':failed?'Save not confirmed — check status before retrying.':phase==='authorizing'?'Preparing secure upload…':phase==='saving'?'Saving securely… waiting for confirmation.':'Uploading photo…';
 return <div className="mt-3 space-y-2" data-upload-phase={phase}>
  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
   <p role="status" aria-live="polite" className={'flex items-center gap-2 '+(completed?'text-emerald-800':failed?'text-red-800':'text-slate-700')}>
    {completed?<CheckCircle2 size={18} aria-hidden="true"/>:!failed&&<Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true"/>}<span>{text}</span>
   </p>
   <span className="font-mono text-sm tabular-nums text-slate-700">{Number.isFinite(percent)?`${percent}% uploaded`:'Uploading…'}</span>
  </div>
  <progress aria-label={`${label} upload progress`} max={100} value={Number.isFinite(percent)?percent:undefined} className="block h-3 w-full" style={{accentColor:'var(--cc-action)'}}/>
  {phase==='saving'&&<p className="text-xs leading-5 text-slate-600">Your photo has uploaded. Keep this page open while it is saved privately.</p>}
 </div>;
}
