/** Attorney-approved DocuSign packet preparation; never signs inside the browser. */
import React, { useEffect, useState } from 'react';
import { FileSignature, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const input='w-full rounded-lg border border-[#34445D] bg-[#0F1520] p-2 text-sm';
const button='rounded-lg bg-[#4F8CFF] px-4 py-2 text-white font-semibold text-sm disabled:opacity-50';
const roles=['signer','approver','viewer'];
async function call(name,action,params={}){
  const {data,error}=await supabase.functions.invoke(name,{body:{action,...params}});
  if(error||data?.error)throw new Error(data?.error||error?.message||'Agreement service unavailable');
  return data;
}
export default function AgreementPackets(){
  const [contracts,setContracts]=useState([]);
  const [packets,setPackets]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [selected,setSelected]=useState('');
  const [template,setTemplate]=useState('');
  const [people,setPeople]=useState([]);
  const [recipients,setRecipients]=useState([]);
  const [order,setOrder]=useState(true);
  const [inspect,setInspect]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=async()=>{
    setBusy(true);setError('');
    try{
      const [c,p,t]=await Promise.all([
        call('member-workflows','list_contracts'),call('agreement-packets','my_packets'),call('agreement-packets','templates')
      ]);
      setContracts(c.items||[]);setPackets(p.items||[]);setTemplates(t.items||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  useEffect(()=>{load();},[]);
  const choose=async(id)=>{
    setSelected(id);setError('');setRecipients([]);
    if(!id)return;
    try{
      const contract=contracts.find(c=>c.id===id);
      const result=await call('member-workflows','list_collaboration_members',{collaboration_id:contract.collaboration_id});
      setPeople(result.items||[]);
      setRecipients((result.items||[]).map((m,i)=>({member_id:m.user_id,role:'signer',routing_order:i+1})));
    }catch(e){setError(e.message);}
  };
  const createDraft=async()=>{
    if(!selected)return;setBusy(true);setError('');setNotice('');
    try{
      const result=await call('agreement-packets','create_draft',{
        contract_id:selected,template_id:template||null,recipients,sequential:order
      });
      setNotice(result.note||'Draft packet prepared.');await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const inspectPacket=async(id)=>{
    setInspect(id);setError('');
    try{const result=await call('agreement-packets','packet_recipients',{envelope_id:id});setPeople(result.items||[]);}
    catch(e){setError(e.message);}
  };
  const evidence=async(id)=>{
    setBusy(true);setError('');
    try{
      const result=await call('agreement-packets','download_evidence',{envelope_id:id});
      for(const address of [result.signed_pdf,result.certificate]){
        const target=new URL(address);
        if(target.protocol==='https:')window.open(target.toString(),'_blank','noopener,noreferrer');
      }
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="space-y-5">
    <div className="flex justify-between items-center gap-3"><div><h2 className="text-2xl font-semibold flex items-center gap-2"><FileSignature size={23}/> DocuSign Agreement Center</h2><p className="text-sm text-[#9AA6BC] mt-1">Prepare signers, signing order and completed-document evidence. No internal prototype signing.</p></div><button className={button} onClick={load} disabled={busy}><RefreshCw size={16}/></button></div>
    {error&&<p role="alert" className="rounded-lg bg-red-950 text-red-200 p-3">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-950 text-emerald-200 p-3">{notice}</p>}
    <p className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 text-sm text-amber-200"><ShieldCheck size={17} className="inline mr-2"/>Formal signatures are disabled until DocuSign account authorization, attorney-approved templates, authenticated provider webhooks and the certificate archive are connected. Draft packets are not signed agreements.</p>
    <div className="grid md:grid-cols-2 gap-4">
      <div className={panel+' space-y-3'}><h3 className="font-semibold">Prepare signer routing</h3>
        <label className="block text-sm">Draft agreement<select className={input+' mt-1'} value={selected} onChange={e=>choose(e.target.value)}><option value="">Select a draft</option>{contracts.filter(x=>x.status==='draft').map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
        <label className="block text-sm">Reviewed template<select className={input+' mt-1'} value={template} onChange={e=>setTemplate(e.target.value)}><option value="">Template not selected</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title} · {t.document_type}</option>)}</select></label>
        <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={order} onChange={e=>setOrder(e.target.checked)}/>Require recipients to sign in the specified order</label>
        {recipients.map((r,index)=><div key={r.member_id} className="border-b border-[#34445D] pb-3 space-y-2"><p className="text-xs text-[#9AA6BC] break-all">{r.member_id}</p>
          <div className="grid grid-cols-2 gap-2"><label className="text-sm">Role<select className={input+' mt-1'} value={r.role} onChange={e=>setRecipients(previous=>previous.map((v,i)=>i===index?{...v,role:e.target.value}:v))}>{roles.map(role=><option key={role}>{role}</option>)}</select></label><label className="text-sm">Order<input className={input+' mt-1'} type="number" min={1} max={25} value={r.routing_order} onChange={e=>setRecipients(previous=>previous.map((v,i)=>i===index?{...v,routing_order:Number(e.target.value)}:v))}/></label></div>
        </div>)}
        <button className={button} disabled={busy||!selected||!recipients.length} onClick={createDraft}>Prepare DocuSign draft packet</button>
      </div>
      <div className={panel+' space-y-3'}><h3 className="font-semibold">Contract evidence tracking</h3>
        {!packets.length&&<p className="text-sm text-[#9AA6BC]">No formal signing packets have been prepared yet.</p>}
        {packets.map(p=><div key={p.id} className="border-b border-[#34445D] pb-3 space-y-2"><p className="text-sm font-semibold">Envelope: {p.status} · {p.provider}</p><p className="text-xs break-all text-[#9AA6BC]">{p.id}</p><p className="text-xs text-[#9AA6BC]">Created {new Date(p.created_at).toLocaleString()}</p>
          <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>inspectPacket(p.id)} disabled={busy}>Recipients</button>{p.status==='completed'&&<button className={button} disabled={busy} onClick={()=>evidence(p.id)}><ExternalLink size={14} className="inline mr-1"/>Signed PDF and certificate</button>}</div>
          {inspect===p.id&&<div className="p-3 bg-[#0F1520] space-y-2 rounded-lg">{people.map(r=><p key={r.member_id} className="text-xs break-all">{r.role||r.membership_role}: {r.member_id} · {r.status||'member'} · {r.routing_order??''}</p>)}</div>}
        </div>)}
      </div>
    </div>
  </section>;
}
