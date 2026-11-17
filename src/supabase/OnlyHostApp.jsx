/** Host Connect — host-only property management workspace.
 * Uses exactly the same Supabase users, listings and booking
 * transactions as Content Connect X; no shadow reservation inventory exists.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Home,ArrowUpRight,ArrowRight,LogOut,CalendarDays,ShieldCheck,Clapperboard,UsersRound,FileSignature,Sparkles,CheckCircle2,Clock3,Wallet,MessageCircleMore,Eye,Brush,SlidersHorizontal,KeyRound} from 'lucide-react';
import HostingMarketplace from './HostingMarketplace';
import {HOST_TERMS,HOST_TERMS_VERSION} from './hostTerms';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[#36425E] bg-[#0E172B] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#43CBED]';
const primary='oh-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold';
const secondary='oh-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm';

export default function OnlyHostApp(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [account,setAccount]=useState(null);
 const [view,setView]=useState('account'),[showLogin,setShowLogin]=useState(false),[signUp,setSignUp]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [terms,setTerms]=useState(false),[capacityOK,setCapacityOK]=useState(false),[authorityOK,setAuthorityOK]=useState(false),[adultUseOK,setAdultUseOK]=useState(false);
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
  if(!current?.user){setAccount(null);return;}
  const registration=await integrationAction('onlyhost_status');
  setAccount(registration);
  setView(registration?.registered&&registration?.host_terms_current?'workspace':'account');
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
  try{const r=await integrationAction('onlyhost_register',{accept_terms:terms,terms_version:HOST_TERMS_VERSION,legal_capacity_confirmed:capacityOK,property_authority_confirmed:authorityOK,adult_production_understood:adultUseOK});
   setNotice(r.note||'Account activated');await refreshAccount(session);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const ready=Boolean(account?.registered&&account?.host_terms_current);
 const openWorkspace=()=>{
  if(!user){setShowLogin(true);return;}
  if(!ready){setView('account');return;}
  setView('workspace');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 return <div className="oh-app host-connect-theme min-h-screen text-[#F5F8FF]">
  <div className="oh-topline"/>
  <header className="oh-header sticky top-0 z-40">
   <div className="oh-header-inner mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 md:px-8">
    <button className="oh-brand flex shrink-0 items-center gap-3" onClick={()=>setView(user&&ready?'workspace':'account')} aria-label="Host Connect home">
     <span className="oh-mark"><Home size={22} strokeWidth={2.3}/></span>
     <span className="oh-wordmark text-xl font-extrabold tracking-tight">Host<span className="oh-gradient-text">Connect</span></span>
    </button>
    <nav className="oh-header-actions ml-auto flex items-center justify-end gap-2" aria-label="Host Connect navigation">
     <a href="/" className="oh-ccx-link inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold"><span className="oh-ccx-gradient">Content Connect X</span></a>
     <button className={primary+' oh-list-space'} onClick={openWorkspace}>{ready?'Property dashboard':'List Your Space'}<ArrowUpRight size={16}/></button>
     {user&&<button className="oh-icon-button" onClick={()=>supabase.auth.signOut()} aria-label="Sign out"><LogOut size={18}/></button>}
    </nav>
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
   :<div className="oh-marketing">
     <section className="oh-landing-banner" aria-label="Host Connect studios and locations">
      <img src="/Host_Connect_Banner.png" alt="Host Connect — studios, locations and sets for professional productions" className="oh-landing-banner-image"/>
     </section>
     <section className="oh-landing-section oh-landing-intro" aria-labelledby="oh-features-title">
      <div className="oh-landing-container">
       <div className="oh-landing-heading">
        <p className="oh-landing-kicker"><Sparkles size={15}/> YOUR PROPERTY · YOUR RULES · YOUR INCOME</p>
        <h1 id="oh-features-title">Your space has potential. <span className="oh-gradient-text">You set the terms.</span></h1>
        <p>List houses, lofts, studios and private locations for professional adult-content production. Welcome nude photography or explicit adult filming on your own terms—with informed permission, custom rules, and a host dashboard built for you.</p>
       </div>
       <div className="oh-landing-cards">
        {[
         {Icon:Home,title:'List Your Property',tag:'YOUR PORTFOLIO',text:'Create multiple listings for houses, apartments you are authorized to offer, lofts, studios or private filming sets. Add photos, amenities and crew capacity.'},
         {Icon:Wallet,title:'Set Your Own Rates',tag:'YOUR PRICING',text:'Choose your hourly price and minimum booking length, including 6, 12 or 24 hours. Configure weekend and seasonal pricing, overtime and discounts where available.'},
         {Icon:Clock3,title:'Control Booking Durations',tag:'YOUR SCHEDULE',text:'Set minimum hours, notice periods, blocked dates and cleanup buffers. Overnight stays and hotel-style check-in/out windows require supported listing settings before activation.'},
         {Icon:ShieldCheck,title:'Choose Adult Uses',tag:'YOUR BOUNDARIES',text:'Explicitly opt in to nude photography or adult video production, or restrict what is allowed. Guests know your rules before requesting a shoot.'},
         {Icon:Brush,title:'Set Cleaning Fees',tag:'YOUR TURNOVER',text:'Choose a cleaning fee suitable for your house size and setup. Arrange your own cleaners; optional local service partnerships may be introduced later.'},
         {Icon:SlidersHorizontal,title:'House Rules & Restrictions',tag:'YOUR CONTROL',text:'Define permitted rooms, sound levels, filming hours, crew limits, insurance requirements, deposits and cancellation preferences.'},
         {Icon:CalendarDays,title:'Manage Your Calendar',tag:'YOUR AVAILABILITY',text:'Block dates, review reservations and use calendar import/export to coordinate your availability with other bookings.'},
         {Icon:Eye,title:'Views & Activity Dashboard',tag:'YOUR INSIGHTS',text:'See property impressions, listing statuses, booking requests and upcoming shoots from one host dashboard.'},
         {Icon:MessageCircleMore,title:'Messages & Requests',tag:'YOUR GUESTS',text:'Track booking conversations and respond to production questions and requests through your private host workspace.'},
         {Icon:FileSignature,title:'Booking Agreements',tag:'YOUR PROTECTION',text:'Document permitted activities, access rules, property conditions and commercial terms. Approval and external provider activation may be required.'},
         {Icon:UsersRound,title:'Staff & Equipment',tag:'YOUR OPERATIONS',text:'Manage optional equipment, staff, cleaning tasks, turnover checklists, inventory and condition photos.'},
         {Icon:KeyRound,title:'Privacy & Property Authority',tag:'YOUR TRUST',text:'Your exact address stays private until authorized. Submit owner or written landlord permission before a listing can be approved for adult-production rentals.'}
        ].map(({Icon,title,tag,text})=><article className="oh-landing-card" key={title}>
         <span className="oh-landing-card-tag">{tag}</span>
         <span className="oh-landing-card-icon"><Icon size={28} strokeWidth={1.65}/></span>
         <h2>{title}</h2><p>{text}</p>
         <span className="oh-landing-card-accent" aria-hidden="true"/>
        </article>)}
       </div>
      </div>
     </section>
     <section className="oh-landing-section oh-landing-process" aria-labelledby="oh-process-title">
      <div className="oh-landing-container">
       <div className="oh-landing-heading">
        <p className="oh-landing-kicker"><Clapperboard size={15}/> FROM LISTING TO PRODUCTION</p>
        <h2 id="oh-process-title">You own the space. <span className="oh-gradient-text">You make the rules.</span></h2>
       </div>
       <div className="oh-landing-steps">
        {[{n:'01',title:'Join as a host',text:'Register and accept the property host agreement. Hosts are not required to complete performer verification.'},{n:'02',title:'Prove your authority',text:'Provide ownership evidence or written permission from the property owner for adult productions.'},{n:'03',title:'Set your rules & pricing',text:'Choose permitted uses, cleaning fees, minimum hours, pricing and availability.'},{n:'04',title:'Review booking requests',text:'Manage guest messages, booking activity and property operations in one dashboard.'}].map(step=><article className="oh-landing-step" key={step.n}>
         <span>{step.n}</span><h3>{step.title}</h3><p>{step.text}</p>
        </article>)}
       </div>
      </div>
     </section>
     <section className="oh-landing-container oh-landing-account-area" aria-label="Host Connect registration and property authorization">
      <div className="oh-landing-account-heading">
       <p className="oh-landing-kicker"><CheckCircle2 size={15}/> GET STARTED</p>
       <h2>Ready to list <span className="oh-gradient-text">your space?</span></h2>
       <p>Create your host account without performer verification. Property listings still require adult legal capacity, written ownership or authorization evidence, and independent listing approval.</p>
      </div>
      <div className="oh-landing-account-box">

     <a href="/" className="text-sm text-[#A6C9F0]">← Return to Content Connect X</a>
     <section className="oh-panel space-y-4 p-6 md:p-8">
      <h2 className="text-2xl font-bold">Your Host Connect account</h2>
      {!user?<><p className="text-[#BBCBE0]">Sign in or create an account to list spaces for adult photography and filming—with clear authorization and house rules.</p>
        <button className={primary} onClick={()=>setShowLogin(true)}>Sign in or create a host account</button></>:
       <><p className="text-sm text-[#B5C8DF]">Signed in as {user.email}</p>
        {!ready?<div className="space-y-4">
          <p className="text-sm text-[#B9C9E2]">Before activating hosting, review the complete agreement and confirm the following requirements.</p>
          <details className="oh-terms-details"><summary>Read the Host Connect Property Host Agreement (required)</summary>
           <div className="oh-terms-content"><p>Agreement version: {HOST_TERMS_VERSION}. Please review every section before accepting.</p>
            {HOST_TERMS.map(section=><section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}
           </div>
          </details>
          <label className="oh-terms-check"><input type="checkbox" checked={capacityOK} onChange={e=>setCapacityOK(e.target.checked)}/>I am at least 18 and have legal capacity to enter a hosting agreement.</label>
          <label className="oh-terms-check"><input type="checkbox" checked={authorityOK} onChange={e=>setAuthorityOK(e.target.checked)}/>I own the property or have written owner permission specifically authorizing paid production rentals, including adult-content filming where I allow it. I will supply documentation before publishing.</label>
          <label className="oh-terms-check"><input type="checkbox" checked={adultUseOK} onChange={e=>setAdultUseOK(e.target.checked)}/>I understand this marketplace can be used for nude photography and sexually explicit adult video shoots, and I will choose permitted activities and comply with applicable rules.</label>
          <label className="oh-terms-check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>I have read and agree to the complete Host Connect Property Host Agreement.</label>
          <button className={primary+' w-full'} disabled={busy||!terms||!capacityOK||!authorityOK||!adultUseOK} onClick={register}>{account?.registered?'Accept updated host agreement':'Activate free host account'}</button>
        </div>:<div className="space-y-3"><p className="text-sm text-[#8de6ce]">Host terms accepted. You can manage your listings.</p>
          <button className={primary+' w-full'} onClick={openWorkspace}>Open property dashboard <ArrowRight size={16}/></button></div>}
       </>}
      {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
      {notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
     </section>
      </div>
     </section>
    </div>}
  </main>
  <footer className="oh-footer"><div className="oh-landing-container oh-footer-inner"><p>© 2027 Host Connect. All rights reserved.</p><a href="/" className="oh-ccx-gradient">Content Connect X</a></div></footer>
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
