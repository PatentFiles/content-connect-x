/** Content Connect X — Supabase application, backed by protected Edge Functions. */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, requireSupabase } from '@/api/supabaseClient';
import { platformAction } from './platformApi';
import MemberWorkspace from './MemberWorkspace';
import TrustCenter from './TrustCenter';
import ConsentCenter from './ConsentCenter';
import SafetyPanel from './SafetyPanel';
import ScheduleHub from './ScheduleHub';
import CommunityHub from './CommunityHub';
import FeedbackHub from './FeedbackHub';
import AdminProductControls from './AdminProductControls';
import MediaGallery from './MediaGallery';
import IntegrationHealth from './IntegrationHealth';
import ProductionManager from './ProductionManager';
import ReputationHub from './ReputationHub';
import SecurityCenter from './SecurityCenter';
import MfaChallenge from './MfaChallenge';
import AgreementPackets from './AgreementPackets';
import DashboardHome from './DashboardHome';
import YotiVerification from './YotiVerification';
import PublicLandingSections from './PublicLandingSections';
const HostingMarketplace = React.lazy(() => import('./HostingMarketplace'));
import { ShieldCheck, LockKeyhole, Search, UserRound, CreditCard, LogOut, UploadCloud, CheckCircle2, AlertTriangle, Loader2, RefreshCw, CalendarDays, MessageSquare, Lightbulb, Settings2, Images, UsersRound, Star, FileSignature, Building2 } from 'lucide-react';

const shell = 'ccx-app min-h-screen text-[#F5F3FF]';
const panel = 'ccx-surface p-5';
const input = 'w-full rounded-lg bg-[#0F1520] border border-[#34445D] px-3 py-2.5 text-white placeholder-[#7D8BA3] focus:outline-none focus:ring-2 focus:ring-blue-500';
const primary = 'ccx-primary rounded-xl px-4 py-2.5 text-white font-semibold disabled:opacity-50';
const muted = 'text-[#9AA6BC]';
function ErrorMessage({message}) { return message ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{message}</p> : null; }

