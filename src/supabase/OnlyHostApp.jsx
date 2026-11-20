/** Host Connect — host-only property management workspace.
 * Uses exactly the same Supabase users, listings and booking
 * transactions as Content Connect X; no shadow reservation inventory exists.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Home,ArrowUpRight,ArrowRight,LogOut,CalendarDays,ShieldCheck,Clapperboard,UsersRound,FileSignature,Sparkles,CheckCircle2,Clock3,Wallet,MessageCircleMore,Eye,EyeOff,Brush,SlidersHorizontal,KeyRound,Settings,ChevronDown,Menu,X,ClipboardList,Bell,Briefcase,ArrowLeft} from 'lucide-react';
import HostingMarketplace from './HostingMarketplace';
import ProfessionalLandingHero from './ProfessionalLandingHero';
import {useAuthAppearance} from './authAppearance';
import HostProfileSettings from './HostProfileSettings';
import {HOST_TERMS,HOST_TERMS_VERSION} from './hostTerms';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-4 py-3 text-sm text-[var(--cc-text-primary)] outline-none focus:ring-2 focus:ring-[var(--cc-focus)]';
const primary='oh-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold';
const secondary='oh-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm';

/** Host benefits are collapsed by default on mobile but stay open on desktop. */
function HostFeature({Icon,title,tag,text}){
 const ref=useRef(null);
 useEffect(()=>{
  const viewport=window.matchMedia('(max-width: 640px)');
  const sync=()=>{if(ref.current)ref.current.open=!viewport.matches;};
  sync();viewport.addEventListener('change',sync);
  return()=>viewport.removeEventListener('change',sync);
 },[]);
 return <details ref={ref} className="oh-landing-card oh-feature-details" data-host-feature={title}>
  <summary className="oh-feature-summary">
   <span className="oh-landing-card-tag">{tag}</span>
   <span className="oh-landing-card-icon"><Icon size={28} strokeWidth={1.65}/></span>
   <span className="oh-feature-title">{title}</span>
   <ChevronDown size={18} className="oh-feature-toggle" aria-hidden="true"/>
  </summary>
  <p className="oh-feature-description">{text}</p>
  <span className="oh-landing-card-accent" aria-hidden="true"/>
 </details>;
}
export default function OnlyHostApp(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [account,setAccount]=useState(null);
 const [showSettings,setShowSettings]=useState(false);
 const [hostMenuOpen,setHostMenuOpen]=useState(false),[hostSection,setHostSection]=useState('host');
 const hostMenuButtonRef=useRef(null),hostMenuCloseRef=useRef(null),hostMenuDialogRef=useRef(null);
 const [view,setView]=useState('account'),[showLogin,setShowLogin]=useState(false),[signUp,setSignUp]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false);
 const [terms,setTerms]=useState(false),[capacityOK,setCapacityOK]=useState(false),[authorityOK,setAuthorityOK]=useState(false),[adultUseOK,setAdultUseOK]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const user=session?.user;
 useEffect(()=>{
  if(!hostMenuOpen)return;
  const prior=document.body.style.overflow;document.body.style.overflow='hidden';
  hostMenuCloseRef.current?.focus();
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();setHostMenuOpen(false);return;}
   if(event.key!=='Tab'||!hostMenuDialogRef.current)return;
   const targets=[...hostMenuDialogRef.current.querySelectorAll('button:not(:disabled),a[href]')].filter(node=>node.getClientRects().length>0);
   if(!targets.length)return;
   const first=targets[0],last=targets[targets.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!hostMenuDialogRef.current.contains(document.activeElement))){
    event.preventDefault();first.focus();
   }
  };
  document.addEventListener('keydown',keydown);
  return()=>{document.body.style.overflow=prior;document.removeEventListener('keydown',keydown);hostMenuButtonRef.current?.focus();};
 },[hostMenuOpen]);
 useAuthAppearance(user);
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
   if(active){setSession(next);if(!next?.user){setAccount(null);setView('account');setShowSettings(false);}}
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
 const signOut=async()=>{
  setHostMenuOpen(false);
  if(busy)return;
  setBusy(true);setError('');
  try{
   const {error:failure}=await supabase.auth.signOut();
   if(failure)throw failure;
   setSession(null);setAccount(null);setView('account');setShowSettings(false);
  }catch(e){setError(e.message||'Could not sign out. Try again.');}
  finally{setBusy(false);}
 };
 const register=async()=>{
  setBusy(true);setError('');setNotice('');
  try{const r=await integrationAction('onlyhost_register',{accept_terms:terms,terms_version:HOST_TERMS_VERSION,legal_capacity_confirmed:capacityOK,property_authority_confirmed:authorityOK,adult_production_understood:adultUseOK});
   setNotice(r.note||'Account activated');await refreshAccount(session);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const ready=Boolean(user&&account?.registered&&account?.host_terms_current);
 const openHostSection=next=>{
  if(!ready){setView('account');setHostMenuOpen(false);return;}
  setHostSection(next);setView('workspace');setHostMenuOpen(false);
  window.scrollTo({top:0,behavior:'auto'});
 };
 const openWorkspace=()=>{
  if(!user){setShowLogin(true);return;}
  if(!ready){setView('account');return;}
  setView('workspace');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 return <div className="oh-app host-connect-theme min-h-screen text-[var(--cc-text-primary)]">
  <div className="oh-topline"/>
  <header className="oh-header sticky top-0 z-40">
   <div className="oh-header-inner mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 md:px-8">
    <button className="oh-brand flex shrink-0 items-center gap-3" onClick={()=>setView(user&&ready?'workspace':'account')} aria-label="Host Connect home">
     <span className="oh-mark"><Home size={22} strokeWidth={2.3}/></span>
     <span className="oh-wordmark text-xl font-extrabold tracking-tight">Host<span className="oh-gradient-text">Connect</span></span>
    </button>
    <nav className="oh-header-actions ml-auto flex items-center justify-end gap-2" aria-label="Host Connect navigation">
     <a href="/" className={'oh-ccx-link items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold '+(user?'hidden sm:inline-flex':'inline-flex')}><span className="oh-ccx-gradient">Content Connect X</span></a>
     {!ready&&<button className={primary+' oh-list-space'+(user?' hidden sm:inline-flex':'')} onClick={openWorkspace}>List Your Space<ArrowUpRight size={16}/></button>}
     {user&&<button className="oh-ccx-link hidden items-center gap-2 rounded-xl px-3 py-2.5 text-sm sm:inline-flex" onClick={()=>setShowSettings(true)} aria-label="Host settings"><Settings size={18}/><span className="hidden sm:inline">Settings</span></button>}
     {user&&<button type="button" className="oh-logout-button hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--cc-border)] px-3 py-2 text-sm font-semibold sm:inline-flex" onClick={()=>void signOut()} disabled={busy} aria-label="Log out of Host Connect"><LogOut size={18}/>Log out</button>}
     {user&&<button ref={hostMenuButtonRef} type="button" aria-label="Open Host Connect navigation menu" aria-expanded={hostMenuOpen}
      className="oh-host-menu-trigger inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--cc-border)] sm:hidden"
      onClick={()=>setHostMenuOpen(true)}><Menu size={22}/></button>}
    </nav>
   </div>
  </header>
  {hostMenuOpen&&user&&<div className="oh-host-mobile-overlay fixed inset-0 z-[80] sm:hidden">
   <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/50" aria-label="Close Host Connect navigation" onClick={()=>setHostMenuOpen(false)}/>
   <div ref={hostMenuDialogRef} role="dialog" aria-modal="true" aria-label="Host Connect mobile navigation"
    className="oh-host-mobile-drawer absolute bottom-0 right-0 top-0 flex w-[min(21rem,90vw)] flex-col overflow-hidden border-l border-[var(--cc-border)]">
    <div className="flex items-center justify-between gap-3 border-b border-[var(--cc-border)] p-4">
     <h2 className="text-base font-semibold">Host Connect</h2>
     <button ref={hostMenuCloseRef} type="button" className="grid h-11 w-11 place-items-center rounded-lg"
      aria-label="Close Host Connect menu" onClick={()=>setHostMenuOpen(false)}><X size={21}/></button>
    </div>
    <nav aria-label="Host Connect pages" className="oh-host-mobile-links flex-1 overflow-y-auto p-3">
     {ready&&/** @type {Array<[string,string,import('react').ElementType]>} */ ([
      ['host','Dashboard',Home],['review','Guest reviews',ClipboardList],
      ['alerts','Notifications',Bell],['crew','Crew inbox',UsersRound],
      ['cleaning','Cleaning assignments',Brush]
     ]).map(([key,label,Icon])=><button type="button" key={key}
      className={'oh-host-mobile-link flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm'+(hostSection===key?' is-active':'')}
      aria-current={hostSection===key?'page':undefined} onClick={()=>openHostSection(key)}>
      <Icon size={19} aria-hidden="true"/>{label}</button>)}
     {!ready&&<button type="button" className="oh-host-mobile-link flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm"
      onClick={()=>{setHostMenuOpen(false);setView('account');}}><Briefcase size={19}/>Complete host account setup</button>}
     <button type="button" className="oh-host-mobile-link flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm"
      onClick={()=>{setShowSettings(true);setHostMenuOpen(false);}}><Settings size={19}/>Account settings</button>
     <a href="/" className="oh-host-mobile-link flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm"><ArrowLeft size={19}/>Content Connect X</a>
    </nav>
    <div className="border-t border-[var(--cc-border)] p-3">
     <button type="button" className="oh-host-mobile-link flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm"
      disabled={busy} onClick={()=>void signOut()}><LogOut size={19}/>Log out</button>
    </div>
   </div>
  </div>}
  {showSettings&&user&&<HostProfileSettings user={user} onClose={()=>setShowSettings(false)}/>}
  <main id="main-content">
   {loading?<div className="mx-auto max-w-7xl px-6 py-24 text-center">Loading…</div>:view==='workspace'&&ready?
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
     <div className="oh-panel mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
      <div><h1 className="text-2xl font-bold">Host Connect property dashboard</h1><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Manage your locations, rules, equipment, availability, staff, and booking requests in one place.</p></div>
      <a href="/" className={secondary}>Back to Content Connect X</a>
     </div>
     <HostingMarketplace paid={true} isAdmin={false} user={user} brand="host_connect" initialSection="host" requestedSection={hostSection} hostOnly/>
    </div>
   :<div className="oh-marketing">
     {user?<ProfessionalLandingHero host onStart={openWorkspace}/>:<>
      <h1 className="sr-only">Host Connect — studios, locations and sets for professional productions</h1>
      <section className="oh-landing-banner" aria-label="Host Connect studios and locations">
      <picture className="block w-full" data-host-responsive-hero="true">
        <source media="(max-width: 640px)" srcSet="/Host_Connect_Banner_Mobile.png"/>
        <img src="/Host_Connect_Banner.png" alt="Host Connect — studios, locations and sets for professional productions" className="oh-landing-banner-image"/>
       </picture>
     </section>
     </>}
     <section className="oh-landing-section oh-landing-intro" aria-labelledby="oh-features-title">
      <div className="oh-landing-container">
       <div className="oh-landing-heading">
        <p className="oh-landing-kicker"><Sparkles size={15}/> YOUR PROPERTY · YOUR RULES · YOUR INCOME</p>
        <h2 id="oh-features-title">Your space has potential. <span className="oh-gradient-text">You set the terms.</span></h2>
        <p>List houses, lofts, studios and private locations for professional adult-content production. Welcome nude photography or explicit adult filming on your own terms—with informed permission, custom rules, and a host dashboard built for you.</p>
       </div>
       <div className="oh-landing-cards">
        {[
         {Icon:Home,title:'List Your Property',tag:'YOUR PORTFOLIO',text:'Create multiple listings for houses, apartments you are authorized to offer, lofts, studios or private filming sets. Add photos, amenities and crew capacity.'},
         {Icon:Wallet,title:'Set Your Own Rates',tag:'YOUR PRICING',text:'Choose a daily rate with a standard 24-hour booking from 3 p.m. until 3 p.m. the next day. Configure weekend and seasonal pricing, overtime and discounts where available.'},
         {Icon:Clock3,title:'Control Booking Durations',tag:'YOUR SCHEDULE',text:'Set available days, advance notice, blocked dates and turnaround buffers. Guests reserve complete 24-hour days so overnight and early-morning shoots fit.'},
         {Icon:ShieldCheck,title:'Choose Adult Uses',tag:'YOUR BOUNDARIES',text:'Explicitly opt in to nude photography or adult video production, or restrict what is allowed. Guests know your rules before requesting a shoot.'},
         {Icon:Brush,title:'Set Cleaning Fees',tag:'YOUR TURNOVER',text:'Choose a cleaning fee suitable for your house size and setup. Arrange your own cleaners; optional local service partnerships may be introduced later.'},
         {Icon:SlidersHorizontal,title:'House Rules & Restrictions',tag:'YOUR CONTROL',text:'Define permitted rooms, sound levels, filming hours, crew limits, insurance requirements, deposits and cancellation preferences.'},
         {Icon:CalendarDays,title:'Manage Your Calendar',tag:'YOUR AVAILABILITY',text:'Block dates, review reservations and use calendar import/export to coordinate your availability with other bookings.'},
         {Icon:Eye,title:'Views & Activity Dashboard',tag:'YOUR INSIGHTS',text:'See property impressions, listing statuses, booking requests and upcoming shoots from one host dashboard.'},
         {Icon:MessageCircleMore,title:'Messages & Requests',tag:'YOUR GUESTS',text:'Track booking conversations and respond to production questions and requests through your private host workspace.'},
         {Icon:FileSignature,title:'Booking Agreements',tag:'YOUR PROTECTION',text:'Document permitted activities, access rules, property conditions and commercial terms. Approval and external provider activation may be required.'},
         {Icon:UsersRound,title:'Staff & Equipment',tag:'YOUR OPERATIONS',text:'Manage optional equipment, staff, cleaning tasks, turnover checklists, inventory and condition photos.'},
         {Icon:KeyRound,title:'Privacy & Property Authority',tag:'YOUR TRUST',text:'Your exact address stays private until authorized. Submit owner or written landlord permission before a listing can be approved for adult-production rentals.'}
        ].map(({Icon,title,tag,text})=><HostFeature key={title} Icon={Icon} title={title} tag={tag} text={text}/>)}
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
        {[{n:'01',title:'Join as a host',text:'Register and accept the property host agreement. Hosts are not required to complete performer verification.'},{n:'02',title:'Prove your authority',text:'Provide ownership evidence or written permission from the property owner for adult productions.'},{n:'03',title:'Set your rules & pricing',text:'Choose permitted uses, cleaning fees, daily pricing and availability.'},{n:'04',title:'Review booking requests',text:'Manage guest messages, booking activity and property operations in one dashboard.'}].map(step=><article className="oh-landing-step" key={step.n}>
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

     <section className="oh-panel space-y-4 p-6 md:p-8">
      <h2 className="text-2xl font-bold">Your Host Connect account</h2>
      {!user?<><p className="text-[var(--cc-text-secondary)]">Sign in or create an account to list spaces for adult photography and filming—with clear authorization and house rules.</p>
        <button className={primary} onClick={()=>setShowLogin(true)}>Sign in or create a host account</button></>:
       <><p className="text-sm text-[var(--cc-text-secondary)]">Signed in as {user.email}</p>
        {!ready?<div className="space-y-4">
          <p className="text-sm text-[var(--cc-text-secondary)]">Before activating hosting, review the complete agreement and confirm the following requirements.</p>
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
        </div>:<div className="space-y-3"><p className="text-sm text-[var(--cc-link)]">Host terms accepted. You can manage your listings.</p>
          <button className={primary+' w-full'} onClick={openWorkspace}>Open property dashboard <ArrowRight size={16}/></button></div>}
       </>}
      {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
      {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
     </section>
      </div>
     </section>
    </div>}
  </main>
  <footer className="oh-footer"><div className="oh-landing-container oh-footer-inner">
   <strong className="text-base font-bold">Host Connect</strong>
   <a href="/" className="oh-ccx-gradient">Content Connect X</a>
   <p>© 2027 Host Connect. All rights reserved.</p>
  </div></footer>
  {showLogin&&<div className="oh-modal-backdrop" role="presentation" onClick={()=>setShowLogin(false)}>
   <section role="dialog" aria-modal="true" aria-label="Host Connect account" className="oh-modal max-w-md" onClick={e=>e.stopPropagation()}>
    <button className="absolute right-5 top-5" aria-label="Close" onClick={()=>setShowLogin(false)}>Close ×</button>
    <h2 className="text-2xl font-bold">{signUp?'Create a Host Connect account':'Welcome to Host Connect'}</h2>
    <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">One secure sign-in across Host Connect and Content Connect X.</p>
    <form className="mt-6 space-y-3" onSubmit={auth}>
     <label className="block text-xs">Email<input className={input+' mt-2'} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
     <label className="block text-xs">Password<span className="relative mt-2 block"><input className={input+' pr-12'} type={showPassword?'text':'password'} autoComplete={signUp?'new-password':'current-password'} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--cc-text-secondary)]" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
     <button className={primary+' w-full'} disabled={busy}>{signUp?'Create free account':'Sign in'}</button>
    </form>
    <button className="mt-4 text-sm text-[var(--cc-link)]" onClick={()=>setSignUp(!signUp)}>{signUp?'Already registered? Sign in':'Create your account'}</button>
    {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {notice&&<p className="mt-3 text-sm text-emerald-800">{notice}</p>}
   </section></div>}
 </div>;
}
