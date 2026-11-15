import React, { useCallback, useEffect, useState } from 'react';
import { Heart, MessageCircle, ShieldCheck, Send, RefreshCw } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const control='w-full rounded-lg bg-[#0F1520] border border-[#34445D] text-white p-2';
const button='rounded-lg bg-[#4F8CFF] text-white font-semibold px-4 py-2 text-sm disabled:opacity-50';

function Comments({post,paid}){
  const [comments,setComments]=useState([]);
  const [expanded,setExpanded]=useState(false);
  const [body,setBody]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const fetchComments=async()=>{
    setBusy(true);setError('');
    try{const result=await platformAction('community_comments',{post_id:post.id});setComments(result.items||[]);setExpanded(true);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const send=async(event)=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const result=await platformAction('community_comment',{post_id:post.id,body});
      setBody('');setError('');
      await fetchComments();
      setError(result.note||'Your comment is waiting for moderation.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="mt-4 border-t border-[#263248] pt-3">
    <button className="flex gap-2 items-center text-sm text-blue-300" onClick={()=>expanded?setExpanded(false):fetchComments()} disabled={busy}><MessageCircle size={16}/>{expanded?'Hide':'Show'} comments</button>
    {error&&<p className="text-sm text-amber-300 mt-2" role="status">{error}</p>}
    {expanded&&<div className="space-y-3 mt-3">
      {comments.map(comment=><p key={comment.id} className="bg-[#0F1520] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">{comment.body}</p>)}
      {!comments.length&&<p className="text-sm text-[#9AA6BC]">No approved comments yet.</p>}
      {paid&&<form className="flex gap-2" onSubmit={send}>
        <input className={control} value={body} minLength={2} maxLength={2000} onChange={e=>setBody(e.target.value)} placeholder="Reply (subject to review)" required/>
        <button className={button} disabled={busy} aria-label="Submit comment"><Send size={16}/></button>
      </form>}
    </div>}
  </div>;
}

export default function CommunityHub({paid=false,userId}){
  const [posts,setPosts]=useState([]);
  const [body,setBody]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{const response=await platformAction('community_feed');setPosts(response.items||[]);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const createPost=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const result=await platformAction('community_create_post',{body});
      setBody('');setNotice(result.note||'Submitted for moderation');
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const follow=async(target)=>{
    setError('');
    try{
      const result=await platformAction('follow_toggle',{user_id:target});
      setPosts(previous=>previous.map(p=>p.author_id===target?{...p,followed:result.following}:p));
    }catch(e){setError(e.message);}
  };
  const like=async(id)=>{
    setError('');
    try{
      const result=await platformAction('community_toggle_reaction',{post_id:id});
      setPosts(previous=>previous.map(p=>p.id===id?{
        ...p,liked:result.liked,reactions:Math.max(0,p.reactions+(result.liked?1:-1))
      }:p));
    }catch(e){setError(e.message);}
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold">Creator community</h2><p className="text-[#9AA6BC] text-sm mt-1">An age-verified professional feed. New posts are reviewed before publication.</p></div><button className={button} onClick={load} disabled={busy} aria-label="Refresh community"><RefreshCw size={17}/></button></div>
    {error&&<p className="p-3 rounded-lg bg-red-950 text-red-200 text-sm" role="alert">{error}</p>}
    {notice&&<p className="p-3 rounded-lg bg-emerald-950 text-emerald-200 text-sm" role="status">{notice}</p>}
    {paid&&<form className={panel+' space-y-3'} onSubmit={createPost}>
      <h3 className="font-semibold">Post a professional update</h3>
      <textarea className={control} rows={4} minLength={5} maxLength={3000} value={body} onChange={e=>setBody(e.target.value)} required placeholder="Share a project update, a travel notice or a collaboration opportunity. Do not post private ID or medical records."/>
      <div className="flex justify-between items-center gap-3"><p className="text-xs text-[#9AA6BC]"><ShieldCheck size={14} className="inline mr-1"/>Moderated before publishing</p><button className={button} disabled={busy}>Submit post</button></div>
    </form>}
    <div className="space-y-4 max-w-3xl">{posts.map(post=><article className={panel} key={post.id}>
      <div className="flex justify-between gap-2 mb-3"><div><p className="font-semibold">{post.author?.display_name||'Verified creator'}</p><p className="text-xs text-[#9AA6BC]">{post.author?.role_type||'Creator'} · {post.author?.city||'Professional network'}</p>{post.author_id!==userId&&<button className="text-xs text-blue-400 mt-1" onClick={()=>follow(post.author_id)}>{post.followed?'Following · Unfollow':'+ Follow creator'}</button>}</div><p className="text-xs text-[#9AA6BC]">{new Date(post.published_at||post.created_at).toLocaleDateString()}</p></div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>
      <button className={'mt-4 inline-flex items-center gap-2 text-sm '+(post.liked?'text-pink-400':'text-[#9AA6BC]')} onClick={()=>like(post.id)}><Heart size={16} fill={post.liked?'currentColor':'none'}/>{post.reactions||0}</button>
      <Comments paid={paid} post={post}/>
    </article>)}
    {!posts.length&&<div className={panel}><p className="text-[#9AA6BC]">No approved community posts are published yet.</p></div>}
    </div>
    {!paid&&<p className="text-sm text-[#9AA6BC]">Verified free accounts can read moderated posts and react. Premium adds publishing and comments.</p>}
  </div>;
}
