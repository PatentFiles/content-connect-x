import React, { useEffect, useState } from 'react';
import { Image, ShieldCheck, Search, RefreshCw, Video } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const input='w-full rounded-lg border border-[#34445D] bg-[#0F1520] p-2 text-sm';
const button='rounded-lg bg-[#4F8CFF] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
async function mediaRequest(action,data={}){
  const {data:result,error}=await supabase.functions.invoke('media-gateway',{body:{action,...data}});
  if(error||result?.error)throw new Error(result?.error||error?.message||'Media service unavailable');
  return result;
}
export default function MediaGallery({userId,paid=false,admin=false}){
  const [assets,setAssets]=useState([]);
  const [owned,setOwned]=useState([]);
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
  const load=async()=>{
    setBusy(true);setError('');
    try{
      const results=await Promise.all([
        mediaRequest('gallery',{owner_id:target||userId}),
        paid?mediaRequest('my_media'):Promise.resolve({items:[]}),
        admin?mediaRequest('admin_queue'):Promise.resolve({items:[]})
      ]);
      setAssets(results[0].items||[]);setOwned(results[1].items||[]);setReview(results[2].items||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  useEffect(()=>{load();},[]);
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
        storage_path:path,mime_type:file.type,caption,visibility,attest_rights:true
      });
      setFile(null);setCaption('');setRights(false);
      setNotice(r.note||'Media submitted for human review.');
      await load();
    }catch(e){
      setError(e.message);
      // A failed registration can leave a private orphan. It never becomes public.
      // Cleanup is handled separately by an administrator/retention job.
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
  return <section className="space-y-5">
    <div className="flex justify-between gap-2 items-center"><div><h2 className="text-2xl font-semibold">Creator media</h2><p className="text-sm text-[#9AA6BC] mt-1">Age-gated private storage, rights attestation and human moderation before publishing.</p></div><button onClick={load} disabled={busy} className={button} aria-label="Refresh media"><RefreshCw size={16}/></button></div>
    {error&&<p className="rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
    {notice&&<p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
    <form onSubmit={e=>{e.preventDefault();load();}} className={panel+' flex flex-wrap gap-3 items-end'}>
      <label className="flex-1 text-sm min-w-[200px]">Creator's public member ID<input className={input+' mt-1'} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Blank = my gallery"/></label>
      <button className={button}><Search size={16} className="inline mr-1"/>Find</button>
    </form>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map(asset=><article className={panel} key={asset.id}><div className="flex items-center gap-2"><Image size={17} className="text-blue-400"/><p className="font-semibold">Approved media</p></div><p className="text-xs mt-1 text-[#9AA6BC]">{new Date(asset.created_at).toLocaleDateString()}</p><p className="my-3 text-sm break-words">{asset.caption||'Creator gallery'}</p><button className={button} disabled={busy} onClick={()=>open(asset.id)}>View private media</button></article>)}
    </div>
    {!assets.length&&<div className={panel}><p className="text-[#9AA6BC] text-sm">No approved media entries are available for this member.</p></div>}
    {image&&<div className={panel+' space-y-3'}><div className="flex gap-2 items-center text-sm text-[#9AA6BC]">{image.mime_type.startsWith('video')?<Video size={17}/>:<Image size={17}/>}Temporary media preview (link expires in 60 seconds)</div>
      {image.mime_type.startsWith('video')?<video controls className="rounded-lg max-h-96 w-full" src={image.url}/>:<img className="rounded-lg max-h-96 w-full object-contain" src={image.url} alt="Approved creator media"/>}
      <button className="text-blue-400 text-sm" onClick={()=>setImage(null)}>Close preview</button>
    </div>}
    {paid&&<form onSubmit={upload} className={panel+' space-y-3'}>
      <h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={17}/> Upload private media for review</h3>
      <label className="block text-sm">Image or short video (20 MB maximum)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={e=>setFile(e.target.files?.[0]||null)} className="block mt-2 text-sm"/></label>
      <label className="block text-sm">Caption<input className={input+' mt-1'} maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
      <label className="block text-sm">Visibility after approval<select className={input+' mt-1'} value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="verified">Verified adults</option><option value="connections">Mutual connections</option><option value="private">Me only</option></select></label>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)} className="mt-1"/><span>I have the authority to submit this media and confirm that everyone depicted is an adult and that required permissions and releases exist. This attestation will be reviewed; it is not proof by itself.</span></label>
      <button className={button} disabled={busy||!file||!rights}>Submit for review</button>
      <div className="space-y-2 border-t border-[#263248] pt-3">
        <h4 className="font-semibold text-sm">My submissions</h4>
        {owned.map(v=><p className="text-xs text-[#9AA6BC]" key={v.id}>{v.caption||v.mime_type} · {v.status}</p>)}
        {!owned.length&&<p className="text-[#9AA6BC] text-xs">No submissions.</p>}
      </div>
    </form>}
    {admin&&<div className={panel+' space-y-3'}>
      <h3 className="font-semibold">Media moderation queue ({review.length})</h3>
      <p className="text-xs text-[#9AA6BC]">OpenModerate scanning requires a configured self-hosted service and does not establish age or consent. Never auto-approve media based solely on a model score.</p>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" className="mt-1" checked={humanReviewed} onChange={e=>setHumanReviewed(e.target.checked)}/>I personally reviewed the content and rights evidence before deciding.</label>
      {review.map(item=><div className="border-t border-[#263248] py-3 space-y-2" key={item.id}><p className="text-sm break-all">ID: {item.id}</p><p className="text-sm text-[#9AA6BC]">{item.caption||item.mime_type} · Rights attested: {String(item.uploader_rights_attested)}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>open(item.id)}>Inspect</button><button className={button} disabled={busy} onClick={()=>scan(item.id)}>OpenModerate scan</button><button className={button} disabled={busy||!humanReviewed} onClick={()=>decide(item.id,'approved')}>Approve</button><button className="rounded-lg bg-red-700 text-white px-4 py-2 text-sm disabled:opacity-50" disabled={busy||!humanReviewed} onClick={()=>decide(item.id,'rejected')}>Reject</button></div>
      </div>)}
    </div>}
  </section>;
}
