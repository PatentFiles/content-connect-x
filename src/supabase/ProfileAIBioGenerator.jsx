/** Bio drafts are never automatically published or treated as verified facts. */
import React,{useState} from 'react';
import {Sparkles} from 'lucide-react';
import {creatorAi} from './creatorAiApi';
const field='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
export default function ProfileAIBioGenerator({role='creator',onApply}){
 const [open,setOpen]=useState(false),[prompt,setPrompt]=useState(''),[draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const generate=async()=>{
  if(prompt.trim().length<8)return;
  setBusy(true);setError('');setDraft('');
  try{
   const result=await creatorAi('bio',{background:'Professional role: '+role+'. '+prompt});
   setDraft(result.draft||'');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-2 rounded-xl border border-[var(--cc-border)] p-3" data-ai-bio="true">
  <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="ccx-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm">
   <Sparkles size={16}/>{open?'Hide AI bio draft':'Generate an AI bio draft'}
  </button>
  {open&&<div className="space-y-2">
   <p className="text-xs text-[var(--cc-text-secondary)]">Write a few details about your work. This sends only the text you enter to your configured OpenAI project. Avoid sensitive health, testing or identity information.</p>
   <textarea className={field} rows={3} maxLength={2000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Your specialties, professional style, favorite shoot locations and collaborators…"/>
   <button type="button" disabled={busy||prompt.trim().length<8} className="ccx-primary min-h-11 rounded-xl px-4 py-2 text-sm" onClick={()=>void generate()}>{busy?'Generating…':'Generate draft'}</button>
   {draft&&<div className="space-y-2">
    <label className="block text-xs font-medium">Editable suggestion<textarea className={field} rows={5} value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)}/></label>
    <button type="button" className="ccx-secondary min-h-11 rounded-xl px-4 py-2 text-sm" onClick={()=>{onApply?.(draft);setOpen(false);}}>Use in profile editor (save separately)</button>
   </div>}
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  </div>}
 </section>;
}
