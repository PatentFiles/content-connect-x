import React,{useEffect,useState} from 'react';
import {Camera,Boxes} from 'lucide-react';
import {hostingAdvanced} from './hostingBusinessApi';
const panel='ccx-surface p-4';
const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm text-[var(--cc-text-primary)]';
const button='rounded-lg ccx-action-primary px-4 py-2 text-sm font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const empty={label:'',category:'camera',description:'',quantity:1,hourly_cents:2500,daily_cents:null,condition:'good',active:true};
export default function HostingEquipmentManager({propertyId}){
 const [assets,setAssets]=useState([]),[bundles,setBundles]=useState([]);
 const [item,setItem]=useState(empty),[bundle,setBundle]=useState({title:'',discount_bps:1000,items:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  if(!propertyId)return;
  setBusy(true);setError('');
  try{
   const [a,b]=await Promise.all([hostingAdvanced('host_addons_list',{property_id:propertyId}),hostingAdvanced('addons_public',{property_id:propertyId})]);
   setAssets(a.items||[]);setBundles(b.bundles||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{load();},[propertyId]);
 const save=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{await hostingAdvanced('addon_upsert',{...item,property_id:propertyId});
   setItem(empty);setNotice('Equipment saved. Reserved quantities remain protected.');await load();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const saveBundle=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{await hostingAdvanced('bundle_create',{...bundle,property_id:propertyId});
   setBundle({title:'',discount_bps:1000,items:[]});setNotice('Equipment bundle created.');await load();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const toggle=(id,on)=>setBundle(v=>({...v,items:on?[...v.items,{id,quantity:1}]:v.items.filter(x=>x.id!==id)}));
 return <section className="space-y-4 text-[var(--cc-text-primary)]">
  <h3 className="flex gap-2 items-center text-lg font-semibold"><Camera size={18}/>Rentable equipment and production services</h3>
  <p className="text-xs text-[var(--cc-text-secondary)]">Cameras, lighting, microphones, furniture, sets and makeup stations share limited booking inventory.</p>
  {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
  {notice&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
  <form className={panel+' space-y-3'} onSubmit={save}>
   <h4 className="font-semibold">{item.id?'Update equipment':'Add equipment or service'}</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs col-span-2">Name<input required minLength={3} maxLength={160} className={input+' mt-1'} value={item.label} onChange={e=>setItem(v=>({...v,label:e.target.value}))}/></label>
    <label className="text-xs">Category<select className={input+' mt-1'} value={item.category} onChange={e=>setItem(v=>({...v,category:e.target.value}))}>{['camera','lighting','audio','furniture','set','makeup','equipment','service','other'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="text-xs">Quantity<input className={input+' mt-1'} type="number" min={1} max={1000} value={item.quantity} onChange={e=>setItem(v=>({...v,quantity:Number(e.target.value)}))}/></label>
    <label className="text-xs">Hourly USD<input className={input+' mt-1'} type="number" min={0} max={100000} step={0.01} value={item.hourly_cents/100} onChange={e=>setItem(v=>({...v,hourly_cents:Math.round(Number(e.target.value)*100)}))}/></label>
    <label className="text-xs">Daily USD (optional)<input className={input+' mt-1'} type="number" min={0} step={0.01} value={item.daily_cents==null?'':item.daily_cents/100} onChange={e=>setItem(v=>({...v,daily_cents:e.target.value===''?null:Math.round(Number(e.target.value)*100)}))}/></label>
    <label className="text-xs">Condition<select className={input+' mt-1'} value={item.condition} onChange={e=>setItem(v=>({...v,condition:e.target.value}))}>{['new','good','fair','maintenance','retired'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={item.active} onChange={e=>setItem(v=>({...v,active:e.target.checked}))}/>Available to rent</label>
   </div>
   <textarea maxLength={1500} className={input} rows={2} value={item.description} onChange={e=>setItem(v=>({...v,description:e.target.value}))} placeholder="Condition and specifications"/>
   <div className="ccx-action-row flex gap-2"><button className={button} disabled={busy}>Save equipment</button><button type="button" className={button+' bg-[var(--cc-surface)]'} onClick={()=>setItem(empty)}>New</button></div>
  </form>
  <div className={panel+' space-y-2'}>
   <h4 className="flex gap-2 font-semibold"><Boxes size={18}/>Inventory ({assets.length})</h4>
   {assets.map(a=><button type="button" className="flex w-full justify-between border-t border-[var(--cc-border)] py-2 text-left text-xs hover:text-[var(--cc-text-secondary)]" key={a.id} onClick={()=>setItem({...a,daily_cents:a.daily_cents??null})}>
    <span><strong>{a.label}</strong> · {a.category} · {a.quantity} units · {a.condition} · {a.active?'active':'inactive'}</span>
    <span>{'$'+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
+((a.daily_cents??a.hourly_cents*24)/100).toFixed(2)}/day</span>
   </button>)}
   {!assets.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No equipment registered yet.</p>}
  </div>
  <form className={panel+' space-y-3'} onSubmit={saveBundle}>
   <h4 className="font-semibold">Production bundles</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs">Name<input className={input+' mt-1'} required minLength={3} value={bundle.title} onChange={e=>setBundle(v=>({...v,title:e.target.value}))}/></label>
    <label className="text-xs">Bundle discount %<input className={input+' mt-1'} type="number" min={0} max={80} step={0.01} value={bundle.discount_bps/100} onChange={e=>setBundle(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
   </div>
   {assets.filter(a=>a.active&&!['maintenance','retired'].includes(a.condition)).map(a=>{
    const selected=bundle.items.find(x=>x.id===a.id);
    return <div className="flex gap-2 items-center text-xs" key={a.id}><label className="flex flex-1 gap-2"><input type="checkbox" checked={!!selected} onChange={e=>toggle(a.id,e.target.checked)}/>{a.label}</label>
     {selected&&<input className={input+' max-w-[100px]'} type="number" min={1} max={a.quantity} value={selected.quantity} onChange={e=>setBundle(v=>({...v,items:v.items.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x)}))}/>}
    </div>;
   })}
   <button disabled={busy||!bundle.items.length} className={button}>Create bundle</button>
   {bundles.map(v=><p className="border-t border-[var(--cc-border)] pt-2 text-xs text-[var(--cc-text-secondary)]" key={v.id}>{v.title} · {v.discount_bps/100}% off · {v.items?.length||0} items</p>)}
  </form>
 </section>;
}
