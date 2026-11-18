/** Matterport plays its hosted Showcase; raw archives are private source storage,
 * never misrepresented as a converted interactive tour. */
import React,{useCallback,useEffect,useState} from 'react';
import {Box,Expand,UploadCloud,Link,Trash2} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import HostDialog from './HostDialog';
import {normalizeMatterportUrl,matterportLinkFromText} from './propertyTourPolicy.mjs';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm text-[var(--cc-text-primary)]';
/** @param {{propertyId:string,title?:string,editable?:boolean,onChanged?:()=>Promise<any>}} props */
export default function PropertyVirtualTour({propertyId,title='Property',editable=false,onChanged}){
 const [url,setUrl]=useState(''),[saved,setSaved]=useState(''),[open,setOpen]=useState(false),[pending,setPending]=useState(false),[sources,setSources]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const {data,error}=await supabase.rpc('ccx_property_tour',{p_property:propertyId});if(error)throw error;
  setUrl(data?.url||'');setSaved(data?.url||'');setPending(data?.pending_review===true);
  if(editable){const {data:rows,error:sourceError}=await supabase.from('property_tour_sources').select('id,original_name,created_at').eq('property_id',propertyId).order('created_at',{ascending:false});if(sourceError)throw sourceError;setSources(rows||[]);}
 },[propertyId,editable]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 const save=async()=>{const normalized=normalizeMatterportUrl(url);if(!normalized){setError('Paste a valid Matterport Showcase share link, such as https://my.matterport.com/show/?m=MODELID.');return;}
  setBusy(true);setError('');setNotice('');try{const {error}=await supabase.rpc('ccx_property_tour',{p_property:propertyId,p_action:'save',p_url:normalized});if(error)throw error;await load();await onChanged?.();setNotice('Tour saved. It becomes available to guests after the listing is reviewed.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const remove=async()=>{setBusy(true);try{const {error}=await supabase.rpc('ccx_property_tour',{p_property:propertyId,p_action:'remove'});if(error)throw error;setSaved('');setUrl('');setPending(false);await onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const upload=async file=>{
  if(!file)return;setBusy(true);setError('');setNotice('');let path='';
  try{
   if(/\.(txt|url|webloc|json)$/i.test(file.name)){
    if(file.size>100000)throw Error('A tour link file must be smaller than 100KB.');
    const link=matterportLinkFromText(await file.text());if(!link)throw Error('No valid Matterport Showcase link was found in this file.');setUrl(link);setNotice('Tour link imported. Save it to attach the interactive viewer.');return;
   }
   if(!/\.zip$/i.test(file.name)||file.size>50*1024*1024)throw Error('Upload a tour link file or a Matterport ZIP archive under 50MB.');
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Sign in again before uploading.');
   path=user.id+'/'+propertyId+'/'+crypto.randomUUID()+'.zip';
   const {error:uploadError}=await supabase.storage.from('property-tour-sources').upload(path,file,{contentType:'application/zip',upsert:false});if(uploadError)throw uploadError;
   const {error:recordError}=await supabase.from('property_tour_sources').insert({property_id:propertyId,user_id:user.id,storage_path:path,original_name:file.name.slice(0,200)});if(recordError)throw recordError;
   await load();setNotice('Source archive stored privately. Raw scan files need processing in your Matterport account; add the resulting Showcase share link above to enable navigation.');
  }catch(e){if(path)await supabase.storage.from('property-tour-sources').remove([path]);setError(e.message);}finally{setBusy(false);}
 };
 if(!editable&&!saved&&!error)return null;
 return <section className="ccx-surface space-y-4 p-5" aria-label="Matterport virtual tour">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><Box size={22}/>3D virtual tour</h3><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Explore the space in an interactive, full-screen Matterport viewer.</p></div>
   {saved&&<button type="button" className="oh-gallery-primary" onClick={()=>setOpen(true)}><Expand size={17}/>{editable?'Preview tour':'Explore in 3D'}</button>}</div>
  {editable&&<><label className="block text-sm">Matterport Showcase share link<input className={input+' mt-2'} value={url} maxLength={2048} placeholder="https://my.matterport.com/show/?m=…" onChange={e=>setUrl(e.target.value)}/></label>
   <p className="text-xs leading-6 text-[var(--cc-text-secondary)]">Use an embeddable public or unlisted model. Check the tour for addresses, entry codes, people and other private details before sharing it. Uploading a raw MatterPak/scan ZIP does not automatically create a playable tour.</p>
   <div className="flex flex-wrap gap-2"><button type="button" className="oh-gallery-primary" disabled={busy||!url} onClick={save}><Link size={16}/>Save tour link</button>
    {saved&&<button type="button" className="oh-gallery-secondary" disabled={busy} onClick={remove}><Trash2 size={16}/>Remove tour</button>}
    <label className="oh-gallery-secondary cursor-pointer"><UploadCloud size={16}/>Upload Matterport file<input type="file" className="sr-only" accept=".txt,.url,.webloc,.json,.zip" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label></div>
   {pending&&<p className="text-xs text-amber-800">Tour pending listing review; visible to you and authorized reviewers only.</p>}
   {sources.length>0&&<div className="space-y-2 rounded-xl border border-[var(--cc-border)] p-4"><p className="text-sm font-semibold">Private source archives</p>{sources.map(file=><p key={file.id} className="text-xs text-[var(--cc-text-secondary)]">{file.original_name} · Source stored, not a processed tour</p>)}</div>}
  </>}
  {error&&<p role="alert" className="oh-inline-error">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
  {open&&saved&&<HostDialog title={title+' · 3D tour'} subtitle="Matterport interactive walkthrough" fullscreen onClose={()=>setOpen(false)} className="oh-tour-dialog">
   <iframe title={title+' Matterport tour'} src={saved} className="oh-matterport-frame" allow="fullscreen; xr-spatial-tracking" allowFullScreen sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" referrerPolicy="strict-origin-when-cross-origin"/>
  </HostDialog>}
 </section>;
}
