/** Shared private upload grid and approved guest photo gallery. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {UploadCloud,Images,ImageIcon,X,ChevronLeft,ChevronRight,Trash2,Loader2} from 'lucide-react';
import HostDialog from './HostDialog';
import {hostingAction,uploadHostingPhoto} from './hostingApi';
import {mergePhotoSelection,photoKey} from './propertyPhotoPolicy.mjs';

/** @param {{files:File[],onChange:(files:File[])=>void,disabled?:boolean}} props */
export function HostPhotoPicker({files,onChange,disabled=false}){
 const input=useRef(/** @type {HTMLInputElement|null} */(null));
 const [previews,setPreviews]=useState([]);
 const [errors,setErrors]=useState([]);
 const [over,setOver]=useState(false);
 useEffect(()=>{
  const images=files.map(file=>({file,url:URL.createObjectURL(file)}));setPreviews(images);
  return()=>images.forEach(image=>URL.revokeObjectURL(image.url));
 },[files]);
 const accept=incoming=>{
  if(disabled)return;
  const result=mergePhotoSelection(files,Array.from(incoming));onChange(result.files);setErrors(result.errors);
 };
 return <div className="oh-batch-photos">
  <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp" disabled={disabled}
   onChange={event=>{accept(event.currentTarget.files||[]);event.currentTarget.value='';}}/>
  <button type="button" disabled={disabled} className={'oh-photo-dropzone '+(over?'is-dragging':'')}
   onClick={()=>input.current?.click()} onDragOver={event=>{event.preventDefault();if(!disabled)setOver(true);}}
   onDragLeave={()=>setOver(false)} onDrop={event=>{event.preventDefault();setOver(false);accept(event.dataTransfer.files);}}>
   <span className="oh-photo-upload-mark"><UploadCloud size={29}/></span><strong>Add your property photos</strong>
   <span>Drag photos here, or click to choose multiple files</span><small>JPG, PNG or WebP · up to 10 MB each · no fixed photo-count limit</small>
  </button>
  {errors.length>0&&<div role="alert" className="oh-inline-error">{errors.map((error,index)=><p key={index}>{error}</p>)}</div>}
  {previews.length>0&&<><p className="oh-upload-count">{files.length} photos selected. The first saved photo becomes the initial cover.</p>
   <div className="oh-photo-upload-grid">{previews.map(({file,url},index)=><figure key={photoKey(file)}>
    <img src={url} alt={'Selected property photo '+(index+1)} loading="lazy"/>
    <figcaption title={file.name}>{file.name}</figcaption>
    <button type="button" disabled={disabled} className="oh-image-remove" aria-label={'Remove '+file.name} onClick={()=>onChange(files.filter(f=>photoKey(f)!==photoKey(file)))}><X size={14}/></button>
   </figure>)}</div></>}
 </div>;
}

/** @param {{propertyId:string,onChanged?:()=>Promise<any>}} props */
export function HostPhotoManager({propertyId,onChanged}){
 const [photos,setPhotos]=useState([]),[count,setCount]=useState(0),[offset,setOffset]=useState(null);
 const [files,setFiles]=useState(/** @type {File[]} */([]));
 const [loading,setLoading]=useState(false),[uploading,setUploading]=useState(false);
 const [progress,setProgress]=useState(''),[error,setError]=useState('');
 const generation=useRef(0);
 const load=useCallback(async(start=0)=>{
  const request=++generation.current;setLoading(true);setError('');
  try{
   const result=await hostingAction('host_media_page',{id:propertyId,offset:start,limit:60});
   if(request!==generation.current)return;
   setPhotos(current=>start?[...current,...result.items]:result.items);setCount(result.total||0);setOffset(result.next_offset);
  }catch(e){if(request===generation.current)setError(e.message);}
  finally{if(request===generation.current)setLoading(false);}
 },[propertyId]);
 useEffect(()=>{setPhotos([]);setFiles([]);void load();return()=>{generation.current++;};},[load]);
 const upload=async()=>{
  if(!files.length||uploading)return;
  setUploading(true);setError('');const failed=[];let completed=0;
  for(let index=0;index<files.length;index++){
   const file=files[index];setProgress(`Uploading ${index+1} of ${files.length}: ${file.name}`);
   try{await uploadHostingPhoto(propertyId,file,file.name.replace(/\.[^.]+$/,''));completed++;}
   catch(e){failed.push({file,message:e.message});}
  }
  setFiles(failed.map(v=>v.file));await load();await onChanged?.();
  setProgress(`${completed} photo${completed===1?'':'s'} saved privately for review.`);
  if(failed.length)setError(failed.map(v=>`${v.file.name}: ${v.message}`).join(' '));
  setUploading(false);
 };
 const remove=async(photo)=>{
  if(!window.confirm('Remove this property photo?'))return;
  setError('');
  try{await hostingAction('host_photo_delete',{id:photo.id});await load();await onChanged?.();}
  catch(e){setError(e.message);}
 };
 return <section className="oh-photo-manager">
  <header><h3><Images size={19}/>Property photos <span>{count}</span></h3><p>Add multiple photos in one upload. Pending photos remain private until approved.</p></header>
  {error&&<p role="alert" className="oh-inline-error">{error}</p>}
  {photos.length>0&&<div className="oh-photo-upload-grid">{photos.map((photo,index)=><figure key={photo.id}>
   <img src={photo.url} alt={photo.caption||'Property photo'} loading="lazy"/>
   <figcaption><span>{index===0?'Cover · ':''}{photo.status}</span>{photo.caption}</figcaption>
   <button type="button" className="oh-image-remove" disabled={uploading} onClick={()=>remove(photo)} aria-label={'Delete '+(photo.caption||'property photo')}><Trash2 size={14}/></button>
  </figure>)}</div>}
  {offset!==null&&offset!==undefined&&<button type="button" className="oh-gallery-secondary" disabled={loading} onClick={()=>load(offset)}>Load more photos ({photos.length} of {count})</button>}
  {loading&&<p role="status" className="oh-upload-count">Loading photos…</p>}
  <HostPhotoPicker files={files} onChange={setFiles} disabled={uploading}/>
  {files.length>0&&<button type="button" className="oh-gallery-primary" onClick={upload} disabled={uploading}>
   {uploading?<Loader2 size={18} className="animate-spin"/>:<UploadCloud size={18}/>} {uploading?'Uploading photos…':`Upload ${files.length} photos`}</button>}
  {progress&&<p role="status" className="oh-upload-count">{progress}</p>}
 </section>;
}

