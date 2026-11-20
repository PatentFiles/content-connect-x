import React,{useEffect,useState} from 'react';
import {Sparkles,RefreshCw,X} from 'lucide-react';
import {suiteAction} from './collabSuiteApi';
export default function AIMatchSuggestions(){
 const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{try{const r=await suiteAction('matches_list');setItems(r.items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[]);
 const generate=async()=>{setBusy(true);setError('');setNotice('');try{const r=await suiteAction('matches_generate');setNotice(r.count+' compatible suggestions generated.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const dismiss=async id=>{try{await suiteAction('match_dismiss',{suggested_user_id:id});await load();}catch(e){setError(e.message);}};
 return <section className="ccx-surface space-y-3 p-5" data-ai-match-suggestions="true">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={19}/>AI collaboration suggestions</h3><p className="text-xs text-[var(--cc-text-secondary)]">Only members with overlapping saved collaboration interests are recommended. Suggestions are not automatic invitations.</p></div><button type="button" disabled={busy} className="ccx-secondary rounded-xl px-3 py-2 text-sm" onClick={()=>void generate()}><RefreshCw size={15} className="mr-1 inline"/>{busy?'Finding matches…':'Refresh matches'}</button></div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
  <div className="grid gap-2 sm:grid-cols-2">{items.map(x=><article key={x.suggested_user_id} className="rounded-xl border border-[var(--cc-border)] p-3"><div className="flex justify-between gap-2"><b>{x.profile.display_name} · {x.score}%</b><button type="button" aria-label="Dismiss suggestion" onClick={()=>void dismiss(x.suggested_user_id)}><X size={16}/></button></div><p className="text-xs text-[var(--cc-text-secondary)]">{[x.profile.city,x.profile.state,x.profile.country].filter(Boolean).join(', ')}</p>{(x.reasons||[]).map((reason,index)=><p key={index} className="mt-1 text-xs">{reason}</p>)}</article>)}</div>
  {!items.length&&<p className="text-sm text-[var(--cc-text-secondary)]">Complete your collaboration preferences and select Refresh matches to find compatible people.</p>}
 </section>;
}