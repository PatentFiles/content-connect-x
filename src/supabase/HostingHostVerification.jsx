/** Host identity and property-rights verification before venue publication. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,UploadCloud,RefreshCw,AlertTriangle} from 'lucide-react';
import {hostingBusiness,uploadHostingCompliance,formatDate} from './hostingBusinessApi';
const panel='ccx-surface p-5';
const input='w-full rounded-lg border border-[#42546A] bg-[#0A1320] p-2.5 text-sm text-white';
const button='rounded-lg ccx-action-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';

export default function HostingHostVerification({propertyId,requiredInsurance=false}){
 const [businessName,setBusinessName]=useState('');
 const [authorityType,setAuthorityType]=useState('owner');
 const [authorityFile,setAuthorityFile]=useState(null);
 const [insuranceFile,setInsuranceFile]=useState(null);
 const [request,setRequest]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const refresh=async()=>{
  setBusy(true);setError('');
  try{const result=await hostingBusiness('host_status');setRequest((result.items||[]).find(v=>v.property_id===propertyId)||null);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{refresh();},[propertyId]);
 const submit=async(event)=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!authorityFile)throw Error('Upload evidence that you can legally rent this property.');
   const path=await uploadHostingCompliance({propertyId,type:'authority',file:authorityFile});
   let insurance='';
   if(insuranceFile)insurance=await uploadHostingCompliance({propertyId,type:'insurance',file:insuranceFile});
   const result=await hostingBusiness('host_verification_submit',{
    property_id:propertyId,business_name:businessName,authority_type:authorityType,
    authority_document_path:path,insurance_document_path:insurance||null
   });
   setNotice(result.note||'Submitted for independent verification.');await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className={panel+' space-y-4'}>
  <header className="flex justify-between gap-3 items-center"><h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={18}/>Host authority verification</h3><button type="button" className="text-xs text-blue-300" onClick={refresh}><RefreshCw size={15}/></button></header>
  <p className="text-sm text-[#A7BAD0]">Submit proof that you own or are permitted to rent this venue, plus required insurance. Your documents remain private and require independent review.</p>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  {request&&<div className="rounded-lg border border-[#355A7B] bg-blue-900/10 p-3 text-sm">
    <p className="capitalize font-semibold">Verification: {request.status}</p>
    <p className="text-xs text-[#9DB1C9]">Requested {formatDate(request.created_at)}{request.expires_at?' · Expires '+formatDate(request.expires_at):''}</p>
    {request.reviewer_note&&<p className="text-xs mt-2 text-[#A5BBD7]">{request.reviewer_note}</p>}
  </div>}
  {(!request||['rejected','expired'].includes(request.status))&&<form className="space-y-3" onSubmit={submit}>
    <label className="text-sm block">Business or proprietor name<input className={input+' mt-1'} maxLength={200} value={businessName} onChange={e=>setBusinessName(e.target.value)}/></label>
    <label className="text-sm block">Legal authority<select className={input+' mt-1'} value={authorityType} onChange={e=>setAuthorityType(e.target.value)}>
      <option value="owner">Property owner</option><option value="authorized_manager">Authorized property manager</option>
      <option value="lease_authorized">Lease permits subleasing/production rentals</option><option value="business">Business owns or operates venue</option>
    </select></label>
    <label className="block text-sm">Property authority evidence (private)<input type="file" className="block mt-2 text-xs" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={e=>setAuthorityFile(e.target.files?.[0]||null)}/></label>
    <label className="block text-sm">Insurance evidence {requiredInsurance?'(required)':'(optional)'}<input type="file" className="block mt-2 text-xs" accept="application/pdf,image/jpeg,image/png,image/webp" required={requiredInsurance} onChange={e=>setInsuranceFile(e.target.files?.[0]||null)}/></label>
    <p className="text-xs text-amber-200 flex gap-2"><AlertTriangle size={16}/>A form submission does not create an approved verification badge.</p>
    <button disabled={busy||!authorityFile||requiredInsurance&&!insuranceFile} className={button}><UploadCloud size={16} className="inline mr-2"/>Submit for review</button>
  </form>}
 </section>;
}
