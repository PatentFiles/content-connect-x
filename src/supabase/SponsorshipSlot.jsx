/** Approved professional sponsorships only. No third-party scripts, tracking
 * pixels, sensitive targeting, per-user identity or fabricated impressions.
 * The sidebar can show multiple independently reviewed PPC/affiliate links once
 * providers and campaign approvals exist. Empty inventory renders nothing.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';

function safeDestination(value){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.port;
 }catch{return false;}
}
export default function SponsorshipSlot({placement='feed'}){
 const [items,setItems]=useState([]);
 useEffect(()=>{
  let alive=true;setItems([]);
  if(typeof supabase?.from!=='function')return()=>{alive=false;};
  try{
   void supabase.from('ccx_sponsorship_campaigns')
    .select('id,sponsor_name,headline,link_url,disclosure')
    .eq('placement',placement).eq('approved',true)
    .order('starts_at',{ascending:false}).limit(placement==='sidebar'?3:1)
    .then(({data,error})=>{
     if(alive&&!error)setItems((data||[]).filter(item=>safeDestination(item.link_url)));
    },()=>{});
  }catch{/* Optional advertiser inventory is unavailable: render no ads. */}
  return()=>{alive=false;};
 },[placement]);
 if(!items.length)return null;
 return <div className="space-y-3" data-sponsored-campaigns={placement}>
  {items.map(item=><aside key={item.id} aria-label="Sponsored professional service"
   className={'ccx-surface min-w-0 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] '+(placement==='sidebar'?'p-3':'p-4')}>
   <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">Advertisement · Sponsored</p>
   <h3 className="mt-2 break-words text-sm font-semibold text-[var(--cc-text-primary)]">{item.sponsor_name}</h3>
   <p className="mt-1 break-words text-sm text-[var(--cc-text-secondary)]">{item.headline}</p>
   <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--cc-link)] underline underline-offset-4"
    href={item.link_url} rel="sponsored nofollow noopener noreferrer" target="_blank"
    referrerPolicy="no-referrer">Visit sponsor</a>
   <p className="mt-1 text-[10px] leading-4 text-[var(--cc-text-muted)]">{item.disclosure}</p>
  </aside>)}
 </div>;
}
