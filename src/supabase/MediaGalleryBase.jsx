import React, { useEffect, useState } from 'react';
import { Image, ShieldCheck, Search, RefreshCw, Video, FolderPlus, Folder, Trash2, Check } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

const panel='ccx-surface p-5';
const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2 text-sm';
const button='rounded-lg ccx-action-primary text-[var(--cc-text-primary)] px-4 py-2 text-sm font-semibold disabled:opacity-50';
const ghostBtn='rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50';
const reportMediaUrl=id=>'/trust/privacy?locator='+encodeURIComponent('gallery-media:'+id);
async function mediaRequest(action,data={}){
  const {data:result,error}=await supabase.functions.invoke('media-gateway',{body:{action,...data}});
  if(error||result?.error){
    // Supabase FunctionHttpError's generic message hides the useful, safe API
    // error body. Read a cloned response without consuming the SDK's stream.
    let message=typeof result?.error==='string'?result.error:null;
    if(!message&&error?.context?.clone)try{
      const body=await error.context.clone().json();
      if(typeof body?.error==='string')message=body.error;
    }catch{/* Network and non-JSON errors use the generic fallback. */}
    if(!message||message==='Unable to process media action')
      message='The media service is temporarily unavailable. Please retry.';
    throw new Error(message);
  }
  return result;
}
export default function MediaGallery({userId,paid=false,admin=false}){
  const [assets,setAssets]=useState([]);
  const [owned,setOwned]=useState([]);
  const [albums,setAlbums]=useState([]);
  const [review,setReview]=useState([]);
  const [target,setTarget]=useState('');
  const [image,setImage]=useState(null);
  const [file,setFile]=useState(null);
  const [caption,setCaption]=useState('');
  const [visibility,setVisibility]=useState('verified');
  const [rights,setRights]=useState(false);
  const [humanReviewed,setHumanReviewed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showAlbumForm,setShowAlbumForm]=useState(false);
  const [albumTitle,setAlbumTitle]=useState('');
  const [selectedAlbum,setSelectedAlbum]=useState('');
  const [uploadAlbumId,setUploadAlbumId]=useState('');
  const [assignTarget,setAssignTarget]=useState({});
  const load=async()=>{
    setBusy(true);setError('');
    try{
      // Each gallery section is independent. Failure to load albums or the
      // moderation queue must not erase approved media and prevent navigation.
      const results=await Promise.allSettled([
        mediaRequest('gallery',{owner_id:target||userId,album_id:selectedAlbum||undefined}),
        paid?mediaRequest('my_media'):Promise.resolve({items:[]}),
        paid?mediaRequest('list_albums'):Promise.resolve({items:[]}),
        admin?mediaRequest('admin_queue'):Promise.resolve({items:[]})
      ]);
      if(results[0].status==='fulfilled')setAssets(results[0].value.items||[]);
      if(results[1].status==='fulfilled')setOwned(results[1].value.items||[]);
      if(results[2].status==='fulfilled')setAlbums(results[2].value.items||[]);
      if(results[3].status==='fulfilled')setReview(results[3].value.items||[]);
      const issues=results.filter(item=>item.status==='rejected').map(item=>item.reason?.message||'Media section unavailable');
      if(issues.length)setError([...new Set(issues)].join(' '));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  useEffect(()=>{load();},[selectedAlbum]);
  const upload=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    let path='';
    try{
      if(!file||!rights)throw new Error('Select a file and confirm the required rights.');
      if(file.size>20*1024*1024)throw new Error('Maximum file size is 20 MB.');
      if(!['image/jpeg','image/png','image/webp','video/mp4'].includes(file.type))throw new Error('Unsupported file type.');
      const extension=file.type==='video/mp4'?'mp4':file.type.split('/')[1];
      path=userId+'/media/'+crypto.randomUUID()+'.'+extension;
      const {error:storageError}=await supabase.storage.from('member-private').upload(path,file,{
        upsert:false,contentType:file.type
      });
      if(storageError)throw storageError;
      const r=await mediaRequest('register_upload',{
        storage_path:path,mime_type:file.type,caption,visibility,attest_rights:true,
        album_id:uploadAlbumId||undefined
      });
      setFile(null);setCaption('');setRights(false);setUploadAlbumId('');
      setNotice(r.note||'Media submitted for human review.');
      await load();
    }catch(e){
      setError(e.message);
    }finally{setBusy(false);}
  };
  const open=async(id)=>{
    setBusy(true);setError('');setImage(null);
    try{
      const result=await mediaRequest('view',{id});
      setImage({url:result.url,mime_type:result.mime_type,id});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const scan=async(id)=>{
    setBusy(true);setError('');setNotice('');
    try{
      const result=await mediaRequest('admin_scan',{id});
      setNotice(result.note+' '+(result.signals||[]).map(v=>v.category).join(', '));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const decide=async(id,status)=>{
    if(!humanReviewed)return setError('Confirm manual rights and content review first.');
    setBusy(true);setError('');setNotice('');
    try{
      await mediaRequest('admin_review',{id,status,manual_review_confirmed:true});
      setNotice('Review recorded.');
      setHumanReviewed(false);await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const createAlbum=async(e)=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      await mediaRequest('create_album',{title:albumTitle});
      setAlbumTitle('');setShowAlbumForm(false);
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const deleteAlbum=async(id)=>{
    setBusy(true);setError('');
    try{
      await mediaRequest('delete_album',{album_id:id});
      if(selectedAlbum===id)setSelectedAlbum('');
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const assignAlbum=async(mediaId,albumId)=>{
    setBusy(true);setError('');
    try{
      await mediaRequest('assign_album',{media_id:mediaId,album_id:albumId||null});
      setAssignTarget(p=>({...p,[mediaId]:''}));
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const albumName=id=>albums.find(a=>a.id===id)?.title||'Unassigned';
  return <section className="space-y-5">
    <div className="flex justify-between gap-2 items-center"><div><h2 className="text-2xl font-semibold">Creator media</h2></div><div className="flex gap-2"><button onClick={load} disabled={busy} className={button} aria-label="Refresh media"><RefreshCw size={16}/></button></div></div>
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {notice&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
    {paid&&<section className={panel+' space-y-4'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex gap-2 items-center"><Folder size={18}/> Albums</h3>
        <button className={button} disabled={busy} onClick={()=>setShowAlbumForm(v=>!v)}><FolderPlus size={16} className="inline mr-1"/>New album</button>
      </div>
      {showAlbumForm&&<form onSubmit={createAlbum} className="ccx-action-row flex gap-2 items-end">
        <label className="flex-1 text-sm">Album name<input className={input+' mt-1'} maxLength={120} value={albumTitle} onChange={e=>setAlbumTitle(e.target.value)} placeholder="e.g. Studio shoots 2026"/></label>
        <button className={button} disabled={busy||!albumTitle.trim()}>Create</button>
      </form>}
      <div className="flex flex-wrap gap-2">
        <button className={ghostBtn} style={{borderColor:selectedAlbum===''?'var(--cc-blue)':'var(--cc-border)',color:selectedAlbum===''?'var(--cc-blue)':'var(--cc-text-secondary)'}} onClick={()=>setSelectedAlbum('')}>All media ({assets.length})</button>
        {albums.map(a=><div key={a.id} className="flex items-center gap-1 rounded-lg border" style={{borderColor:selectedAlbum===a.id?'var(--cc-blue)':'var(--cc-border)'}}>
          <button className="px-3 py-2 text-sm font-medium" style={{color:selectedAlbum===a.id?'var(--cc-blue)':'var(--cc-text-secondary)'}} onClick={()=>setSelectedAlbum(a.id)}>{a.title} ({a.count})</button>
          <button className="px-1.5 py-2 text-red-800 hover:text-red-800" disabled={busy} onClick={()=>deleteAlbum(a.id)} aria-label={`Delete ${a.title}`}><Trash2 size={14}/></button>
        </div>)}
        
      </div>
    </section>}
    <form onSubmit={e=>{e.preventDefault();load();}} className={panel+' flex flex-wrap gap-3 items-end'}>
      <label className="flex-1 text-sm min-w-[200px]">Creator's public member ID<input className={input+' mt-1'} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Blank = my gallery"/></label>
      <button className={button}><Search size={16} className="inline mr-1"/>Find</button>
    </form>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map(asset=><article className={panel} key={asset.id}><div className="flex items-center gap-2"><Image size={17} className="text-[var(--cc-text-secondary)]"/><p className="font-semibold">Approved media</p></div><p className="text-xs mt-1 text-[var(--cc-text-secondary)]">{new Date(asset.created_at).toLocaleDateString()}</p>{asset.album_id&&<p className="text-xs text-[var(--cc-text-secondary)]">Album: {albumName(asset.album_id)}</p>}<p className="my-3 text-sm break-words">{asset.caption||'Creator gallery'}</p><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>open(asset.id)}>View private media</button><a className={ghostBtn} href={reportMediaUrl(asset.id)}>Report media</a></div></article>)}
    </div>
    
    {image&&<div className={panel+' space-y-3'}><div className="flex gap-2 items-center text-sm text-[var(--cc-text-secondary)]">{image.mime_type.startsWith('video')?<Video size={17}/>:<Image size={17}/>}Temporary media preview (link expires in 60 seconds)</div>
      {image.mime_type.startsWith('video')?<video controls className="rounded-lg max-h-96 w-full" src={image.url}/>:<img className="rounded-lg max-h-96 w-full object-contain" src={image.url} alt="Approved creator media"/>}
      <div className="flex flex-wrap gap-3"><button className="text-[var(--cc-text-secondary)] text-sm" onClick={()=>setImage(null)}>Close preview</button><a className="text-sm underline" href={reportMediaUrl(image.id)}>Report this image or video</a></div>
    </div>}
    {paid&&<form onSubmit={upload} className={panel+' space-y-3'}>
      <h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={17}/> Upload private media for review</h3>
      <label className="block text-sm">Image or short video (20 MB maximum)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e=>setFile(e.target.files?.[0]||null)} className="block mt-2 text-sm"/></label>
      <label className="block text-sm">Caption<input className={input+' mt-1'} maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
      <label className="block text-sm">Visibility after approval<select className={input+' mt-1'} value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="verified">Verified adults</option><option value="connections">Mutual connections</option><option value="private">Me only</option></select></label>
      <label className="block text-sm">Add to album (optional)<select className={input+' mt-1'} value={uploadAlbumId} onChange={e=>setUploadAlbumId(e.target.value)}><option value="">No album</option>{albums.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <label className="flex min-w-0 items-start gap-2 text-sm"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)} className="mt-1 shrink-0"/><span className="min-w-0 break-words">I have the authority to submit this media and confirm that everyone depicted is an adult and that required permissions and releases exist. This attestation will be reviewed; it is not proof by itself.</span></label>
      <button className={button} disabled={busy||!file||!rights}>Submit for review</button>
      <div className="space-y-3 border-t border-[var(--cc-border)] pt-3">
        <h4 className="font-semibold text-sm">My submissions ({owned.length})</h4>
        {owned.map(v=><div key={v.id} className="rounded-lg border border-[var(--cc-border)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-words flex-1 min-w-0">{v.caption||v.mime_type} · <span className="capitalize">{v.status}</span></p>
            <span className="text-xs text-[var(--cc-text-secondary)] shrink-0">{new Date(v.created_at).toLocaleDateString()}</span>
          </div>
          {v.album_id&&<p className="text-xs text-[var(--cc-text-secondary)]">Album: {albumName(v.album_id)}</p>}
          {v.status==='approved'&&<div className="ccx-action-row flex gap-2 items-center">
            <select className={input+' max-w-[180px]'} value={assignTarget[v.id]||v.album_id||''} onChange={e=>setAssignTarget(p=>({...p,[v.id]:e.target.value}))}>
              <option value="">Unassigned</option>
              {albums.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <button className={ghostBtn} disabled={busy} onClick={()=>assignAlbum(v.id,assignTarget[v.id]||null)}><Check size={14} className="inline mr-1"/>Assign</button>
          </div>}
        </div>)}
        
      </div>
    </form>}
    {admin&&<div className={panel+' space-y-3'}>
      <h3 className="font-semibold">Media moderation queue ({review.length})</h3>
      <p className="text-xs text-[var(--cc-text-secondary)]">OpenModerate scanning requires a configured self-hosted service and does not establish age or consent. Final publication stays disabled until adult-content release and recordkeeping processes are approved. Never auto-approve media based solely on a model score.</p>
      <label className="flex min-w-0 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={humanReviewed} onChange={e=>setHumanReviewed(e.target.checked)}/><span className="min-w-0 break-words">I personally reviewed the content and rights evidence before deciding.</span></label>
      {review.map(item=><div className="border-t border-[var(--cc-border)] py-3 space-y-2" key={item.id}><p className="text-sm break-all">ID: {item.id}</p><p className="text-sm text-[var(--cc-text-secondary)]">{item.caption||item.mime_type} · Rights attested: {String(item.uploader_rights_attested)}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>open(item.id)}>Inspect</button><button className={button} disabled={busy} onClick={()=>scan(item.id)}>OpenModerate scan</button><button className={button} disabled={busy||!humanReviewed} onClick={()=>decide(item.id,'approved')}>Approve</button><button className="rounded-lg bg-red-700 text-white px-4 py-2 text-sm disabled:opacity-50" disabled={busy||!humanReviewed} onClick={()=>decide(item.id,'rejected')}>Reject</button></div>
      </div>)}
    </div>}
  </section>;
}
