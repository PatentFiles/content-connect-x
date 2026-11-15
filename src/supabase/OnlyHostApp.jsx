/** OnlyHost public brand. Uses exactly the same Supabase users, listings and booking
 * transactions as Content Connect X; no shadow reservation inventory exists.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Home,Camera,MapPin,Users,ShieldCheck,CalendarDays,ArrowUpRight,ArrowRight,
 LogOut,Search,Building2} from 'lucide-react';
import HostingMarketplace from './HostingMarketplace';
import YotiVerification from './YotiVerification';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[#36425E] bg-[#0E172B] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#43CBED]';
const primary='oh-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold';
const secondary='oh-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm';

const categories=[
 {id:'film_studio',name:'Film studios',Icon:Camera,description:'Controlled environments built for production'},
 {id:'house',name:'Houses & villas',Icon:Home,description:'Character-rich private filming locations'},
 {id:'loft',name:'Creative lofts',Icon:Building2,description:'Light-filled studios for editorial projects'}
];
const hmoney=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
export default function OnlyHostApp(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 const [account,setAccount]=useState(null),[isVerified,setVerified]=useState(false);
 const [view,setView]=useState('explore'),[showLogin,setShowLogin]=useState(false),[signUp,setSignUp]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [terms,setTerms]=useState(false),[docs,setDocs]=useState({id:null,selfie:null});
 const [listings,setListings]=useState([]),[search,setSearch]=useState(''),[city,setCity]=useState('');
 const [category,setCategory]=useState(''),[selected,setSelected]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const user=session?.user;
 const refreshAccount=useCallback(async(current)=>{
  if(!current?.user){setVerified(false);setAccount(null);return;}
  const [age,registration]=await Promise.all([
   supabase.from('age_verification_requests').select('status,expires_at')
    .eq('user_id',current.user.id).order('created_at',{ascending:false}).limit(1),
   integrationAction('onlyhost_status')
  ]);
  if(age.error)throw age.error;
  const latest=age.data?.[0];
  setVerified(Boolean(latest?.status==='approved'&&(!latest.expires_at||new Date(latest.expires_at)>new Date())));
  setAccount(registration);
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
 const browse=async(q=city,c=category)=>{
  setBusy(true);setError('');
  try{
   const base=import.meta.env.VITE_SUPABASE_URL;
   const url=new URL(base+'/functions/v1/onlyhost-public');
   if(q)url.searchParams.set('city',q);
   if(c)url.searchParams.set('category',c);
   const response=await fetch(url,{headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'}});
   const data=await response.json();
   if(!response.ok)throw Error(data?.error||'Unavailable');
   setListings(data.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{void browse('','');},[]);
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
    <button className="flex items-center gap-3" onClick={()=>setView('explore')} aria-label="OnlyHost homepage">
     <span className="oh-mark"><Home size={22} strokeWidth={2.3}/></span><span className="text-xl font-extrabold tracking-tight">Only<span className="oh-gradient-text">Host</span><span className="ml-1 text-xs text-[#A4B5CF]">STUDIOS</span></span>
    </button>
    <div className="flex items-center gap-2">
     <button className={secondary+' hidden sm:inline-flex'} onClick={()=>{setView('explore');document.getElementById('oh-listings')?.scrollIntoView({behavior:'smooth'});}}>Explore spaces</button>
     <button className={primary} onClick={openWorkspace}>{ready?'My workspace':'List your space'}<ArrowUpRight size={16}/></button>
     {user&&<button className="oh-icon-button" onClick={()=>supabase.auth.signOut()} aria-label="Sign out"><LogOut size={18}/></button>}
    </div>
   </div>
  </header>
  <main id="main-content">
   {loading?<div className="mx-auto max-w-7xl px-6 py-24 text-center">Loading…</div>:view==='workspace'&&ready?
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
     <div className="oh-panel mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
      <div><h1 className="text-2xl font-bold">OnlyHost workspace</h1><p className="mt-1 text-sm text-[#B5C5DC]">Shared calendar and bookings with Content Connect X—no duplicate inventory.</p></div>
      <button onClick={()=>setView('explore')} className={secondary}>Back to OnlyHost homepage</button>
     </div>
     <HostingMarketplace paid={true} isAdmin={false} user={user} brand="onlyhost"/>
    </div>
   :view==='account'?<div className="mx-auto max-w-2xl space-y-5 px-4 py-10 md:py-16">
     <button className="text-sm text-[#A6C9F0]" onClick={()=>setView('explore')}>← Return to homes</button>
     <section className="oh-panel space-y-4 p-6 md:p-8">
      <h1 className="text-2xl font-bold">Your OnlyHost account</h1>
      {!user?<><p className="text-[#BBCBE0]">Sign in to activate your host workspace.</p><button className={primary} onClick={()=>setShowLogin(true)}>Sign in or create an account</button></>:
       <><p className="text-sm text-[#B5C8DF]">Signed in as {user.email}</p>
        <p className="text-sm">Account: <strong>{account?.registered?'Registered':'Not registered'}</strong></p>
        {!account?.registered&&<><label className="flex gap-3 text-sm"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>I agree to OnlyHost's hosting terms and confirm I will list only spaces I have permission to offer.</label>
         <button className={primary} disabled={!terms||busy} onClick={register}>Activate free OnlyHost account</button></>}
        <p className="text-sm">Independent age verification: <strong>{isVerified?'Approved':'Not yet approved'}</strong></p>
        {!isVerified&&<div className="space-y-4">
         <YotiVerification/>
         <div className="rounded-xl border border-[#3C4D69] bg-[#101A2D] p-4 space-y-3">
          <h3 className="font-semibold">Alternative: manual identity review</h3>
          <p className="text-xs text-[#ADBDD3]">Upload your ID and selfie privately. An authorized reviewer must approve them before bookings or hosting can begin.</p>
          <label className="block text-xs">Government ID<input className="mt-2 block" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>upload('id',e.target.files?.[0])}/></label>
          <label className="block text-xs">Selfie<input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('selfie',e.target.files?.[0])}/></label>
          <button className={secondary} disabled={busy||!docs.id||!docs.selfie} onClick={submitIdentity}>Submit for independent review</button>
         </div>
        </div>}
        {ready&&<button className={primary} onClick={openWorkspace}>Open your shared hosting workspace <ArrowRight size={16}/></button>}
       </>}
     </section>
    </div>
   :<>
    <section className="relative overflow-hidden">
     <div className="oh-hero-grid absolute inset-0 pointer-events-none"/>
     <div className="mx-auto grid min-h-[520px] max-w-7xl items-center gap-10 px-4 pb-16 pt-20 md:grid-cols-[1.1fr_.9fr] md:px-6 md:pt-24">
      <div className="relative z-10">
       <p className="oh-eyebrow"><span className="oh-dot"/>The professional location marketplace</p>
       <h1 className="mt-6 text-[2.8rem] font-extrabold leading-[1.08] tracking-[-.055em] sm:text-6xl lg:text-7xl">Every great shoot<br/>starts with the <span className="oh-gradient-text">right space.</span></h1>
       <p className="mt-6 max-w-xl text-base leading-8 text-[#B9C8DF]">Find studios, film-friendly homes and creative locations. Plan with confidence, request dates, and keep every booking in sync across OnlyHost and Content Connect X.</p>
       <div className="mt-8 flex flex-wrap gap-3">
        <button className={primary} onClick={()=>document.getElementById('oh-listings')?.scrollIntoView({behavior:'smooth'})}>Find a location <ArrowUpRight size={18}/></button>
        <button className={secondary} onClick={openWorkspace}>Become a host <ArrowRight size={17}/></button>
       </div>
       <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#9EBCD5]"><span className="inline-flex gap-2 items-center"><ShieldCheck size={16}/>Host-reviewed listings</span><span className="inline-flex gap-2 items-center"><CalendarDays size={16}/>Shared booking availability</span></div>
      </div>
      <div className="oh-hero-visual relative z-10 hidden min-h-[425px] overflow-hidden rounded-[32px] p-7 md:block">
       <div className="oh-hero-orbit"/>
       <div className="absolute left-7 top-7 rounded-full border border-[#D2E7FF]/20 bg-[#0E1F33]/80 px-4 py-2 text-[11px] uppercase tracking-[.18em]">OnlyHost / Spaces</div>
       <div className="absolute bottom-9 left-8 right-8 rounded-2xl border border-white/15 bg-[#0A1A2E]/80 p-5 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-widest text-[#9BBBD5]">Find your next production location</p>
        <p className="mt-2 text-2xl font-bold">Spaces that make ideas possible.</p>
       </div>
      </div>
     </div>
    </section>
    <section id="oh-listings" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 md:px-6">
     <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="oh-eyebrow">Explore the marketplace</p><h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Discover your next <span className="oh-gradient-text">location.</span></h2></div>
      <p className="text-sm text-[#A6BBD4]">Only independent, approved properties are listed.</p>
     </div>
     <form className="oh-panel mt-7 grid gap-3 p-4 sm:grid-cols-[1fr_210px_auto]" onSubmit={e=>{e.preventDefault();browse(search,category);}}>
      <label className="text-xs text-[#B7CAE0]">City or area<input className={input+' mt-1'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Los Angeles, Phoenix, New York…"/></label>
      <label className="text-xs text-[#B7CAE0]">Space type<select className={input+' mt-1'} value={category} onChange={e=>setCategory(e.target.value)}>
       <option value="">All spaces</option>{categories.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select></label>
      <button className={primary+' self-end'} disabled={busy}><Search size={17}/>Search</button>
     </form>
     {error&&<p className="mt-4 rounded-xl bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
     {notice&&<p className="mt-4 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
     <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map(v=><button key={v.id} onClick={()=>setSelected(v)} className="oh-property-card text-left">
       <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#203A56] to-[#142339]">
        {v.photos?.[0]?.url?<img src={v.photos[0].url} alt={v.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105"/>:<div className="flex h-full items-center justify-center"><Building2 size={45} className="text-[#7397AD]"/></div>}
        <span className="absolute bottom-3 left-3 rounded-full bg-[#09192D]/90 px-3 py-1.5 text-xs capitalize">{v.category.replaceAll('_',' ')}</span>
       </div>
       <div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-bold">{v.title}</h3><span className="text-sm font-bold">{hmoney(v.hourly_rate)}<span className="text-xs font-normal text-[#9AB1C9]">/hr</span></span></div>
        <p className="mt-2 flex gap-1 items-center text-xs text-[#B3C3DB]"><MapPin size={14}/>{[v.city,v.state,v.country].filter(Boolean).join(', ')}</p>
        <p className="mt-2 flex gap-2 items-center text-xs text-[#B3C3DB]"><Users size={13}/>Up to {v.capacity} guests · {v.minimum_hours} hr minimum</p>
       </div>
      </button>)}
     </div>
     {!listings.length&&!busy&&<div className="oh-panel mt-7 flex flex-col items-center gap-3 p-10 text-center">
       <Building2 size={34} className="text-[#83BDE4]"/><h3 className="text-xl font-semibold">New studios coming soon</h3>
       <p className="max-w-md text-sm leading-6 text-[#A6B9D0]">OnlyHost is onboarding its first independently reviewed properties. Create your account to list a professional space; unpublished listings are never shown here.</p>
       <button className={primary} onClick={openWorkspace}>List your space <ArrowUpRight size={16}/></button>
      </div>}
     {selected&&<div className="oh-modal-backdrop" role="presentation" onClick={()=>setSelected(null)}>
       <section className="oh-modal" role="dialog" aria-modal="true" aria-label={selected.title} onClick={e=>e.stopPropagation()}>
        <button className="absolute right-5 top-5 text-sm text-white" onClick={()=>setSelected(null)} aria-label="Close">Close ×</button>
        {selected.photos?.[0]?.url&&<img className="h-60 w-full rounded-xl object-cover" src={selected.photos[0].url} alt={selected.title}/>}
        <h3 className="mt-5 text-2xl font-bold">{selected.title}</h3>
        <p className="mt-2 text-sm text-[#B8C7DC]">{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>
        <p className="mt-3 text-sm leading-7 text-[#C4CFE1]">{selected.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3"><p className="font-bold">{hmoney(selected.hourly_rate)}/hour</p><button className={primary} onClick={()=>{setSelected(null);openWorkspace();}}>Request dates <ArrowRight size={16}/></button></div>
        <p className="mt-4 text-xs text-[#A1B7D0]">Booking requires a verified account and a production-use request. Exact address is released only after approval, signed rental terms and confirmed payment.</p>
       </section></div>}
    </section>
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
     <p className="oh-eyebrow">Curated categories</p><h2 className="mt-2 text-3xl font-bold">Made for <span className="oh-gradient-text">creative people.</span></h2>
     <div className="mt-7 grid gap-4 md:grid-cols-3">
      {categories.map(({id,name,description,Icon})=><button key={id} className="oh-category-card text-left" onClick={()=>{setCategory(id);void browse('',id);document.getElementById('oh-listings')?.scrollIntoView({behavior:'smooth'});}}>
       <span className="oh-category-icon"><Icon size={24}/></span><h3 className="mt-8 text-xl font-bold">{name}</h3><p className="mt-2 text-sm leading-6 text-[#A9BED5]">{description}</p>
       <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#76D9ED]">Explore category <ArrowUpRight size={15}/></span>
      </button>)}
     </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
     <div className="oh-panel grid gap-8 p-7 md:grid-cols-2 md:p-11">
      <div><p className="oh-eyebrow">One booking. Everywhere.</p><h2 className="mt-3 text-3xl font-bold leading-tight">Your calendar stays aligned across both marketplaces.</h2>
       <p className="mt-4 text-sm leading-7 text-[#B2C6DD]">A location booked through OnlyHost uses the very same database and availability rules as Content Connect X. Hosts maintain one inventory, one production calendar and one operating workflow.</p>
       <button onClick={openWorkspace} className={primary+' mt-7'}>Open your host workspace <ArrowUpRight size={17}/></button>
      </div>
      <div className="space-y-4">{[
        ['01','Publish with confidence','Properties and photos require independent approval.'],
        ['02','Control your availability','Shared booking locks and schedule buffers prevent double-booking.'],
        ['03','Run better productions','Equipment, agreements, cleaning and incident records stay together.']
       ].map(([step,title,description])=><div className="flex gap-4 border-b border-[#3B4A62] pb-4" key={step}><span className="oh-step">{step}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-6 text-[#ABC1D8]">{description}</p></div></div>)}</div>
     </div>
    </section>
    <footer className="border-t border-[#32465D] py-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 md:px-6"><p className="font-bold">Only<span className="oh-gradient-text">Host</span> <span className="text-xs font-normal text-[#A4B9D1]">· Studios & Locations</span></p><p className="text-xs text-[#A4B9D1]">Independent brand. Shared secure booking infrastructure. All listings subject to verification.</p></div></footer>
   </>}
  </main>
  {showLogin&&<div className="oh-modal-backdrop" role="presentation" onClick={()=>setShowLogin(false)}>
   <section role="dialog" aria-modal="true" aria-label="OnlyHost account" className="oh-modal max-w-md" onClick={e=>e.stopPropagation()}>
    <button className="absolute right-5 top-5" aria-label="Close" onClick={()=>setShowLogin(false)}>Close ×</button>
    <h2 className="text-2xl font-bold">{signUp?'Create an OnlyHost account':'Welcome to OnlyHost'}</h2>
    <p className="mt-2 text-sm text-[#A5BBD4]">One secure sign-in across OnlyHost and Content Connect X.</p>
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