export default function SupabaseApp() {
  const [session,setSession] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tab,setTab] = useState('dashboard');
  const [profile,setProfile] = useState(null);
  const [verification,setVerification] = useState(null);
  const [billing,setBilling] = useState(null);
  const [security,setSecurity] = useState(null);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [signUp,setSignUp] = useState(false);
  const [directory,setDirectory] = useState([]);
  const [search,setSearch] = useState('');
  const [queryRunning,setQueryRunning] = useState(false);
  const [documents,setDocuments] = useState({id:null,selfie:null});
  const [reviews,setReviews] = useState([]);
  const [mfaChecking,setMfaChecking] = useState(true);
  const [mfaNeeded,setMfaNeeded] = useState(false);
  const [visibleFeatures,setVisibleFeatures] = useState(null);
  // Yoti redirects are treated only as navigation hints, never proof of verification.
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.has('age_verification')){
      setTab('verification');
      params.delete('age_verification');
      const remainder=params.toString();
      window.history.replaceState(null,'',window.location.pathname+(remainder?'?'+remainder:'')+window.location.hash);
    }
  },[]);
  const user = session?.user;
  const approved = verification?.status === 'approved' && (!verification.expires_at || new Date(verification.expires_at) > new Date());
  const activePaid = (billing?.status === 'active' || billing?.status === 'trial') && (!billing?.period_end || new Date(billing.period_end) > new Date());
  const isAdmin = security?.admin === true;
  const paid = activePaid || isAdmin;
  const suspended = security?.banned || security?.suspended;

  const refresh = useCallback(async (activeSession) => {
    if (!activeSession?.user) {setProfile(null);setVerification(null);setBilling(null);setSecurity(null);return;}
    const uid=activeSession.user.id;
    const [pr,ve,bi,se] = await Promise.all([
      supabase.from('member_profiles').select('id,display_name,role_type,bio,city,country,profile_complete').eq('id',uid).maybeSingle(),
      supabase.from('age_verification_requests').select('id,status,created_at,verified_at,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
      supabase.from('member_subscriptions').select('status,plan_id,period_end').eq('user_id',uid).maybeSingle(),
      supabase.from('account_security').select('banned,suspended,admin').eq('user_id',uid).maybeSingle(),
    ]);
    if (pr.error || ve.error || bi.error || se.error) throw new Error(pr.error?.message || ve.error?.message || bi.error?.message || se.error?.message);
    setProfile(pr.data);setVerification(ve.data?.[0]||null);setBilling(bi.data);setSecurity(se.data);
  },[]);

  useEffect(()=>{
    if (!supabase) {setError('Supabase configuration missing');setLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(async ({data,error:sessionError})=>{
      if(!active) return;
      if(sessionError) throw sessionError;
      setSession(data.session);
      await refresh(data.session);
    }).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      // Avoid issuing Supabase API requests synchronously in an auth callback.
      if(active){setSession(next);setProfile(null);setVerification(null);setBilling(null);setSecurity(null);}
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[refresh]);

  useEffect(()=>{
    if(!user) return;
    let cancelled=false;
    refresh(session).catch(e=>!cancelled&&setError(e.message));
    return()=>{cancelled=true;};
  },[session?.access_token,refresh]);

  useEffect(()=>{
    if(!approved){setVisibleFeatures(null);return;}
    let alive=true;
    platformAction('get_feature_flags').then(result=>{
      if(alive)setVisibleFeatures(result.flags||{});
    }).catch(err=>{
      console.warn('Feature visibility unavailable');
      if(alive)setVisibleFeatures({});
    });
    return()=>{alive=false;};
  },[approved,paid]);

  useEffect(()=>{
    let alive=true;
    if(!session?.user){setMfaNeeded(false);setMfaChecking(false);return;}
    setMfaChecking(true);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{
      if(!alive)return;
      if(error){setError('Unable to verify the authentication level.');setMfaNeeded(true);}
      else setMfaNeeded(data.currentLevel==='aal1'&&data.nextLevel==='aal2');
    }).catch(()=>{if(alive)setMfaNeeded(true);}).finally(()=>{if(alive)setMfaChecking(false);});
    return()=>{alive=false;};
  },[session?.access_token]);

  const authenticate = async (event) => {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const client=requireSupabase();
      const {data,error:authError} = signUp
        ? await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}})
        : await client.auth.signInWithPassword({email,password});
      if(authError) throw authError;
      if(signUp && !data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      else if(data.session){setSession(data.session);await refresh(data.session);}
    } catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const saveProfile=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const form=new FormData(event.currentTarget);
      const data={id:user.id,display_name:String(form.get('display_name')||'').trim().slice(0,100),role_type:String(form.get('role_type')||'creator'),bio:String(form.get('bio')||'').slice(0,2000),city:String(form.get('city')||'').slice(0,100),country:String(form.get('country')||'').slice(0,100),profile_complete:!!String(form.get('display_name')||'').trim(),updated_at:new Date().toISOString()};
      if(!data.display_name) throw new Error('Display name is required.');
      const {error:saveError}=await supabase.from('member_profiles').upsert(data,{onConflict:'id'});
      if(saveError) throw saveError;
      await refresh(session);setNotice('Profile saved.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const upload=(kind)=>async(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setError('');setNotice('');
    try{
      if(file.size>10*1024*1024)throw new Error('Maximum file size is 10 MB.');
      if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) throw new Error('Upload a PDF, JPEG, PNG or WEBP file.');
      const path=`${user.id}/${kind}-${crypto.randomUUID()}.${file.type==='application/pdf'?'pdf':file.type.split('/')[1]}`;
      const {error:uploadError}=await supabase.storage.from('age-verification').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      setDocuments(previous=>({...previous,[kind]:path}));setNotice(`${kind==='id'?'ID document':'Selfie'} uploaded privately.`);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const submitVerification=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      if(!documents.id||!documents.selfie)throw new Error('Upload both documents first.');
      const {data,error:submitError}=await supabase.functions.invoke('submit-age-verification',{body:{id_document_path:documents.id,selfie_document_path:documents.selfie}});
      if(submitError)throw submitError;
      if(data?.error)throw new Error(data.error);
      setDocuments({id:null,selfie:null});await refresh(session);setNotice('Your age-verification request was submitted for review.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const findCreators=async()=>{
    setQueryRunning(true);setError('');
    try{
      const {data,error:searchError}=await supabase.functions.invoke('directory',{body:{query:search}});
      if(searchError)throw searchError;
      if(data?.error)throw new Error(data.error);
      setDirectory(data?.results||[]);
    }catch(e){setError(e.message);}finally{setQueryRunning(false);}
  };

  if(loading||mfaChecking)return <div className={`${shell} grid place-items-center`}><Loader2 className="animate-spin"/></div>;
  if(!user)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <div className="mx-auto flex min-h-[calc(100vh-4px)] max-w-6xl flex-col justify-center gap-6 px-4 py-8 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-8 lg:px-6">
      <section className="ccx-login-art flex min-h-[245px] flex-col justify-end rounded-[26px] p-6 sm:min-h-[390px] sm:p-9">
        <div className="relative z-10 max-w-md">
          <p className="ccx-eyebrow">The creative connection</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-[2.6rem]">Create. Collaborate. <span className="ccx-gradient-text">Connect.</span></h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#E5E0F1]">Professional creators, production teams, studios and trusted locations—all in one private workspace.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="ccx-secondary rounded-full px-3 py-1.5">Verified professionals</span>
            <span className="ccx-secondary rounded-full px-3 py-1.5">Production management</span>
          </div>
        </div>
      </section>
      <section id="ccx-auth" className="ccx-surface w-full max-w-xl scroll-mt-24 justify-self-center p-6 sm:p-8" aria-label={signUp?'Create a Content Connect X account':'Sign in to Content Connect X'}>
        <div className="flex items-center gap-4">
          <img src="/content_connect_logo.png" alt="Content Connect X" className="ccx-brand-mark h-16 w-16 shrink-0 rounded-2xl object-cover"/>
          <div><p className="ccx-eyebrow">Content Connect X</p><h2 className="mt-1 text-2xl font-bold">{signUp?'Join the network':'Welcome back'}</h2></div>
        </div>
        <p className="mt-5 text-sm leading-6 text-[#B7C3DD]">Start with free registration and independent age verification. Membership and premium actions are available only when their services are activated.</p>
        <form onSubmit={authenticate} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email address<input className={input+' mt-2'} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
          <label className="block text-sm font-medium">Password<input className={input+' mt-2'} type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete={signUp?'new-password':'current-password'}/></label>
          <button className={primary+' w-full'} disabled={busy}>{busy?'Working…':signUp?'Create free account':'Sign in securely'}</button>
        </form>
        <button className="mt-4 w-full text-sm font-medium text-[#FF87D8] underline underline-offset-4" onClick={()=>{setSignUp(!signUp);setError('');}}>{signUp?'Already have an account? Sign in':'New here? Create your free account'}</button>
        <div className="mt-5"><ErrorMessage message={error}/>{notice&&<p className="mt-3 text-sm text-emerald-300" role="status">{notice}</p>}</div>
        <p className="mt-5 text-center text-xs text-[#99A9C4]">Independent adult verification is required before accessing protected creator and location features.</p>
      </section>
    </div>
    <PublicLandingSections/>
  </div>;

  if(mfaNeeded)return <MfaChallenge onVerified={async()=>{
    const {data}=await supabase.auth.getSession();
    setSession(data.session);
    setMfaNeeded(false);
  }}/>;

  const loadReviews=async()=>{
    setBusy(true);setError('');
    try{const {data,error}=await supabase.functions.invoke('admin-age-review',{body:{action:'list'}});if(error||data?.error)throw new Error(data?.error||error.message);setReviews(data.requests||[]);}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const reviewAge=async(recordId,action)=>{
    if(action==='approve' && !window.confirm('I have reviewed both documents and confirmed this person is at least 18 years old. Approve?')) return;
    setBusy(true);setError('');
    try{const {data,error}=await supabase.functions.invoke('admin-age-review',{body:{request_id:recordId,action,age_confirmed:action==='approve'}});if(error||data?.error)throw new Error(data?.error||error.message);await loadReviews();setNotice('Review saved.');}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const openReviewDocument=async(recordId,document_type)=>{
    setBusy(true);setError('');
    try{const {data,error}=await supabase.functions.invoke('admin-age-review',{body:{request_id:recordId,action:'document',document_type}});if(error||data?.error||!data?.url)throw new Error(data?.error||error?.message||'Document unavailable');window.open(data.url,'_blank','noopener,noreferrer');}catch(e){setError(e.message);}finally{setBusy(false);}
  };

  /** @type {Array<[string, string, import('react').ElementType]>} */
  const menu=[['dashboard','Dashboard',UserRound],['profile','My Profile',UserRound],['verification','Free Age Verification',ShieldCheck],['directory','Explore',Search],['membership','Membership',CreditCard]];
  menu.push(['consent','My Consent & Rights',ShieldCheck]);
  menu.push(['account-security','Account Security',LockKeyhole]);
  if(approved) {
    menu.push(['safety','Safety',ShieldCheck]);
    if(visibleFeatures?.community_feed)menu.push(['community','Community',MessageSquare]);
    if(visibleFeatures?.product_feedback)menu.push(['feedback','Feedback',Lightbulb]);
    if(visibleFeatures?.media_gallery)menu.push(['media','Creator Media',Images]);
    if(paid && visibleFeatures?.availability) menu.push(['schedule','Availability',CalendarDays]);
    menu.push(['production','Production Manager',UsersRound]);
    if(visibleFeatures?.hosting_marketplace)menu.push(['hosting','Hosting Marketplace',Building2]);
    if(paid){
      if(visibleFeatures?.verified_reviews)menu.push(['reputation','Verified Reviews',Star]);
      if(visibleFeatures?.contracts)menu.push(['agreements','Agreements',FileSignature]);
    }
  }
  if(paid && approved) {
    menu.push(['workspace','Full Workspace',LockKeyhole]);
    menu.push(['trust','Trust & Readiness',ShieldCheck]);
  }
  if(isAdmin && approved) menu.push(['reviews','Age Reviews',ShieldCheck]);
  if(isAdmin && approved){
    menu.push(['controls','Feature Controls',Settings2]);
    menu.push(['integrations','Integrations',Settings2]);
  }
  return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <header className="ccx-shell-header sticky top-0 z-40 px-4 py-3" role="banner">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <button className="flex items-center gap-3 text-left" onClick={()=>{setTab('dashboard');setError('');}} aria-label="Go to the Content Connect X dashboard">
          <img src="/content_connect_logo.png" alt="" className="ccx-brand-mark h-11 w-11 rounded-xl object-cover"/>
          <span className="min-w-0"><span className="block text-lg font-bold tracking-tight text-white">Content Connect <span className="ccx-gradient-text">X</span></span><span className="block text-[10px] uppercase tracking-[.18em] text-[#BBAACD]">Creator & production network</span></span>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-[#7A447F]/50 bg-[#341C43]/60 px-3 py-1.5 text-xs text-[#E3B8E8] sm:inline-flex">{approved?'Verified adult member':'Verification required'}</span>
          <button className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/>Sign out</button>
        </div>
      </div>
    </header>
    <main id="main-content" className="mx-auto max-w-7xl px-4 pb-12 pt-5 md:px-6">
      <nav aria-label="Main workspace navigation" className="mb-6 flex flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide md:flex-wrap md:overflow-visible">
        {menu.map(([key,label,Icon])=>
          <button key={key} onClick={()=>{setTab(key);setError('');}} aria-current={tab===key?'page':undefined}
            className={'ccx-nav-pill inline-flex items-center gap-2 '+(tab===key?'is-active':'')}>
            <Icon size={16} aria-hidden="true"/>{label}
          </button>
        )}
      </nav>
      <ErrorMessage message={error}/>{notice&&<p role="status" className="my-3 text-green-400">{notice}</p>}{suspended?<div className="space-y-4"><div className={panel}><AlertTriangle className="text-red-400 mb-2"/>Account access is suspended. You can still review or withdraw your existing consent.</div><ConsentCenter user={user} canGrant={false}/><ProductionManager user={user} paid={false} isAdmin={false}/></div>:<>
    {tab==='dashboard'&&<DashboardHome profile={profile} verification={verification} approved={approved} paid={paid}
      features={visibleFeatures||{}} onNavigate={key=>{setTab(key);setError('');}}/>}
    {tab==='profile'&&<form key={profile?.updated_at||'new'} onSubmit={saveProfile} className={`${panel} space-y-4 max-w-2xl`}><h2 className="text-xl font-semibold">Your profile</h2><label className="block text-sm">Display name<input name="display_name" className={`${input} mt-1`} defaultValue={profile?.display_name||''} required/></label><label className="block text-sm">Creator type<select name="role_type" className={`${input} mt-1`} defaultValue={profile?.role_type||'creator'}>{['creator','photographer','videographer','video_editor','agent','studio'].map(r=><option value={r} key={r}>{r.replaceAll('_',' ')}</option>)}</select></label><label className="block text-sm">About you<textarea name="bio" className={`${input} mt-1`} rows={4} defaultValue={profile?.bio||''}/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm">City<input name="city" className={`${input} mt-1`} defaultValue={profile?.city||''}/></label><label className="block text-sm">Country<input name="country" className={`${input} mt-1`} defaultValue={profile?.country||''}/></label></div><button className={primary} disabled={busy}>Save profile</button></form>}
    {tab==='verification'&&<div className={`${panel} space-y-4 max-w-2xl`}><h2 className="text-xl font-semibold">Free age verification</h2><p className={muted}>Identity documents are stored privately for authorized review. Upload your ID and a selfie; this does not grant immediate verified status.</p>{approved?<div className="flex gap-2 text-green-400"><CheckCircle2/>Verified</div>:verification?.status==='pending'?<p className="text-amber-300">Your documents are under review. No payment is required.</p>:<><label className="block text-sm">Government ID<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={upload('id')} className="block mt-2 text-sm" disabled={busy}/></label><label className="block text-sm">Selfie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload('selfie')} className="block mt-2 text-sm" disabled={busy}/></label><button className={`${primary} inline-flex gap-2 items-center`} disabled={busy||!documents.id||!documents.selfie} onClick={submitVerification}><UploadCloud size={16}/> Submit for review</button></>}</div>}
    {tab==='verification'&&<div className="mt-5 max-w-2xl"><YotiVerification/></div>}
    {tab==='directory'&&<div className="space-y-4"><h2 className="text-xl font-semibold">Explore creators</h2>{!approved?<p className={panel}>Complete your free age verification to view the directory.</p>:<><div className="flex gap-2 max-w-xl"><input className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search display names"/><button className={primary} onClick={findCreators} disabled={queryRunning}>{queryRunning?'Searching…':'Search'}</button></div>{!paid&&<p className={muted}>Free preview: up to 12 creators. Subscribe to explore the full directory.</p>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{directory.map(p=><article key={p.id} className={panel}><h3 className="font-semibold">{p.display_name}</h3><p className="text-sm text-blue-400">{p.role_type.replaceAll('_',' ')}</p><p className={muted}>{[p.city,p.country].filter(Boolean).join(', ')}</p>{paid&&p.bio&&<p className="mt-2 text-sm">{p.bio}</p>}{paid&&<p className="mt-2 text-xs text-[#9AA6BC] break-all">Member ID: {p.id}</p>}</article>)}</div></>}</div>}
    {tab==='reviews'&&isAdmin&&approved&&<div className="space-y-4"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold">Age verification review queue</h2><button className={primary} onClick={loadReviews} disabled={busy}><RefreshCw size={16}/></button></div><p className={muted}>Only authorized administrators can open short-lived private document links or approve requests.</p>{reviews.map(request=><div key={request.id} className={`${panel} space-y-2`}><p className="text-sm">Request {request.id} · {request.status}</p><p className={muted}>{new Date(request.created_at).toLocaleString()}</p><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>openReviewDocument(request.id,'id')} disabled={busy}>View ID</button><button className={primary} onClick={()=>openReviewDocument(request.id,'selfie')} disabled={busy}>View selfie</button>{request.status==='pending'&&<><button className={primary} onClick={()=>reviewAge(request.id,'approve')} disabled={busy}>Approve</button><button className="rounded-lg bg-red-700 px-4 py-2.5 text-white disabled:opacity-50" onClick={()=>reviewAge(request.id,'reject')} disabled={busy}>Reject</button></>}</div></div>)}{reviews.length===0&&<p className={muted}>Select refresh to load recent review requests.</p>}</div>}
    {tab==='workspace' && paid && approved && <MemberWorkspace user={user} flags={visibleFeatures||{}}/> }
    {tab==='trust' && paid && approved && <TrustCenter isAdmin={isAdmin}/> }
    {tab==='consent' && <ConsentCenter user={user} canGrant={Boolean(paid && approved)}/> }
    {tab==='account-security' && <SecurityCenter/>}
    {tab==='safety' && approved && <SafetyPanel/>}
    {tab==='community' && approved && <CommunityHub paid={paid} userId={user.id}/>}
    {tab==='feedback' && approved && <FeedbackHub admin={isAdmin}/>}
    {tab==='media' && approved && <MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
    {tab==='schedule' && approved && paid && <ScheduleHub paid={paid} userId={user.id} creatorBookingEnabled={Boolean(visibleFeatures?.creator_booking)}/>}
    {tab==='production' && approved && <ProductionManager user={user} paid={paid} isAdmin={isAdmin}/>}
    {tab==='hosting' && approved && <React.Suspense fallback={<div className={panel}>Loading hosting marketplace…</div>}><HostingMarketplace user={user} paid={paid} isAdmin={isAdmin}/></React.Suspense>}
    {tab==='reputation' && approved && paid && <ReputationHub isAdmin={isAdmin}/>}
    {tab==='agreements' && approved && paid && <AgreementPackets/>}
    {tab==='controls' && approved && isAdmin && <AdminProductControls/>}
    {tab==='integrations' && approved && isAdmin && <IntegrationHealth/>}
    {tab==='membership'&&<div className={`${panel} max-w-2xl space-y-3`}><h2 className="text-xl font-semibold">Free today. Unlock more when ready.</h2><p className={muted}>Your free account includes age verification, profile setup and limited directory previews.</p><div className="p-4 rounded-lg bg-[#1A2438]"><LockKeyhole className="text-blue-400 mb-2"/>Full discovery, direct messages, contracts, collaboration rooms, property booking and advanced tools require membership.</div><p className="text-sm text-amber-200">Checkout will only become available after an approved adult-industry payment provider is configured. Payment is never collected by this website directly.</p><div className="flex flex-wrap gap-2"><p className={muted}>Paid checkout is paused until an adult-industry merchant processor approves this business model. No subscription charges are possible from this preview.</p></div></div>}
  </>}</main></div>;
}