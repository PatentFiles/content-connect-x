/** Premium-owned albums. Audience rules are enforced by media-gateway, not this UI. */
import React,{useEffect,useState} from 'react';
import {Folder,FolderPlus,Pencil,Trash2,Check,X,Users} from 'lucide-react';

const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm';
const button='ccx-secondary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40';
const choices=[['premium','Premium members'],['friends','Friends'],['groups','Selected groups'],['private','Only me']];
export default function GalleryAlbumManager({albums=[],request,onRefresh,selectedAlbum='',onSelectAlbum=(_id='')=>{},onError=(_message='')=>{}}){
 const [editing,setEditing]=useState(null);
 const [title,setTitle]=useState('');
 const [visibility,setVisibility]=useState('private');
 const [groupIds,setGroupIds]=useState([]);
 const [groups,setGroups]=useState([]);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let alive=true;
  request('available_groups').then(r=>{if(alive)setGroups(r.items||[]);}).catch(()=>{if(alive)setGroups([]);});
  return()=>{alive=false;};
 },[request]);
 const start=album=>{
  setEditing(album?.id||'new');
  setTitle(album?.title||'');
  setVisibility(album?.visibility||'private');
  setGroupIds(album?.allowed_group_ids||[]);
 };
 const save=async e=>{
  e.preventDefault();
  if(busy||!title.trim()||(visibility==='groups'&&!groupIds.length))return;
  setBusy(true);onError('');
  try{
   const args={title:title.trim(),visibility,group_ids:visibility==='groups'?groupIds:[]};
   await request(editing==='new'?'create_album':'update_album',editing==='new'?args:{...args,album_id:editing});
   setEditing(null);await onRefresh();
  }catch(e){onError(e.message||'Could not save album');}
  finally{setBusy(false);}
 };
 const remove=async album=>{
  if(!window.confirm('Delete "'+album.title+'"? Photos will be kept but changed to Only me.'))return;
  setBusy(true);onError('');
  try{
   await request('delete_album',{album_id:album.id});
   if(selectedAlbum===album.id)onSelectAlbum('');
   setEditing(null);await onRefresh();
  }catch(e){onError(e.message||'Could not delete album');}
  finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-3 rounded-2xl p-4" aria-label="Manage albums">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h3 className="flex items-center gap-2 text-base font-semibold"><Folder size={19}/>Albums</h3>
   <button type="button" className={button} onClick={()=>start(null)} disabled={busy}>
    <FolderPlus size={16}/>Create album</button>
  </div>
  <div className="flex flex-wrap gap-2">
   <button type="button" className={button} aria-pressed={!selectedAlbum} onClick={()=>onSelectAlbum('')}>All photos & videos</button>
   {albums.map(album=><div key={album.id} className="flex items-center overflow-hidden rounded-lg border border-[var(--cc-border)]">
    <button type="button" aria-pressed={selectedAlbum===album.id} className="min-h-10 px-3 py-2 text-sm"
     onClick={()=>onSelectAlbum(album.id)}>{album.title} ({album.count??0})</button>
    <button type="button" className="p-2" aria-label={'Edit '+album.title} onClick={()=>start(album)}><Pencil size={15}/></button>
    <button type="button" className="p-2 text-red-600" aria-label={'Delete '+album.title} disabled={busy} onClick={()=>void remove(album)}><Trash2 size={15}/></button>
   </div>)}
  </div>
  {editing&&<form className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4" onSubmit={e=>void save(e)}>
   <div className="flex flex-wrap gap-3">
    <label className="min-w-[180px] flex-1 text-sm">Album name
     <input className={input+' mt-2'} value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} required/></label>
    <label className="min-w-[170px] flex-1 text-sm">Who can view
     <select className={input+' mt-2'} value={visibility} onChange={e=>setVisibility(e.target.value)}>
      {choices.map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select></label>
   </div>
   {visibility==='groups'&&<fieldset className="space-y-2">
    <legend className="flex items-center gap-2 text-sm font-semibold"><Users size={16}/>Groups that can view</legend>
    {groups.length?groups.map(g=><label key={g.id} className="flex items-center gap-2 text-sm">
     <input type="checkbox" checked={groupIds.includes(g.id)} onChange={e=>setGroupIds(ids=>e.target.checked?
      ids.length>=12?ids:[...ids,g.id]:ids.filter(id=>id!==g.id))}/>{g.name}</label>)
      :<p className="text-xs text-[var(--cc-text-secondary)]">Join an active group before sharing an album with it.</p>}
   </fieldset>}
   <div className="flex flex-wrap gap-2">
    <button type="submit" className="ccx-primary inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm"
     disabled={busy||!title.trim()||(visibility==='groups'&&!groupIds.length)}><Check size={16}/>{busy?'Saving…':'Save album'}</button>
    <button type="button" className={button} onClick={()=>setEditing(null)} disabled={busy}><X size={16}/>Cancel</button>
   </div>
  </form>}
 </section>;
}
