/** Content Connect X — Supabase application, backed by protected Edge Functions. */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, requireSupabase } from '@/api/supabaseClient';
import { platformAction } from './platformApi';
import MemberWorkspace from './MemberWorkspace';
import NotificationCenter from './NotificationCenter';
import TrustCenter from './TrustCenter';
import ConsentCenter from './ConsentCenter';
import SafetyPanel from './SafetyPanel';
import ScheduleHub from './ScheduleHub';
import CommunityHub from './CommunityHub';
import ConnectGroups from './ConnectGroups';
import ConnectFeed from './ConnectFeed';
import FeedbackHub from './FeedbackHub';
import AdminConsole from './AdminConsole';
import MediaGallery from './MediaGallery';
import PassClearanceHub from './PassClearanceHub';
import {isModuleEnabled} from './featureModules.mjs';
import ProductionManager from './ProductionManager';
import ReputationHub from './ReputationHub';
import SecurityCenter from './SecurityCenter';
import MemberSettings from './MemberSettings';
import FeedPreferencesSettings from './FeedPreferencesSettings';
import RepresentationAgreements from './RepresentationAgreements';
import MfaChallenge from './MfaChallenge';
import {hasAdmission,needsOptedInMfa} from './accountEntryPolicy.mjs';
import AgreementPackets from './AgreementPackets';
import OriginalShell,{tabFromLegacyPath,legacyPathForTab} from './OriginalShell';
import OriginalRoleDashboard from './OriginalRoleDashboard';
import CreatorProfileEditor from './CreatorProfileEditor';
import MemberPublicProfile from './MemberPublicProfile';
import MeetingStudio from './MeetingStudio';
import CreatorDiscovery from './CreatorDiscovery';
import YotiVerification from './YotiVerification';
import PublicLandingSections from './PublicLandingSections';
import {useAuthAppearance} from './authAppearance';
import PublicPricing from './PublicPricing';
import AgeGateOnboarding from './AgeGateOnboarding';
const HostingMarketplace = React.lazy(() => import('./HostingMarketplace'));
import {   AlertTriangle, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';

const shell = 'ccx-app min-h-screen text-[var(--cc-text-primary)]';
const panel = 'ccx-surface p-5';
const input = 'w-full rounded-lg bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] px-3 py-2.5 text-[var(--cc-text-primary)] placeholder-[var(--cc-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500';
const primary = 'ccx-primary rounded-xl px-4 py-2.5 text-[var(--cc-text-primary)] font-semibold disabled:opacity-50';
const muted = 'text-[var(--cc-text-secondary)]';
function ErrorMessage({message}) { return message ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{message}</p> : null; }

export default function SupabaseApp() {
  const [session,setSession] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tab,setTab] = useState(()=>tabFromLegacyPath(window.location.pathname));
  const [mobileMenuOpen,setMobileMenuOpen] = useState(false);
  const [profile,setProfile] = useState(null);
  const [rolePreview,setRolePreview]=useState(null);
  const [verification,setVerification] = useState(null);
  const [billing,setBilling] = useState(null);
  const [security,setSecurity] = useState(null);
  const [fullName,setFullName] = useState('');
  const [displayName,setDisplayName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [signUp,setSignUp] = useState(window.location.pathname==='/signup');
  const [recovering,setRecovering] = useState(false);
  const [passwordRecoverySession,setPasswordRecoverySession] = useState(false);
  const [newPassword,setNewPassword] = useState('');
  const [confirmNewPassword,setConfirmNewPassword] = useState('');
  const [reviews,setReviews] = useState([]);
  const [mfaChecking,setMfaChecking] = useState(true);
  const [mfaNeeded,setMfaNeeded] = useState(false);
  const [mfaError,setMfaError] = useState('');
  const [mfaRetry,setMfaRetry] = useState(0);
  const [visibleFeatures,setVisibleFeatures] = useState(null);
  const [admission,setAdmission] = useState(null);
  const entryWasPending=React.useRef(false);
  const refreshGeneration=React.useRef(0);
  const [accountLoaded,setAccountLoaded] = useState(false);
  const refreshFeatureFlags=useCallback(async()=>{
    const result=await platformAction('get_feature_flags');
    setVisibleFeatures(result.flags||{});
  },[]);
  // Yoti redirects are treated only as navigation hints, never proof of verification.
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.has('age_verification')){
      setTab('verification');
      params.delete('age_verification');
      params.delete('sessionId');params.delete('sdkId');
      const remainder=params.toString();
      // Only a navigation hint: this does not grant age or identity verification.
      // The Yoti view will retrieve the real outcome from our protected backend.
      window.history.replaceState({
        ...(window.history.state||{}),
        ccxYotiReturned:true
      },'',window.location.pathname+(remainder?'?'+remainder:'')+window.location.hash);
    }
  },[]);
  const sessionRef=React.useRef(null);
  const user = session?.user;
  useAuthAppearance(user);
  const authPage = window.location.pathname==='/login'||window.location.pathname==='/signup';
  const pricingPage = /^\/pricing\/?$/i.test(window.location.pathname);
  const isAdmin = security?.admin === true;
  // Entry is completed once on the server. Admin continuity is an explicit
  // admission record, never a fabricated age-verification approval.
  const approved = hasAdmission(admission);
  const ageVerified=verification?.status==='approved'&&(!verification.expires_at||Date.parse(verification.expires_at)>Date.now());
  useEffect(()=>{
    if(!user?.id||!accountLoaded)return;
    if(!approved){
      entryWasPending.current=true;setTab('verification');
      if(window.location.pathname!=='/Verification')window.history.replaceState({},'', '/Verification');
      return;
    }
    if(entryWasPending.current||/^\/(login|signup)\/?$/i.test(window.location.pathname)){
      entryWasPending.current=false;
      window.history.replaceState({},'', '/Dashboard');setTab('dashboard');
    }
  },[user?.id,accountLoaded,approved]);
  const activePaid = (billing?.status === 'active' || billing?.status === 'trial') && (!billing?.period_end || new Date(billing.period_end) > new Date());
  const paid = activePaid || isAdmin;
  const suspended = security?.banned || security?.suspended;

  const refresh = useCallback(async (activeSession) => {
    const generation=++refreshGeneration.current;
    if (!activeSession?.user) {setProfile(null);setVerification(null);setAdmission(null);setBilling(null);setSecurity(null);setAccountLoaded(true);return;}
    const uid=activeSession.user.id;
    const [pr,ve,bi,se,entry] = await Promise.all([
      supabase.from('member_profiles').select('id,display_name,role_type,bio,city,state,country,avatar_path,cover_path,real_name,stage_name,company_name,representative_name,profile_complete,updated_at').eq('id',uid).maybeSingle(),
      supabase.from('age_verification_requests').select('id,status,created_at,verified_at,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
      supabase.from('member_subscriptions').select('status,plan_id,period_end').eq('user_id',uid).maybeSingle(),
      supabase.from('account_security').select('banned,suspended,admin').eq('user_id',uid).maybeSingle(),
      supabase.from('member_admissions').select('admitted_at,source').eq('user_id',uid).maybeSingle(),
    ]);
    if (pr.error || ve.error || bi.error || se.error) throw new Error(pr.error?.message || ve.error?.message || bi.error?.message || se.error?.message);
    if(entry.error)throw new Error('Unable to load account onboarding status: '+entry.error.message);
    if(generation!==refreshGeneration.current||sessionRef.current!==uid)return;
    setProfile(pr.data);setVerification(ve.data?.[0]||null);setBilling(bi.data);setSecurity(se.data);
    setAdmission(entry.data);setAccountLoaded(true);
  },[]);

  useEffect(()=>{
    if (!supabase) {setError('Supabase configuration missing');setLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(async ({data,error:sessionError})=>{
      if(!active) return;
      if(sessionError) throw sessionError;
      sessionRef.current=data.session?.user?.id||null;
      setSession(data.session);
      await refresh(data.session);
    }).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      // PASSWORD_RECOVERY is a navigational state, not an authorization grant.
      // Supabase validates the recovery token before establishing a session.
      if(active){
        if(event==='PASSWORD_RECOVERY')setPasswordRecoverySession(true);
        if(event==='SIGNED_OUT'){
          sessionRef.current=null;refreshGeneration.current++;entryWasPending.current=false;
          setPasswordRecoverySession(false);
          setSession(null);setProfile(null);setVerification(null);setAdmission(null);setBilling(null);setSecurity(null);
          setAccountLoaded(true);
        }else{
          // Supabase fires TOKEN_REFRESHED and INITIAL_SESSION events.
          // Clearing admin/verification on every event caused the age-gate
          // onboarding screen to flash on ordinary page navigation.
          if(next?.user?.id!==sessionRef.current){
            sessionRef.current=next?.user?.id||null;
            setAccountLoaded(false);setAdmission(null);setProfile(null);setVerification(null);setSecurity(null);setBilling(null);
          }
          setSession(next);
        }
      }
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
    let active=true;
    const load=()=>{void refreshFeatureFlags().catch(()=>{
      if(active)setVisibleFeatures({});
    });};
    load();
    window.addEventListener('focus',load);
    // Pick up platform rollouts for members already signed in.
    const interval=window.setInterval(load,60000);
    return()=>{active=false;window.removeEventListener('focus',load);window.clearInterval(interval);};
  },[approved,paid,refreshFeatureFlags]);

  useEffect(()=>{
    let alive=true;
    if(!session?.user){setMfaNeeded(false);setMfaChecking(false);setMfaError('');return;}
    setMfaChecking(true);setMfaError('');
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{
      if(!alive)return;
      if(error){setMfaError('Your saved sign-in protection could not be checked. Please retry.');}
      else setMfaNeeded(needsOptedInMfa(data));
    }).catch(()=>{if(alive)setMfaError('Your saved sign-in protection could not be checked. Please retry.');}).finally(()=>{if(alive)setMfaChecking(false);});
    return()=>{alive=false;};
  },[session?.access_token,mfaRetry]);

  useEffect(()=>{
    const onPopState=()=>{setTab(tabFromLegacyPath(window.location.pathname));setError('');};
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);

  useEffect(()=>{
    const update=()=>{if(session?.user)void refresh(session).catch(e=>setError(e.message));};
    window.addEventListener('ccx-verification-refreshed',update);
    window.addEventListener('ccx-platform-settings-changed',update);
    return()=>{window.removeEventListener('ccx-verification-refreshed',update);window.removeEventListener('ccx-platform-settings-changed',update);};
  },[session?.access_token,refresh]);

  const authenticate = async (event) => {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const client=requireSupabase();
      if(signUp&&(fullName.trim().length<2||displayName.trim().length<2))throw Error('Enter your name and public display name.');
      const {data,error:authError} = signUp
        ? await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin,
            data:{full_name:fullName.trim(),display_name:displayName.trim()}}})
        : await client.auth.signInWithPassword({email,password});
      if(authError) throw authError;
      if(signUp && !data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      else if(data.session){sessionRef.current=data.session.user.id;setSession(data.session);await refresh(data.session);}
    } catch(e){setError(e.message);}finally{setBusy(false);}
  };

  /** Supabase emails an expiring recovery link; no account existence is disclosed. */
  const requestRecovery=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      if(!email.trim())throw new Error('Enter your email address.');
      const {error:recoveryError}=await requireSupabase().auth.resetPasswordForEmail(email.trim(),{
        redirectTo:window.location.origin
      });
      if(recoveryError)throw recoveryError;
      setNotice('If an account exists for this address, a password recovery email has been sent.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  /** Only a provider-authenticated recovery session can update a password. */
  const updateRecoveredPassword=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      if(newPassword.length<12)throw new Error('Use a password of at least 12 characters.');
      if(newPassword!==confirmNewPassword)throw new Error('Passwords do not match.');
      const {error:updateError}=await requireSupabase().auth.updateUser({password:newPassword});
      if(updateError)throw updateError;
      setPasswordRecoverySession(false);setNewPassword('');setConfirmNewPassword('');
      await requireSupabase().auth.signOut();
      setNotice('Password updated. Sign in using your new password.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };

  if(user&&!accountLoaded&&error&&!loading)return <div className={shell+' grid min-h-screen place-items-center px-5'}>
    <section role="alert" className={panel+' max-w-md space-y-4 text-center'}>
      <h2 className="text-xl font-bold">Unable to load your account permissions</h2>
      <p className="text-sm text-[var(--cc-text-secondary)]">{error}</p>
      <p className="text-xs text-[var(--cc-text-secondary)]">No verification status has been changed. Retry once to load your current account.</p>
      <button className={primary} onClick={()=>{setError('');void refresh(session).catch(e=>setError(e.message));}}>Retry account check</button>
    </section>
  </div>;
  if(loading||mfaChecking||(user&&!accountLoaded))return <div className={`${shell} grid place-items-center`}><Loader2 className="animate-spin"/></div>;
  if(!user&&pricingPage)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <header className="ccx-public-auth-links px-4 py-3 sm:px-6" aria-label="Account links">
      <nav className="mx-auto flex max-w-7xl flex-wrap justify-center gap-2">
        <a href="/login" className="ccx-secondary rounded-lg px-3 py-2 text-sm">Log in</a>
        <a href="/signup" className="ccx-primary rounded-lg px-3 py-2 text-sm">Sign up</a>
        <a href="/pricing" aria-current="page" className="ccx-secondary rounded-lg border-[var(--cc-border)] px-3 py-2 text-sm">Pricing</a>
      </nav>
    </header>
    <PublicPricing/>
  </div>;
  if(!user&&!authPage)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <header className="ccx-public-auth-links px-4 py-3 sm:px-6" aria-label="Account links">
      <nav className="ccx-public-nav" aria-label="Public navigation">
        <a href="/login" className="ccx-public-nav-button ccx-secondary">Log in</a>
        <a href="/signup" className="ccx-public-nav-button ccx-primary">Sign up</a>
        <a href="/pricing" className="ccx-public-nav-button ccx-secondary">Pricing</a>
        <a href="/hostconnect" className="ccx-public-nav-button ccx-host-connect-header">Host Connect</a>
      </nav>
    </header>
    <main id="main-content">
    <h1 className="sr-only">Content Connect X — Create. Collaborate. Connect.</h1>
    <section className="ccx-hero-image relative w-full overflow-hidden">
      <picture>
        <source media="(max-width: 640px)" srcSet="/ContentConnectX__Create,_Collaborate,_Grow.png"/>
        <img src="/content_conect_hero.png" alt="Content Connect X — Create. Collaborate. Connect." className="block h-auto w-full object-cover"/>
      </picture>
      <div className="ccx-public-hero-actions pointer-events-none absolute inset-x-0 z-10 flex justify-center px-5">
        <a href="/signup" className="ccx-primary pointer-events-auto inline-flex items-center rounded-full px-7 py-3 text-sm">Create your profile <span aria-hidden="true" className="ml-2 text-lg leading-none">→</span></a>
      </div>
    </section>
    <PublicLandingSections/>
    </main>
  </div>;
  if(!user&&authPage)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <div className="relative flex min-h-[calc(100vh-4px)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <section className="ccx-login-art absolute inset-0 rounded-none border-0" aria-hidden="true"/>
      <section id="ccx-auth" className="ccx-surface relative z-10 w-full max-w-xl scroll-mt-24 bg-[var(--cc-surface-subtle)] p-6 backdrop-blur-xl sm:p-8" aria-label={signUp?'Create a Content Connect X account':'Sign in to Content Connect X'}>
        <div className="flex items-center gap-4">
          <img src="/content_connect_logo.png" alt="Content Connect X" className="ccx-brand-mark h-16 w-16 shrink-0 rounded-2xl object-cover"/>
          <div><p className="ccx-eyebrow">Content Connect X</p><h2 className="mt-1 text-2xl font-bold">{signUp?'Join the network':'Welcome back'}</h2></div>
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--cc-text-secondary)]">Start with free registration and independent age verification. Membership and premium actions are available only when their services are activated.</p>
        {signUp&&<div className="mt-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-xs leading-5 text-[var(--cc-text-secondary)]">
          Content Connect X and Host Connect are professional content-production marketplaces. No escorting, paid sexual services, coercion, trafficking or non-consensual content. Before meeting anyone, check their credentials and arrange safety measures. Verification is not a guarantee of behavior.
          <span className="mt-2 block"><a href="/trust/terms" className="font-semibold underline">Read the draft terms</a> · <a href="/trust/anti-trafficking" className="font-semibold underline">Safety policy</a> · <a href="/trust/content-removal" className="font-semibold underline">Report a concern</a></span>
        </div>}
        {recovering?
          <form onSubmit={requestRecovery} className="mt-6 space-y-4">
            <p className="text-sm text-[var(--cc-text-secondary)]">Enter your account email. We will send a recovery link if the address is registered.</p>
            <label className="block text-sm font-medium">Email address
              <input className={input+' mt-2'} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </label>
            <button className={primary+' w-full'} disabled={busy}>{busy?'Sending…':'Email recovery link'}</button>
            <button type="button" className="w-full text-sm font-medium text-[var(--cc-link)] underline underline-offset-4"
              onClick={()=>{setRecovering(false);setNotice('');setError('');}}>Back to sign in</button>
          </form>
        :<>
          <form onSubmit={authenticate} className="mt-6 space-y-4">
            {signUp&&<>
              <label className="block text-sm font-medium">Full name
                <input className={input+' mt-2'} autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} maxLength={120}/>
              </label>
              <label className="block text-sm font-medium">Public display name
                <input className={input+' mt-2'} autoComplete="nickname" value={displayName} onChange={e=>setDisplayName(e.target.value)} required minLength={2} maxLength={80}/>
                <span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Choose the professional name people will see on your profile.</span>
              </label>
            </>}

            <label className="block text-sm font-medium">Email address
              <input className={input+' mt-2'} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </label>
            <label className="block text-sm font-medium">Password
              <span className="relative mt-2 block">
                <input className={input+' pr-12'} type={showPassword?'text':'password'} autoCapitalize="none" spellCheck={false} value={password} onChange={e=>setPassword(e.target.value)}
                  minLength={signUp?12:1} required autoComplete={signUp?'new-password':'current-password'}/>
                <button type="button" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--cc-text-secondary)]" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>
                  {showPassword?<EyeOff size={19}/>:<Eye size={19}/>} 
                </button>
              </span>
            </label>
            <button className={primary+' w-full'} disabled={busy}>{busy?'Working…':signUp?'Create free account':'Sign in securely'}</button>
          </form>
          <button className="mt-4 w-full text-sm font-medium text-[var(--cc-link)] underline underline-offset-4"
            onClick={()=>{setSignUp(!signUp);setError('');setNotice('');}}>
            {signUp?'Already have an account? Sign in':'New here? Create your free account'}
          </button>
          {!signUp&&<button type="button" className="mt-2 w-full text-sm text-[var(--cc-text-secondary)] underline underline-offset-4"
            onClick={()=>{setRecovering(true);setError('');setNotice('');}}>
            Forgot password?
          </button>}
        </>}
        <div className="mt-5"><ErrorMessage message={error}/>{notice&&<p className="mt-3 text-sm text-emerald-800" role="status">{notice}</p>}</div>
        <p className="mt-5 text-center text-xs text-[var(--cc-text-secondary)]">Next: verify your government ID and live selfie with Yoti. New accounts must complete this step before entering the site.</p>
        <a href="/" className="mt-4 block text-center text-sm text-[var(--cc-link)] underline underline-offset-4">Back to home page</a>
        <a href="/pricing" className="mt-2 block text-center text-sm text-[var(--cc-text-secondary)] underline underline-offset-4">View membership pricing</a>
      </section>
    </div>
  </div>;

  if(passwordRecoverySession)return <div className={shell+' grid min-h-screen place-items-center px-4'}>
    <form onSubmit={updateRecoveredPassword} className={panel+' w-full max-w-lg space-y-4'}>
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <p className="text-sm text-[var(--cc-text-secondary)]">Your recovery link has been verified. Create a new password to protect your account.</p>
      <label className="block text-sm">New password (12+ characters)
        <input className={input+' mt-2'} type="password" autoCapitalize="none" spellCheck={false} autoComplete="new-password" required minLength={12}
          value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
      </label>
      <label className="block text-sm">Confirm new password
        <input className={input+' mt-2'} type="password" autoCapitalize="none" spellCheck={false} autoComplete="new-password" required minLength={12}
          value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)}/>
      </label>
      <button className={primary+' w-full'} disabled={busy}>{busy?'Updating…':'Update password securely'}</button>
      <ErrorMessage message={error}/>
      <button type="button" className="text-sm text-[var(--cc-text-secondary)] underline"
        onClick={()=>supabase.auth.signOut()}>Cancel and sign out</button>
    </form>
  </div>;

  if(mfaError)return <div className={shell+' grid min-h-screen place-items-center px-5'}>
    <section role="alert" className={panel+' max-w-md space-y-4 text-center'}>
      <h2 className="text-xl font-bold">Sign-in check unavailable</h2><p>{mfaError}</p>
      <p className="text-sm text-[var(--cc-text-secondary)]">No two-factor setup is required. This check only honors protection you already chose for your account.</p>
      <button className={primary} onClick={()=>setMfaRetry(v=>v+1)}>Retry sign-in check</button>
      <button className="block w-full text-sm underline" onClick={()=>supabase.auth.signOut()}>Sign out</button>
    </section>
  </div>;
  if(mfaNeeded)return <MfaChallenge onVerified={async()=>{
    const {data}=await supabase.auth.getSession();
    setSession(data.session);
    setMfaNeeded(false);
  }}/>;
  // The authenticated creator application is never mounted before independent
  // 18+ approval. URL navigation, Escape, refresh and backdrop clicks cannot
  // dismiss this required onboarding. Log out is the only exit.
  if(user&&!approved)return <AgeGateOnboarding
    onReload={()=>refresh(session)}
    onSignOut={async()=>{
      const {error:signoutError}=await supabase.auth.signOut();
      if(signoutError)throw signoutError;
      window.history.replaceState({},'', '/');
    }}/>;


  const loadReviews=async()=>{
    setBusy(true);setError('');
    try{const {data,error}=await supabase.functions.invoke('admin-age-review',{body:{action:'list'}});if(error||data?.error)throw new Error(data?.error||error.message);setReviews(data.requests||[]);}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const openReviewDocument=async(recordId,document_type)=>{
    setBusy(true);setError('');
    try{const {data,error}=await supabase.functions.invoke('admin-age-review',{body:{request_id:recordId,action:'document',document_type}});if(error||data?.error||!data?.url)throw new Error(data?.error||error?.message||'Document unavailable');window.open(data.url,'_blank','noopener,noreferrer');}catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const navigateInWorkspace=(destination,memberContext=null)=>{
    if(destination==='invitations')destination='notifications';
    setTab(destination);setError('');setNotice('');
    const target=destination==='meeting'&&memberContext?.scope&&memberContext?.scopeId
      ?'/Meeting?'+new URLSearchParams({scope:memberContext.scope,room:memberContext.scopeId}).toString()
      :legacyPathForTab(destination);
    if(window.location.pathname+window.location.search!==target)
      window.history.pushState({ccxTab:destination,memberContext},'',target);
  };
  const signOut=()=>{
    // Signed-out users always return to the unchanged public homepage.
    void supabase.auth.signOut().then(({error:signoutError})=>{
      if(signoutError){setError(signoutError.message);return;}
      window.history.replaceState({...window.history.state},'', '/');
      setTab('dashboard');
    }).catch(e=>setError(e.message||'Unable to sign out.'));
  };
  return <OriginalShell user={user} profile={profile} approved={approved}
    isAdmin={isAdmin} tab={tab} featureFlags={visibleFeatures} isPremiumMember={activePaid}
    onNavigate={navigateInWorkspace} onSignOut={signOut}
    onRolePreviewChange={setRolePreview}>
    <ErrorMessage message={error}/>
    {notice&&<p role="status" className="my-3 text-green-800">{notice}</p>}
    {suspended?<div className="space-y-4">
      <div className={panel}><AlertTriangle className="mb-2 text-red-800"/>
      Account access is suspended. You can still review or withdraw your existing consent.</div>
      <ConsentCenter user={user} canGrant={false}/>
      <ProductionManager user={user} paid={false} isAdmin={false}/>
    </div>:approved&&!isModuleEnabled(tab,visibleFeatures)?<section className={panel+' space-y-3'}>
      <h2 className="text-xl font-semibold">This module is currently turned off</h2>
      <p className="text-sm text-[var(--cc-text-secondary)]">Your existing records remain stored. An administrator can enable this feature from Platform Controls.</p>
      <button className={primary} onClick={()=>navigateInWorkspace('dashboard')}>Return to dashboard</button>
    </section>:<>
    {tab==='dashboard'&&<OriginalRoleDashboard profile={profile} verified={ageVerified}
      paid={paid} onNavigate={navigateInWorkspace}
      roleOverride={isAdmin?rolePreview:null} features={visibleFeatures}/>}
    {tab==='profile'&&<><CreatorProfileEditor user={user} profile={profile} approved={ageVerified}
      paid={paid} isAdmin={isAdmin} onNavigate={navigateInWorkspace}
      onSaved={()=>refresh(session)}/>
      <section className="mx-auto mt-6 max-w-4xl space-y-3 px-3" aria-label="Your profile posts">
       <h2 className="text-xl font-bold">Your profile posts</h2>
       <p className="text-sm text-[var(--cc-text-secondary)]">Only approved posts visible to each viewer appear on your timeline. Create new posts from Connect Feed on your dashboard.</p>
       <ConnectFeed key={user.id} userId={user.id} profileId={user.id}/>
      </section>
    </>}
    {tab==='public-profile'&&approved&&<MemberPublicProfile onNavigate={navigateInWorkspace}/>}
    {tab==='verification'&&<div className="mx-auto max-w-md"><YotiVerification onApproval={()=>refresh(session)}/></div>}
    {['directory','favorites'].includes(tab)&&
      <CreatorDiscovery key={tab} user={user} approved={approved} paid={paid}
       mode={tab==='directory'?'discovery':tab} onNavigate={navigateInWorkspace}/>}
    {tab==='reviews'&&isAdmin&&approved&&<div className="space-y-4"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold">Age verification records</h2><button className={primary} onClick={loadReviews} disabled={busy}><RefreshCw size={16}/></button></div><p className={muted}>Historical verification records are read-only. New members verify through Yoti; manual approval is no longer available.</p>{reviews.map(request=><div key={request.id} className={`${panel} space-y-2`}><p className="text-sm">Request {request.id} · {request.status}</p><p className={muted}>{new Date(request.created_at).toLocaleString()}</p><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>openReviewDocument(request.id,'id')} disabled={busy}>View ID</button><button className={primary} onClick={()=>openReviewDocument(request.id,'selfie')} disabled={busy}>View selfie</button></div></div>)}{reviews.length===0&&<p className={muted}>Select refresh to load recent review requests.</p>}</div>}
    {['workspace','messages','connections','collaborations','contracts'].includes(tab)&&(
      !approved?<div className={panel}>Complete account onboarding to enter your workspace.</div>:
      !paid&&!['messages','connections','notifications'].includes(tab)?<div className={panel+' space-y-3'}>
        <h2 className="text-xl font-semibold">Premium member workspace</h2>
        <p className="text-sm text-[var(--cc-text-secondary)]">This workflow requires an active paid membership.
          Existing creator records are preserved and remain protected.</p>
        <button className={primary} onClick={()=>navigateInWorkspace('membership')}>Membership details</button>
      </div>:
      <MemberWorkspace key={tab} user={user} paid={paid} flags={visibleFeatures||{}} onNavigate={navigateInWorkspace}
       initialSection={['messages','connections','collaborations','contracts','notifications'].includes(tab)?tab:'collaborations'}/>
    )}
    {tab==='notifications'&&approved&&<NotificationCenter user={user} onNavigate={navigateInWorkspace}/>}
    {tab==='meeting'&&approved&&<MeetingStudio
     scope={new URLSearchParams(window.location.search).get('scope')||window.history.state?.memberContext?.scope}
     scopeId={new URLSearchParams(window.location.search).get('room')||window.history.state?.memberContext?.scopeId}
     userId={user.id} onNavigate={navigateInWorkspace}/>}
    {tab==='trust' && paid && approved && <TrustCenter isAdmin={isAdmin}/> }
    {tab==='consent' && <ConsentCenter user={user} canGrant={Boolean(paid && approved)}/> }
    {tab==='account-security' && <SecurityCenter/>}
    {tab==='safety' && approved && <SafetyPanel/>}
    {tab==='community' && approved && <CommunityHub paid={paid} userId={user.id}/>}
    {tab==='groups' && approved && <ConnectGroups userId={user.id} paid={paid} isAdmin={isAdmin} onNavigate={navigateInWorkspace}/>}
    {tab==='feedback' && approved && <FeedbackHub admin={isAdmin}/>}
    {tab==='media' && approved && <MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
    {tab==='schedule' && approved && paid && <ScheduleHub paid={paid} userId={user.id} creatorBookingEnabled={Boolean(visibleFeatures?.creator_booking)}/>}
    {tab==='production' && approved && <ProductionManager user={user} paid={paid} isAdmin={isAdmin}/>}
    {['hosting','host','host-settings'].includes(tab)&&(
       !approved?<div className={panel}>Complete account onboarding to enter the marketplace.</div>:
       <div className="host-connect-theme">
       <React.Suspense fallback={<div className={panel}>Loading hosting marketplace…</div>}>
        <HostingMarketplace key={tab} user={user} paid={paid} isAdmin={isAdmin}
         initialSection={tab==='host'?(paid?'host':'explore'):
          tab==='host-settings'?'alerts':'explore'}/>
       </React.Suspense>
       </div>)}
    {tab==='portfolio'&&approved&&<MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
    {tab==='testing'&&approved&&<PassClearanceHub isAdmin={isAdmin}/>}
    {tab==='settings'&&(isAdmin&&!rolePreview?<div className="space-y-5">
        <FeedPreferencesSettings userId={user.id}/>
        <AdminConsole key={tab} initialSection="features"
         onFeatureChange={()=>refreshFeatureFlags().catch(()=>setVisibleFeatures({}))}/>
       </div>:<MemberSettings user={user} onNavigate={navigateInWorkspace}/>)}
    {tab==='roster'&&approved&&<ProductionManager user={user} paid={paid} isAdmin={isAdmin}/>}
    {tab==='representations'&&<RepresentationAgreements role={profile?.role_type||'creator'}/>}
    {tab==='developer'&&isAdmin&&<div className={panel}>
      The original developer documentation is preserved in the repository’s
      pre-migration reference branch.</div>}
    {tab==='reputation' && approved && paid && <ReputationHub isAdmin={isAdmin}/>}
    {tab==='agreements' && approved && paid && <AgreementPackets/>}
    {['controls','integrations','testing-reviews'].includes(tab) && approved && isAdmin &&
      <AdminConsole key={tab} initialSection={tab==='integrations'?'integrations':tab==='testing-reviews'?'testing':'features'}
       onFeatureChange={()=>refreshFeatureFlags().catch(()=>setVisibleFeatures({}))}/>}
    {tab==='membership'&&<PublicPricing signedIn onNavigate={navigateInWorkspace} initialRole={profile?.role_type||'creator'}/>}

  </>}</OriginalShell>;
}