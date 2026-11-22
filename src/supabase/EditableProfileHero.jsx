/** Profile edit hero matches MemberPublicProfile geometry.
 * Cropping is applied to image pixels before upload (no public image-position
 * metadata is required), and the same saved asset renders on View Profile.
 */
import React,{useEffect,useState} from 'react';
import {Camera,Image as ImageIcon,Move,ShieldCheck,UserRound,X} from 'lucide-react';

const roles=name=>String(name||'professional').replaceAll('_',' ');
function CropDialog({kind,file,onClose,onSave}){
 const [src,setSrc]=useState('');
 const [dimensions,setDimensions]=useState(null);
 const [x,setX]=useState(50),[y,setY]=useState(50),[zoom,setZoom]=useState(1);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const cover=kind==='cover',width=cover?1200:600,height=cover?400:600;
 useEffect(()=>{
  if(!file)return;
  const url=URL.createObjectURL(file);setSrc(url);
  const img=new window.Image();
  img.onload=()=>setDimensions({width:img.naturalWidth,height:img.naturalHeight});
  img.onerror=()=>setError('The image could not be loaded.');
  img.src=url;
  return()=>URL.revokeObjectURL(url);
 },[file]);
 const submit=async()=>{
  if(!dimensions||!src)return;
  setSaving(true);setError('');
  try{
   const image=new window.Image();image.src=src;
   await new Promise((resolve,reject)=>{if(image.complete&&image.naturalWidth){resolve();return;}image.onload=resolve;image.onerror=()=>reject(Error('Image could not be decoded'));});
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image editing is unsupported in this browser.');
   const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*zoom;
   const sw=image.naturalWidth*scale,sh=image.naturalHeight*scale;
   ctx.drawImage(image,(width-sw)*x/100,(height-sh)*y/100,sw,sh);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
   if(!blob)throw Error('Unable to prepare the cropped photo.');
   const cropped=new File([blob],kind+'-'+Date.now()+'.jpg',{type:'image/jpeg'});
   await onSave(cropped,kind);
   onClose();
  }catch(e){setError(e.message||'Unable to save image.');}
  finally{setSaving(false);}
 };
 return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation">
  <section role="dialog" aria-modal="true" aria-label={'Adjust '+(cover?'banner':'profile photo')}
   className="w-full max-w-2xl space-y-4 rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 text-[var(--cc-text-primary)] shadow-2xl">
   <div className="flex justify-between gap-3"><div><h3 className="text-lg font-semibold">Adjust {cover?'banner':'profile photo'}</h3>
    <p className="text-xs text-[var(--cc-text-secondary)]">{cover?'Recommended image: 1200 × 400 pixels (3:1)':'Recommended image: 600 × 600 pixels (square)'} · Use the sliders to position and zoom</p></div>
    <button type="button" aria-label="Close crop editor" onClick={onClose} disabled={saving}><X size={21}/></button></div>
   <div className={'relative mx-auto overflow-hidden bg-[var(--cc-surface-hover)] '+(cover?'w-full aspect-[3/1]':'w-52 aspect-square rounded-full sm:w-64')}>
    {src&&dimensions&&(()=>{
     // Use exactly the same pixel geometry as the exported canvas.
     const scale=Math.max(width/dimensions.width,height/dimensions.height)*zoom;
     const sw=dimensions.width*scale,sh=dimensions.height*scale;
     return <img src={src} alt="Live crop preview" draggable={false}
      className="absolute max-w-none"
      style={{left:((width-sw)*x/width)+'%',top:((height-sh)*y/height)+'%',
       width:(sw/width*100)+'%',height:(sh/height*100)+'%',objectFit:'fill'}}/>;
    })()}
   </div>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="text-xs">Horizontal position<input className="mt-2 w-full" aria-label="Horizontal position" type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label>
    <label className="text-xs">Vertical position<input className="mt-2 w-full" aria-label="Vertical position" type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label>
    <label className="text-xs">Zoom<input className="mt-2 w-full" type="range" min="1" max="3" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
   </div>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   <div className="flex justify-end gap-2">
    <button className="ccx-secondary rounded-lg px-4 py-2 text-sm" type="button" disabled={saving} onClick={onClose}>Cancel</button>
    <button className="ccx-primary rounded-lg px-4 py-2 text-sm" type="button" disabled={saving||!dimensions} onClick={()=>void submit()}>{saving?'Saving…':'Apply crop & save'}</button>
   </div>
  </section>
 </div>;
}
export default function EditableProfileHero({cover='',avatar='',displayName='',role='',verified=false,onUpload,uploading=false,disabled=false,onEdit}){
 const [pending,setPending]=useState(null);
 const select=kind=>e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){
   window.alert('Choose a JPEG, PNG or WebP image under 10 MB.');return;
  }
  setPending({kind,file});
 };
 return <section className="ccx-surface overflow-hidden rounded-2xl border border-[var(--cc-border)]" data-profile-hero-editor="true">
  <div className="relative aspect-[3/1] w-full bg-[var(--cc-surface-hover)]">
   {cover?<img src={cover} alt="Profile banner preview" className="h-full w-full object-cover"/>:
    <div className="grid h-full w-full place-items-center text-center text-xs text-[var(--cc-text-secondary)]"><ImageIcon size={30} strokeWidth={1.4}/><span>No banner yet · Recommended 1200 × 400 px</span></div>}
   {!disabled&&<label className="absolute bottom-3 right-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-slate-900/85 px-3 py-2 text-xs font-semibold text-white">
    <Move size={15}/>{uploading?'Uploading…':'Change / reposition banner'}
    <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={select('cover')}/>
   </label>}
  </div>
  <div className="space-y-3 p-5 sm:p-7">
   <div className="-mt-14 flex flex-wrap items-end gap-4">
    <div className="relative h-24 w-24 shrink-0">
     <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-[var(--cc-surface)] bg-[var(--cc-surface-hover)]">
      {avatar?<img src={avatar} alt="Profile photo preview" className="h-full w-full object-cover"/>:<UserRound size={36} aria-hidden="true"/>}
     </div>
     {!disabled&&<label className="absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white bg-[#12698f] text-white" title="Change and crop profile photo">
      <Camera size={17}/><span className="sr-only">Change / reposition profile photo</span>
      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={select('avatar')}/>
     </label>}
    </div>
    <div className="min-w-0 flex-1 pb-2"><h2 className="break-words text-xl font-bold">{displayName||'Set up your profile'}</h2>
     <p className="mt-1 text-sm capitalize text-[var(--cc-text-secondary)]">{roles(role)}</p></div>
    {verified&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 px-3 py-1 text-xs"><ShieldCheck size={14}/>Verified adult</span>}
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--cc-text-secondary)]">
    <span>Photo 600 × 600 px · Banner 1200 × 400 px</span>
    {onEdit&&<button type="button" className="ccx-secondary rounded-lg px-4 py-2 text-sm" onClick={onEdit}>Edit profile details</button>}
   </div>
  </div>
  {pending&&<CropDialog kind={pending.kind} file={pending.file} onClose={()=>setPending(null)} onSave={onUpload}/>}
 </section>;
}
