/** A real, account-persistent Feed settings panel shared by regular and admin
 * settings pages. Private RLS restricts every read and write to this user.
 */
import React,{useEffect,useState} from 'react';
import {SlidersHorizontal,Save} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {
 DEFAULT_FEED_PREFERENCES,FEED_AUDIENCES,FEED_VIEWS,
 loadFeedPreferences,saveFeedPreferences
} from './feedDisplayPreferences.mjs';

export default function FeedPreferencesSettings({userId}){
 const [value,setValue]=useState(DEFAULT_FEED_PREFERENCES);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setNotice('');
  void loadFeedPreferences(supabase,userId).then(p=>{if(live)setValue(p);})
   .catch(e=>{if(live)setError(e.message);})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[userId]);
 const save=async e=>{
  e.preventDefault();if(saving||loading)return;
  setSaving(true);setError('');setNotice('');
  try{
   const updated=await saveFeedPreferences(supabase,userId,value);
   setValue(updated);
   window.dispatchEvent(new CustomEvent('ccx-feed-display-preferences-changed',{detail:{user_id:userId,...updated}}));
   setNotice('Your Feed preferences were saved to your account and will be used on your next visit.');
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <section data-feed-preferences-settings="true" className="ccx-surface min-w-0 space-y-3 rounded-2xl p-5">
  <div className="flex items-center gap-2"><SlidersHorizontal size={20} className="text-[var(--cc-link)]"/><h2 className="font-semibold">Feed preferences</h2></div>
  <p className="text-xs text-[var(--cc-text-secondary)]">Choose what appears on your home Feed and who can see new posts. Saved choices stay with your account across devices. Previous posts keep their original audience.</p>
  <form className="space-y-3" onSubmit={save}>
   <label className="block text-sm font-medium">Show posts from
    <select aria-label="Default Feed view" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 text-sm"
     disabled={loading||saving} value={value.feed_view}
     onChange={e=>{setValue(v=>({...v,feed_view:e.target.value}));setNotice('');}}>
     {FEED_VIEWS.map(({value,label})=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <label className="block text-sm font-medium">Who can see my new posts
    <select aria-label="Default post audience" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 text-sm"
     disabled={loading||saving} value={value.default_audience}
     onChange={e=>{setValue(v=>({...v,default_audience:e.target.value}));setNotice('');}}>
     {FEED_AUDIENCES.map(({value,label})=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <button type="submit" className="ccx-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm" disabled={loading||saving}><Save size={16}/>{saving?'Saving…':'Save Feed preferences'}</button>
  </form>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="text-xs text-[var(--cc-text-secondary)]">{notice}</p>}
 </section>;
}
