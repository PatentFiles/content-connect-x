import React,{useEffect,useRef} from 'react';
import {ShoppingBag,X} from 'lucide-react';
export default function CatalogDetail({item,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{const el=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';el?.showModal();return()=>{el?.close();document.body.style.overflow=overflow;if(focused instanceof HTMLElement&&focused.isConnected)focused.focus();};},[]);
 return <dialog ref={dialog} className="w-[min(720px,calc(100vw-32px))] rounded-3xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-0 text-[var(--cc-text-primary)] shadow-2xl backdrop:bg-black/50" aria-label={item.name} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="relative grid gap-6 p-5 sm:grid-cols-2 sm:p-7"><button type="button" className="ccx-secondary absolute right-3 top-3 rounded-full p-2" onClick={onClose} aria-label="Close product details"><X size={20}/></button>
   <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[var(--cc-surface-subtle)]">{item.image_url?<img src={item.image_url} alt={item.name} className="h-full w-full object-cover"/>:<ShoppingBag size={56} className="text-[var(--cc-text-secondary)]"/>}</div>
   <div className="space-y-4 py-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--cc-text-secondary)]">{item.brand||'Independent supplier'}</p><h2 className="text-2xl font-bold">{item.name}</h2>{Number.isFinite(item.price_cents)&&<p className="text-xl font-semibold">{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(item.price_cents/100)}</p>}<p className="text-sm leading-6">{item.description}</p><div className="flex flex-wrap gap-2">{item.categories?.map(c=><span key={c} className="rounded-full border border-[var(--cc-border)] px-3 py-1 text-xs capitalize">{c.replaceAll('-',' ')}</span>)}</div>{item.demo?<p className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-xs">Fictional demonstration product. No stock, supplier partnership or checkout is represented.</p>:item.purchase_url&&<a className="ccx-primary inline-flex rounded-xl px-4 py-3 text-sm" href={item.purchase_url} target="_blank" rel="sponsored noopener noreferrer">Visit the supplier</a>}</div>
  </div>
 </dialog>;
}
