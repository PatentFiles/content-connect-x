import CatalogDetail from './CatalogDetail';
import React,{useEffect,useState} from 'react';
import {ShoppingBag,ExternalLink,RefreshCw,ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const filters=[['all','All items'],['dildos','Dildos'],['vibrators','Vibrators'],['couples','Couples’ accessories'],['care','Storage & care'],['bdsm-furniture','BDSM furniture'],['positioning','Positioning'],['machines','Premium machines'],['attachments','Attachments'],['restraints','Restraints'],['lingerie','Lingerie'],['gender-affirming','Gender-affirming'],['toys','Toys'],['lubricants','Lubricants']];
const field='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2.5 text-sm';
const btn='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50';
async function call(action,params={}){
 const {data,error}=await supabase.functions.invoke('shop-directory',{body:{action,...params}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Shop partners unavailable';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{/* retain original */}
  throw Error(message);
 }
 return data;
}
export default function AffiliateShop({isAdmin=false}){
 const [selected,setSelected]=useState(null);
 const [items,setItems]=useState([]),[active,setActive]=useState('all'),[drafts,setDrafts]=useState({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const result=await call('list');
   setItems(result.items||[]);
   setDrafts(Object.fromEntries((result.items||[]).map(x=>[x.slug,{affiliate_url:x.affiliate_url||'',partner_status:x.partner_status}])));
  }catch(e){setError(e.message);}finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);
 const save=async partner=>{
  setBusy(partner.slug);setError('');setNotice('');
  try{
   const next=drafts[partner.slug];
   await call('save_partner',{slug:partner.slug,affiliate_url:next.affiliate_url,partner_status:next.partner_status});
   setNotice(partner.name+' partner setting saved.');await load();
  }catch(e){setError(e.message);}finally{setBusy('');}
 };
 const categories=items.filter(item=>active==='all'||item.categories?.includes(active));
 return <section className="mx-auto w-full space-y-6" data-affiliate-shop="true">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingBag size={23}/>Content ConnectX Shop</h1>
    <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Curated adult-product and specialty-furniture brands. Browse the manufacturer’s own store for inventory, checkout, fulfillment, and customer service.</p></div>
   <button type="button" className={btn} onClick={()=>void load()} disabled={loading}><RefreshCw size={16} className="mr-1 inline"/>Refresh</button>
  </header>
  <p className="rounded-xl border border-[var(--cc-border)] p-4 text-sm">External merchant storefronts handle payment and delivery. Some links may earn Content ConnectX a commission when an approved affiliate relationship is active, at no additional cost to you. Prices, warranties and shipping policies are set by each merchant.</p>
  <div className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap" aria-label="Shop categories">
   {filters.map(([key,label])=><button type="button" key={key} className={active===key?'ccx-primary rounded-xl px-3 py-2 text-sm':btn} aria-pressed={active===key} onClick={()=>setActive(key)}>{label}</button>)}
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-400 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {loading&&<p role="status" className="text-sm">Loading partner brands…</p>}
  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
   {categories.map(partner=><article key={partner.slug} className="ccx-surface flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl p-5">
    {(partner.kind==='product'||partner.image_url)&&<button type="button" className="-mx-5 -mt-5 grid aspect-square place-items-center overflow-hidden bg-[var(--cc-surface-subtle)]" aria-label={'View '+partner.name} onClick={()=>setSelected(partner)}>{partner.image_url?<img src={partner.image_url} alt={partner.name} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105"/>:<ShoppingBag size={48} className="text-[var(--cc-text-secondary)]"/>}</button>}
    <div>{partner.brand&&<p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-secondary)]">{partner.brand}</p>}<h2 className="text-lg font-semibold">{partner.name}</h2>{Number.isFinite(partner.price_cents)&&<p className="mt-2 text-lg font-bold">{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(partner.price_cents/100)}</p>}
     <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">{partner.description}</p></div>
    <div className="flex flex-wrap gap-1">{(partner.categories||[]).map(tag=><span key={tag} className="rounded-full border border-[var(--cc-border)] px-2 py-1 text-xs capitalize">{tag.replaceAll('-',' ')}</span>)}</div>
    <p className="mt-auto flex items-center gap-2 text-xs"><ShieldCheck size={15}/>{partner.demo?'Demonstration catalog':partner.shipping_by_partner?'Checkout and shipping through the retailer':'Shipping terms to be confirmed'}</p>
    {partner.kind==='product'?<button type="button" className="ccx-primary min-h-11 rounded-xl px-4 py-2 text-sm" onClick={()=>setSelected(partner)}>View details</button>:partner.purchase_url?<a href={partner.purchase_url} target="_blank" rel="sponsored noopener noreferrer" className="ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm">Visit {partner.name}<ExternalLink size={15}/></a>
     :<p className="text-xs text-[var(--cc-text-secondary)]">Supplier details being verified; no purchase link published.</p>}
    {partner.tracked&&<p className="text-xs">Affiliate referral link active</p>}
    {isAdmin&&partner.kind!=='product'&&<div className="space-y-2 border-t border-[var(--cc-border)] pt-3"><h3 className="text-sm font-semibold">Administrator partner configuration</h3>
    {partner.application_url&&<a href={partner.application_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[var(--cc-link)] underline">Apply to {partner.name} affiliate program</a>}
     <label className="block text-xs">Approved referral URL<input className={field+' mt-1'} type="url" value={drafts[partner.slug]?.affiliate_url||''} placeholder="https://..." onChange={e=>setDrafts(d=>({...d,[partner.slug]:{...d[partner.slug],affiliate_url:e.target.value}}))}/></label>
     <label className="block text-xs">Partner status<select className={field+' mt-1'} value={drafts[partner.slug]?.partner_status||'prospect'} onChange={e=>setDrafts(d=>({...d,[partner.slug]:{...d[partner.slug],partner_status:e.target.value}}))}><option value="prospect">Prospect (official link only)</option><option value="approved">Affiliate relationship approved</option><option value="paused">Paused (official link only)</option></select></label>
     <button type="button" className={btn} disabled={Boolean(busy)} onClick={()=>void save(partner)}>{busy===partner.slug?'Saving…':'Save partner'}</button>
    </div>}
   </article>)}
  </div>
  {!loading&&!categories.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No verified partners in this category yet. More suppliers can be added after their merchandise and fulfillment are verified.</p>}
  {selected&&<CatalogDetail item={selected} onClose={()=>setSelected(null)}/>}
 </section>;
}