/** @param {{propertyId:string,title:string,photos:any[],total?:number}} props */
export default function PropertyPhotoGallery({propertyId,title,photos=[],total=0}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(0);
 const [all,setAll]=useState([]),[next,setNext]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const requestId=useRef(0);
 const load=useCallback(async(start=0)=>{
  const request=++requestId.current;setLoading(true);setError('');
  try{
   const result=await hostingAction('property_media_page',{id:propertyId,offset:start,limit:60});
   if(request!==requestId.current)return;
   setAll(current=>start?[...current,...result.items]:result.items);setNext(result.next_offset);
  }catch(e){if(request===requestId.current)setError(e.message);}
  finally{if(request===requestId.current)setLoading(false);}
 },[propertyId]);
 useEffect(()=>{if(open)void load();return()=>{requestId.current++;};},[open,load]);
 const gallery=all.length?all:photos;
 const show=index=>{setSelected(index);setOpen(true);};
 const active=gallery[Math.min(selected,Math.max(0,gallery.length-1))];
 return <>
  <div className={'oh-photo-mosaic '+(photos.length<5?'oh-photo-mosaic-small':'')}>
   {photos.slice(0,5).map((photo,index)=><button type="button" key={photo.id||index} className={'oh-mosaic-photo oh-mosaic-photo-'+index} onClick={()=>show(index)} aria-label={'Open photo '+(index+1)+' of '+title}>
    <img src={photo.url} alt={photo.caption||title} loading={index?'lazy':'eager'}/>
   </button>)}
   {!photos.length&&<div className="oh-mosaic-empty"><ImageIcon size={48}/><p>No approved property photos yet</p></div>}
   {photos.length>0&&<button type="button" className="oh-show-all-photos" onClick={()=>show(0)}><Images size={17}/>Show all photos{total>0?` (${total})`:''}</button>}
  </div>
  {open&&<HostDialog title={title+' · Photos'} subtitle="Approved property photography" onClose={()=>setOpen(false)} className="oh-gallery-dialog">
   {error&&<p role="alert" className="oh-inline-error">{error}</p>}
   {active&&<div className="oh-gallery-stage"><img src={active.url} alt={active.caption||title}/>
    <button type="button" className="oh-photo-step oh-photo-step-prev" disabled={selected===0} onClick={()=>setSelected(v=>Math.max(0,v-1))} aria-label="Previous full-size photo"><ChevronLeft size={22}/></button>
    <button type="button" className="oh-photo-step oh-photo-step-next" disabled={selected>=gallery.length-1} onClick={()=>setSelected(v=>Math.min(gallery.length-1,v+1))} aria-label="Next full-size photo"><ChevronRight size={22}/></button>
    <p className="oh-gallery-caption">{selected+1} / {Math.max(total,gallery.length)}{active.caption?' · '+active.caption:''}</p>
   </div>}
   <div className="oh-all-photos-grid">{gallery.map((photo,index)=><button type="button" key={photo.id||index} onClick={()=>setSelected(index)} aria-label={'View photo '+(index+1)} aria-pressed={selected===index}>
    <img src={photo.url} alt={photo.caption||'Property photo'} loading="lazy"/>
   </button>)}</div>
   {next!==null&&next!==undefined&&<button type="button" className="oh-gallery-secondary" disabled={loading} onClick={()=>load(next)}>{loading?'Loading…':'Load more photos'}</button>}
  </HostDialog>}
 </>;
}
