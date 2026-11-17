/** Host Connect — host-only property management workspace.
 * Uses exactly the same Supabase users, listings and booking
 * transactions as Content Connect X; no shadow reservation inventory exists.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Home,ArrowUpRight,ArrowRight,LogOut} from 'lucide-react';
import HostingMarketplace from './HostingMarketplace';
import YotiVerification from './YotiVerification';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[#36425E] bg-[#0E172B] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#43CBED]';
const primary='oh-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold';
const secondary='oh-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm';

export default function OnlyHostApp(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [account,setAccount]=useState(null),[isVerified,setVerified]=useState(false);
 const [view,setView]=useState('account'),[showLogin,setShowLogin]=useState(false),[signUp,setSignUp]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [terms,setTerms]=useState(false),[docs,setDocs]=useState({id:null,selfie:null});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const user=session?.user;
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.has('age_verification')){
   setView('account');params.delete('age_verification');
   window.history.replaceState(null,'',window.location.pathname+(params.toString()?'?'+params.toString():'')+window.location.hash);
  }
 },[]);
 const refreshAccount=useCallback(async(current)=>{
  if(!current?.user){setVerified(false);setAccount(null);return;}
  const [age,registration]=await Promise.all([
   supabase.from('age_verification_requests').select('status,expires_at')
    .eq('user_id',current.user.id).order('created_at',{ascending:false}).limit(1),
   integrationAction('onlyhost_status')
  ]);
  if(age.error)throw age.error;
  const latest=age.data?.[0];
  const verified=Boolean(latest?.status==='approved'&&(!latest.expires_at||new Date(latest.expires_at)>new Date()));
  setVerified(verified);
  setAccount(registration);
  setView(registration?.registered&&verified?'workspace':'account');
 },[]);
 useEffect(()=>{
  let active=true;
  supabase.auth.getSession().then(async({data,error:sessionError})=>{
   if(sessionError)throw sessionError;
   if(!active)return;
   setSession(data.session);await refreshAccount(data.session);
  }).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
   if(active)setSession(next);
  });
  return()=>{active=false;subscription.unsubscribe();};
 },[refreshAccount]);
 useEffect(()=>{if(user)refreshAccount(session).catch(e=>setError(e.message));},[session?.access_token,refreshAccount]);
 const auth=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const {data,error:authError}=signUp?
    await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}}):
    await supabase.auth.signInWithPassword({email,password});
   if(authError)throw authError;
   if(signUp&&!data.session)setNotice('Confirm your email from the message sent to your inbox, then sign in.');
   else{setSession(data.session);await refreshAccount(data.session);setShowLogin(false);}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const register=async()=>{
  setBusy(true);setError('');setNotice('');
  try{const r=await integrationAction('onlyhost_register',{accept_terms:terms});
   setNotice(r.note||'Account activated');await refreshAccount(session);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const upload=async(kind,file)=>{
  if(!file)return;
  setBusy(true);setError('');
  try{
   if(file.size>10485760||!['image/png','image/webp','image/jpeg','application/pdf'].includes(file.type))
    throw Error('Upload PDF/JPEG/PNG/WebP under 10 MB');
   const ext=file.type==='application/pdf'?'pdf':file.type.split('/')[1];
   const path=user.id+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
   const {error}=await supabase.storage.from('age-verification').upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw error;
   setDocs(current=>({...current,[kind]:path}));setNotice('Private identity evidence uploaded.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const submitIdentity=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error}=await supabase.functions.invoke('submit-age-verification',{body:{
    id_document_path:docs.id,selfie_document_path:docs.selfie
   }});
   if(error||data?.error)throw Error(data?.error||error?.message||'Submission unavailable');
   setNotice('Documents submitted privately for independent age and identity review.');
   setDocs({id:null,selfie:null});
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const ready=Boolean(account?.registered&&isVerified);
 const openWorkspace=()=>{
  if(!user){setShowLogin(true);return;}
  if(!ready){setView('account');return;}
  setView('workspace');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 return <div className="oh-app min-h-screen text-[#F5F8FF]">
  <div className="oh-topline"/>
  <header className="oh-header sticky top-0 z-40">
   <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-6">
    <button className="flex items-center gap-3" onClick={()=>setView(user&&ready?'workspace':'account')} aria-label="Host Connect home">
     <span className="oh-mark"><Home size={22} strokeWidth={2.3}/></span><span className="text-xl font-extrabold tracking-tight">Host<span className="oh-gradient-text">Connect</span><span className="ml-1 text-xs text-[#A4B5CF]">STUDIOS</span></span>
    </button>
    <div className="flex items-center gap-2">
     <a href="/" className={secondary+' hidden sm:inline-flex'}>Content Connect X</a>
     <button className={primary} onClick={openWorkspace}>{ready?'Property dashboard':'List your space'}<ArrowUpRight size={16}/></button>
     {user&&<button className="oh-icon-button" onClick={()=>supabase.auth.signOut()} aria-label="Sign out"><LogOut size={18}/></button>}
    </div>
   </div>
  </header>
  <main id="main-content">
   {loading?<div className="mx-auto max-w-7xl px-6 py-24 text-center">Loading…</div>:view==='workspace'&&ready?
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
     <div className="oh-panel mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
      <div><h1 className="text-2xl font-bold">Host Connect property dashboard</h1><p className="mt-1 text-sm text-[#B5C5DC]">Manage your locations, rules, equipment, availability, staff, and booking requests in one place.</p></div>
      <a href="/" className={secondary}>Back to Content Connect X</a>
     </div>
     <HostingMarketplace paid={true} isAdmin={false} user={user} brand="host_connect" initialSection="host" hostOnly/>
    </div>
   :<div className="mx-auto max-w-2xl space-y-5 px-4 py-10 md:py-16">
     <a href="/" className="text-sm text-[#A6C9F0]">← Return to Content Connect X</a>
     <section className="oh-panel space-y-4 p-6 md:p-8">
      <h1 className="text-2xl font-bold">Your Host Connect account</h1>
      {!user?<><p className="text-[#BBCBE0]">Sign in to activate your host workspace and start listing your properties.</p><button className={primary} onClick={()=>setShowLogin(true)}>Sign in or create an account</button></>:
       <><p className="text-sm text-[#B5C8DF]">Signed in to Host Connect as {user.email}</p>
        <p className="text-sm">Account: <strong>{account?.registered?'Registered':'Not registered'}</strong></p>
        {!account?.registered&&<><label className="flex gap-3 text-sm"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>I agree to Host Connect's hosting terms and confirm I will list only spaces I have permission to offer.</label>
         <button className={primary} disabled={!terms||busy} onClick={register}>Activate free Host Connect account</button></>}
        <p className="text-sm">Independent age verification: <strong>{isVerified?'Approved':'Not yet approved'}</strong></p>
        {!isVerified&&<div className="space-y-4">
         <YotiVerification brand="onlyhost"/>
         <div className="rounded-xl border border-[#3C4D69] bg-[#101A2D] p-4 space-y-3">
          <h3 className="font-semibold">Alternative: manual identity review</h3>
          <p className="text-xs text-[#ADBDD3]">Upload your ID and selfie privately. An authorized reviewer must approve them before bookings or hosting can begin.</p>
          <label className="block text-xs">Government ID<input className="mt-2 block" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>upload('id',e.target.files?.[0])}/></label>
          <label className="block text-xs">Selfie<input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('selfie',e.target.files?.[0])}/></label>
          <button className={secondary} disabled={busy||!docs.id||!docs.selfie} onClick={submitIdentity}>Submit for independent review</button>
         </div>
        </div>}
        {ready&&<button className={primary} onClick={openWorkspace}>Open your property dashboard <ArrowRight size={16}/></button>}
       </>
      }
     </section>
    </div>}
  </main>
  <footer className="border-t border-[#32465D] py-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 md:px-6"><p className="font-bold">Host<span className="oh-gradient-text">Connect</span> <span className="text-xs font-normal text-[#A4B9D1]">· Studios & Locations</span></p><p className="text-xs text-[#A4B9D1]">Host management workspace connected to Content Connect X.</p></div></footer>
  {showLogin&&<div className="oh-modal-backdrop" role="presentation" onClick={()=>setShowLogin(false)}>
   <section role="dialog" aria-modal="true" aria-label="Host Connect account" className="oh-modal max-w-md" onClick={e=>e.stopPropagation()}>
    <button className="absolute right-5 top-5" aria-label="Close" onClick={()=>setShowLogin(false)}>Close ×</button>
    <h2 className="text-2xl font-bold">{signUp?'Create a Host Connect account':'Welcome to Host Connect'}</h2>
    <p className="mt-2 text-sm text-[#A5BBD4]">One secure sign-in across Host Connect and Content Connect X.</p>
    <form className="mt-6 space-y-3" onSubmit={auth}>
     <label className="block text-xs">Email<input className={input+' mt-2'} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
     <label className="block text-xs">Password<input className={input+' mt-2'} type="password" autoComplete={signUp?'new-password':'current-password'} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
     <button className={primary+' w-full'} disabled={busy}>{signUp?'Create free account':'Sign in'}</button>
    </form>
    <button className="mt-4 text-sm text-[#70DAEE]" onClick={()=>setSignUp(!signUp)}>{signUp?'Already registered? Sign in':'Create your account'}</button>
    {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {notice&&<p className="mt-3 text-sm text-emerald-300">{notice}</p>}
   </section></div>}
 </div>;
}
