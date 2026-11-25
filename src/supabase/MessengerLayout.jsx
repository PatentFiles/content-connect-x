/** Shared live/demo messenger presentation. Services and permissions stay with
 * the caller; this component never sends network requests or stores account data.
 */
import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ImagePlus,Search,Send,X,MessageCircle} from 'lucide-react';
import './marketing-layout.css';
export function PersonAvatar({person=null,name='',size=48}){
 const [failed,setFailed]=useState(false),url=person?.avatar_url;
 useEffect(()=>setFailed(false),[url]);
 const label=person?.display_name||name||'Member';
 const safe=typeof url==='string'&&(url.startsWith('https://')||url.startsWith('/demo-assets/')||url.startsWith('blob:'));
 return <span className="ccx-avatar" style={{width:size,height:size}}>{safe&&!failed?<img src={url} alt={label+' profile photo'} loading="lazy" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{label.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>}</span>;
}
const stamp=value=>value?new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
const button='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50';
export default function MessengerLayout({threads=[],messages=[],people={},user,selected='',working=false,sending=false,onSelect,onBack,onSend,onEdit,onRemove,onReact,tools=null,headerActions=null,attachmentsEnabled=false,presenceLabel='',onTypingChange}){
 const [query,setQuery]=useState(''),[body,setBody]=useState(''),[attachments,setAttachments]=useState([]),[error,setError]=useState('');
 const input=useRef(null),bottom=useRef(null),previews=useRef([]);
 const release=()=>{previews.current.forEach(URL.revokeObjectURL);previews.current=[];};
 useEffect(()=>{setBody('');setAttachments([]);setError('');release();},[selected]);
 useEffect(()=>()=>release(),[]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages.length,selected]);
 const thread=threads.find(t=>t.id===selected),peer=people[thread?.peer_user_id]||thread?.peer;
 const name=peer?.display_name||thread?.title||'Conversation';
 const pick=event=>{
  const files=Array.from(event.target.files||[]);event.target.value='';setError('');
  if(files.length+attachments.length>4){setError('Attach up to four photos or videos at a time.');return;}
  if(files.some(f=>!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(f.type)||f.size>20*1024*1024)){setError('Use JPEG, PNG, WebP, MP4 or WebM files, up to 20 MB each.');return;}
  if([...files,...attachments.map(x=>x.file)].reduce((n,f)=>n+f.size,0)>40*1024*1024){setError('Keep attachments below 40 MB per message.');return;}
  setAttachments(old=>[...old,...files.map(file=>{const url=URL.createObjectURL(file);previews.current.push(url);return {file,url};})]);
 };
 const submit=async event=>{event?.preventDefault();if(sending||(!body.trim()&&!attachments.length))return;setError('');try{await onSend(body.trim(),attachments.map(x=>x.file));setBody('');setAttachments([]);release();}catch(e){setError(e.message||'The message could not be sent. Your draft is preserved.');}};
 return <div className="ccx-messenger" data-open={String(Boolean(selected))}>
  <aside className="ccx-messenger-list" aria-label="Conversations">
   <label className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--cc-border)] p-3"><Search size={17}/><input className="min-w-0 w-full bg-transparent text-sm outline-none" aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   {tools}
   <h2 className="mb-2 mt-4 text-sm font-bold">Conversations</h2>
   {threads.filter(t=>(people[t.peer_user_id]?.display_name||t.title||'').toLowerCase().includes(query.toLowerCase())).map(t=>{
    const p=people[t.peer_user_id]||t.peer,n=p?.display_name||t.title||'Private conversation';
    return <button key={t.id} type="button" className="ccx-thread" aria-current={selected===t.id?'true':'false'} onClick={()=>onSelect(t.id)}>
     <PersonAvatar person={p} name={n}/><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="truncate text-sm">{n}</strong><time className="shrink-0 text-[10px] text-[var(--cc-text-secondary)]">{stamp(t.last_message_at||t.updated_at)}</time></span><span className="mt-1 block truncate text-xs text-[var(--cc-text-secondary)]">{t.last_message_preview||(t.kind==='group'?'Private group conversation':'Open your conversation')}</span></span>{(t.unread_count||t.unread)>0&&<span className="rounded-full bg-[var(--cc-link)] px-2 py-1 text-[10px] font-bold text-white" aria-label={(t.unread_count||t.unread)+' unread messages'}>{t.unread_count||t.unread}</span>}
    </button>;
   })}
   {!threads.length&&!working&&<p className="p-3 text-sm text-[var(--cc-text-secondary)]">Start a conversation with one of your connections.</p>}
  </aside>
  <section className="ccx-messenger-chat" aria-label={selected?'Conversation with '+name:'Choose a conversation'}>
   {!selected?<div className="grid h-full place-content-center gap-3 text-center text-[var(--cc-text-secondary)]"><MessageCircle size={36} className="mx-auto"/><h2 className="text-xl font-semibold">Your conversations</h2><p className="text-sm">Choose a person to plan your next project.</p></div>:<>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-border)] pb-4"><div className="flex min-w-0 items-center gap-3"><button type="button" className={button+' ccx-messenger-back md:hidden'} onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={18}/></button><PersonAvatar person={peer} name={name}/><div className="min-w-0"><h2 className="truncate font-bold">{name}</h2><p className="text-xs capitalize text-[var(--cc-text-secondary)]">{peer?.role_type?.replaceAll('_',' ')||'Private conversation'}{peer?.city?' · '+peer.city:''}{presenceLabel?' · '+presenceLabel:''}</p></div></div>{headerActions}</header>
    <div className="ccx-messenger-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Message history">
     {messages.map((m,i)=>{const day=new Date(m.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});const prior=i?new Date(messages[i-1].created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
      return <React.Fragment key={m.id}>{day!==prior&&<p className="my-1 self-center text-xs text-[var(--cc-text-secondary)]">{day}</p>}<article className="ccx-message" data-own={String(m.sender_id===user.id)}>
       <p className="whitespace-pre-wrap break-words text-sm">{m.deleted_at?'Message removed':m.body}</p>
       {!m.deleted_at&&m.attachments?.map((a,j)=><div key={a.id||j} className="mt-2">{a.mime_type?.startsWith('video/')?<video className="ccx-messenger-attachment" src={a.url} controls preload="metadata" aria-label={a.name||'Attached video'}/>:<img className="ccx-messenger-attachment" src={a.url} alt={a.name||'Attached photo'} loading="lazy"/>}</div>)}
       <footer className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--cc-text-secondary)]"><time dateTime={m.created_at}>{stamp(m.created_at)}{m.edited_at?' · edited':''}</time>{!m.deleted_at&&<><button type="button" onClick={()=>onReact?.(m.id,'heart')} disabled={working}>Like</button>{m.sender_id===user.id&&<><button type="button" onClick={()=>onEdit?.(m)} disabled={working}>Edit</button><button type="button" onClick={()=>onRemove?.(m)} disabled={working}>Remove</button></>}</>}</footer>
      </article></React.Fragment>;
     })}<span ref={bottom}/>
    </div>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {!!attachments.length&&<div className="flex flex-wrap gap-3" aria-label="Attachments ready to send">{attachments.map((a,i)=><div key={a.url} className="relative w-24">{a.file.type.startsWith('video/')?<video src={a.url} className="h-20 w-24 rounded-xl object-cover" preload="metadata"/>:<img src={a.url} alt={a.file.name} className="h-20 w-24 rounded-xl object-cover"/>}<button type="button" className="absolute right-0 top-0 rounded-full bg-white p-1 text-slate-900 shadow" aria-label={'Remove '+a.file.name} onClick={()=>{URL.revokeObjectURL(a.url);previews.current=previews.current.filter(u=>u!==a.url);setAttachments(v=>v.filter((_,j)=>j!==i));}}><X size={14}/></button><p className="truncate text-[10px]">{a.file.name}</p></div>)}</div>}
    <form className="ccx-messenger-composer" onSubmit={submit}>
     <input ref={input} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple onChange={pick} tabIndex={-1}/>
     <button type="button" className={button} disabled={!attachmentsEnabled||sending} title={attachmentsEnabled?'Attach photos or videos':'Media attachments require the chat media service to be deployed.'} aria-label="Attach photos or videos" onClick={()=>input.current?.click()}><ImagePlus size={19}/></button>
     <textarea className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm" aria-label="Message" placeholder="Write a message…" rows={2} maxLength={10000} value={body} disabled={sending} onChange={e=>{setBody(e.target.value);onTypingChange?.(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}}/>
     <button type="submit" className="ccx-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50" disabled={sending||(!body.trim()&&!attachments.length)}><Send size={17}/><span className="hidden sm:inline">{sending?'Sending…':'Send'}</span></button>
    </form>
   </>}
  </section>
 </div>;
}
