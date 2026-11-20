import React,{useEffect,useState} from 'react';
import {ShieldAlert,Sparkles,RefreshCw} from 'lucide-react';
import {suiteAction} from './collabSuiteApi';
import {TestingReviewQueue} from './CollaborationTesting';
const btn='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-60';
const cell='border-b border-[var(--cc-border)] p-3 text-sm';
export default function AIAgentAdmin(){
 const [data,setData]=useState({runs:[],flags:[],risks:[]}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [apiKey,setApiKey]=useState(''),[keyStatus,setKeyStatus]=useState(null);
 const load=async()=>{try{setData(await suiteAction('agent_dashboard'));}catch(e){setError(e.message);}};
 useEffect(()=>{
  void load();
  suiteAction('ai_key_status').then(setKeyStatus).catch(e=>setError(e.message));
 },[]);
 const saveKey=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   await suiteAction('ai_key_save',{api_key:apiKey});
   setApiKey('');setKeyStatus({configured:true,source:'encrypted_vault'});
   setNotice('Encrypted OpenAI key saved. Bio generation, matching, transcription, safety scans and AI contract drafts now share this credential.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const scan=async()=>{setBusy(true);setError('');setNotice('');try{const r=await suiteAction('agent_scan');setNotice('Scanned '+r.scanned_count+' records and created '+r.flags_created+' review flags.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const review=async id=>{setBusy(true);setError('');try{await suiteAction('agent_flag_review',{id,review_note:'Reviewed in administrator console'});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="space-y-5">
 <section className="ccx-surface space-y-3 p-5"><h3 className="text-lg font-semibold">Shared OpenAI API credential</h3>
 <p className="text-sm text-[var(--cc-text-secondary)]">Paste your OpenAI key once. It is encrypted in Supabase Vault and never returned to the browser. All five AI tools read the same key automatically.</p>
 <p className="text-xs">{keyStatus?.configured?'OpenAI credential configured':'OpenAI credential not yet entered'}</p>
 <div className="flex flex-wrap gap-2"><input type="password" autoComplete="off" spellCheck={false} aria-label="OpenAI API key"
 className="min-w-0 flex-1 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm"
 placeholder="sk-..." value={apiKey} onChange={e=>setApiKey(e.target.value)}/>
 <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||apiKey.length<20} onClick={()=>void saveKey()}>Save OpenAI key</button></div>
 </section>
 <section className="ccx-surface space-y-3 p-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex gap-2 text-lg font-semibold"><ShieldAlert size={19}/>AI safety agent</h3><div className="flex gap-2"><button className={btn} disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/></button><button className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy} onClick={()=>void scan()}><Sparkles size={16} className="mr-1 inline"/>Run safety scan</button></div></div>
 <p className="text-xs text-[var(--cc-text-secondary)]">OpenAI scans professional profiles and collaboration descriptions. Risk predictions and alerts support human review; they do not automatically sanction members.</p>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 <h4 className="font-semibold">Agent execution history</h4><div className="max-h-64 overflow-y-auto">{data.runs.map(x=><div className={cell} key={x.id}>{x.agent_type} · {x.status} · {x.scanned_count} reviewed · {x.flags_created} flags · {new Date(x.started_at).toLocaleString()}{x.error_message&&<p className="text-red-700">{x.error_message}</p>}</div>)}</div>
 <h4 className="font-semibold">Agent flags</h4><div className="max-h-80 overflow-y-auto">{data.flags.map(x=><div className={cell} key={x.id}><b className="capitalize">{x.severity} · {x.category}</b><p>{x.reason}</p><p className="text-xs">{x.entity_type} · {x.entity_id}</p>{x.reviewed_at?<p className="text-xs">Reviewed {new Date(x.reviewed_at).toLocaleString()}</p>:<button className={btn+' mt-2'} type="button" disabled={busy} onClick={()=>void review(x.id)}>Mark reviewed</button>}</div>)}</div>
 <h4 className="font-semibold">AI risk predictions</h4><div className="max-h-80 overflow-y-auto">{data.risks.map(x=><div className={cell} key={x.id}><b>{x.score}/100 · {x.entity_type}</b> · {x.entity_id.slice(0,8)}<p className="text-xs">{(x.reasons||[]).join(' · ')}</p></div>)}</div>
 </section><TestingReviewQueue/></div>;
}