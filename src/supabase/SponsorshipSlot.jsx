/** Reviewed text-only professional sponsorship. No image beacon, third-party script,
 * visitor category, sexual-orientation signal, per-viewer tracking ID or impression cookie.
 * When no contracted/approved campaign exists, nothing is rendered.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
export default function SponsorshipSlot({placement='feed'}){
 const [item,setItem]=useState(null);
 useEffect(()=>{let active=true;void supabase.from('ccx_sponsorship_campaigns')
  .select('id,sponsor_name,headline,link_url,disclosure')
  .eq('placement',placement).eq('approved',true).order('starts_at',{ascending:false}).limit(1)
  .then(({data,error})=>{if(active&&!error)setItem(data?.[0]||null);})
  .catch(()=>{});return()=>{active=false;};
 },[placement]);
 if(!item)return null;
 let safe=false;try{const u=new URL(item.link_url);safe=u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{}
 if(!safe)return null;
 return <aside aria-label="Sponsored professional service" className={'ccx-surface min-w-0 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] '+(placement==='sidebar'?'mx-3 my-3 p-3':'p-4')}>
  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">Advertisement · Sponsored</p>
  <h3 className="mt-2 text-sm font-semibold text-[var(--cc-text-primary)]">{item.sponsor_name}</h3>
  <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">{item.headline}</p>
  <a className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--cc-link)] underline underline-offset-4" href={item.link_url} rel="sponsored nofollow noopener noreferrer" target="_blank">Visit sponsor</a>
  <p className="mt-1 text-[10px] leading-4 text-[var(--cc-text-muted)]">{item.disclosure}</p>
 </aside>;
}
