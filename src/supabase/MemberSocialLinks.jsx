/** Private professional social link editor, shared across every member role.
 * Links are visible to other people only when owner opts in AND viewer is premium and verified. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const fields=[
 ['onlyfans','OnlyFans','onlyfans.com'],['fansly','Fansly','fansly.com'],
 ['twitter','X / Twitter','x.com'],['instagram','Instagram','instagram.com']
];
const input='mt-1 w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)]';
export default function MemberSocialLinks({userId}){
 const [values,setValues]=useState({}),[share,setShare]=useState(false),[working,setWorking]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {data,error:readError}=await supabase.from('member_social_links').select('links,share_with_premium').eq('user_id',userId).maybeSingle();
   if(!live)return;
   if(readError)setError(readError.message);
   else if(data){setValues(data.links||{});setShare(data.share_with_premium===true);}
  })().catch(e=>{if(live)setError(e.message);});
  return()=>{live=false};
 },[userId]);
 const save=async e=>{
  e.preventDefault();setError('');setMessage('');setWorking(true);
  try{
   const links={};
   for(const [key,,domain] of fields){
    const raw=String(values[key]||'').trim();
    if(!raw)continue;
    const url=new URL(raw);
    const valid=key==='twitter'?['x.com','twitter.com'].includes(url.hostname.toLowerCase().replace(/^www\./,''))
     :url.hostname.toLowerCase().replace(/^www\./,'')===domain;
    if(url.protocol!=='https:'||!valid||url.username||url.password)
     throw Error('Use official HTTPS profile links for '+key+'.');
    links[key]=url.toString();
   }
   const {error:writeError}=await supabase.from('member_social_links').upsert({
    user_id:userId,links,share_with_premium:share,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(writeError)throw writeError;
   setMessage('Professional links saved '+(share?'and available to verified premium viewers.':'privately.') );
  }catch(err){setError(err.message||'Unable to save links.');}finally{setWorking(false);}
 };
 return <section className="ccx-surface space-y-4 p-5">
  <h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={18} className="text-[var(--cc-link)]"/>Professional social links</h3>
  <p className="text-xs text-[var(--cc-text-secondary)]">Links are private by default and never visible to free members. You control whether verified premium members can see them.</p>
  {error&&<p role="alert" className="text-xs text-red-800">{error}</p>}
  {message&&<p role="status" className="text-xs text-emerald-800">{message}</p>}
  <form onSubmit={save} className="space-y-3">
   <div className="grid gap-3 sm:grid-cols-2">
    {fields.map(([key,label,domain])=><label key={key} className="text-sm">{label}
     <input className={input} type="url" placeholder={'https://'+domain+'/username'}
      value={values[key]||''} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}
   </div>
   <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" className="mt-1" checked={share} onChange={e=>setShare(e.target.checked)}/>
    Show these links only to verified Premium members
   </label>
   <button className="ccx-primary rounded-xl px-4 py-2.5 text-sm font-semibold" disabled={working}>
    {working?'Saving…':'Save professional links'}</button>
  </form>
 </section>;
}
