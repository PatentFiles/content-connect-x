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
import OriginalShell,{tabFromLegacyPath,legacyPathForTab} from './OriginalShell';
import OriginalRoleDashboard from './OriginalRoleDashboard';
import CreatorProfileEditor from './CreatorProfileEditor';
import CreatorDiscovery from './CreatorDiscovery';
import YotiVerification from './YotiVerification';
import PublicLandingSections from './PublicLandingSections';
const HostingMarketplace = React.lazy(() => import('./HostingMarketplace'));
import { LockKeyhole, UploadCloud, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

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
  const [tab,setTab] = useState(()=>tabFromLegacyPath(window.location.pathname));
  const [mobileMenuOpen,setMobileMenuOpen] = useState(false);
  const [profile,setProfile] = useState(null);
  const [rolePreview,setRolePreview]=useState(null);
  const [verification,setVerification] = useState(null);
  const [billing,setBilling] = useState(null);
  const [security,setSecurity] = useState(null);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [signUp,setSignUp] = useState(window.location.pathname==='/signup');
  const [recovering,setRecovering] = useState(false);
  const [passwordRecoverySession,setPasswordRecoverySession] = useState(false);
  const [newPassword,setNewPassword] = useState('');
  const [confirmNewPassword,setConfirmNewPassword] = useState('');
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
      // Only a navigation hint: this does not grant age or identity verification.
      // The Yoti view will retrieve the real outcome from our protected backend.
      window.history.replaceState({
        ...(window.history.state||{}),
        ccxYotiReturned:true
      },'',window.location.pathname+(remainder?'?'+remainder:'')+window.location.hash);
    }
  },[]);
  const user = session?.user;
  const authPage = window.location.pathname==='/login'||window.location.pathname==='/signup';
  const approved = verification?.status === 'approved' && (!verification.expires_at || new Date(verification.expires_at) > new Date());
  const activePaid = (billing?.status === 'active' || billing?.status === 'trial') && (!billing?.period_end || new Date(billing.period_end) > new Date());
  const isAdmin = security?.admin === true;
  const paid = activePaid || isAdmin;
  const suspended = security?.banned || security?.suspended;

  const refresh = useCallback(async (activeSession) => {
    if (!activeSession?.user) {setProfile(null);setVerification(null);setBilling(null);setSecurity(null);return;}
    const uid=activeSession.user.id;
    const [pr,ve,bi,se] = await Promise.all([
      supabase.from('member_profiles').select('id,display_name,role_type,bio,city,state,country,avatar_path,profile_complete,updated_at').eq('id',uid).maybeSingle(),
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
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      // PASSWORD_RECOVERY is a navigational state, not an authorization grant.
      // Supabase validates the recovery token before establishing a session.
      if(active){
        if(event==='PASSWORD_RECOVERY')setPasswordRecoverySession(true);
        if(event==='SIGNED_OUT')setPasswordRecoverySession(false);
        setSession(next);setProfile(null);setVerification(null);setBilling(null);setSecurity(null);
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

  if(loading||mfaChecking)return <div className={`${shell} grid place-items-center`}><Loader2 className="animate-spin"/></div>;
  if(!user&&!authPage)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <header className="ccx-public-auth-links px-4 py-3 sm:px-6" aria-label="Account links">
      <div className="mx-auto flex max-w-7xl justify-end gap-2">
        <a href="/login" className="ccx-secondary rounded-lg px-3 py-2 text-sm">Log in</a>
        <a href="/signup" className="ccx-primary rounded-lg px-3 py-2 text-sm">Sign up</a>
      </div>
    </header>
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
  </div>;
  if(!user&&authPage)return <div className={shell}>
    <div className="ccx-brand-topline"/>
    <div className="relative flex min-h-[calc(100vh-4px)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <section className="ccx-login-art absolute inset-0 rounded-none border-0" aria-hidden="true"/>
      <section id="ccx-auth" className="ccx-surface relative z-10 w-full max-w-xl scroll-mt-24 bg-[#11182b]/90 p-6 backdrop-blur-xl sm:p-8" aria-label={signUp?'Create a Content Connect X account':'Sign in to Content Connect X'}>
        <div className="flex items-center gap-4">
          <img src="/content_connect_logo.png" alt="Content Connect X" className="ccx-brand-mark h-16 w-16 shrink-0 rounded-2xl object-cover"/>
          <div><p className="ccx-eyebrow">Content Connect X</p><h2 className="mt-1 text-2xl font-bold">{signUp?'Join the network':'Welcome back'}</h2></div>
        </div>
        <p className="mt-5 text-sm leading-6 text-[#B7C3DD]">Start with free registration and independent age verification. Membership and premium actions are available only when their services are activated.</p>
        {recovering?
          <form onSubmit={requestRecovery} className="mt-6 space-y-4">
            <p className="text-sm text-[#B7C3DD]">Enter your account email. We will send a recovery link if the address is registered.</p>
            <label className="block text-sm font-medium">Email address
              <input className={input+' mt-2'} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </label>
            <button className={primary+' w-full'} disabled={busy}>{busy?'Sending…':'Email recovery link'}</button>
            <button type="button" className="w-full text-sm font-medium text-[#FF87D8] underline underline-offset-4"
              onClick={()=>{setRecovering(false);setNotice('');setError('');}}>Back to sign in</button>
          </form>
        :<>
          <form onSubmit={authenticate} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">Email address
              <input className={input+' mt-2'} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
            </label>
            <label className="block text-sm font-medium">Password
              <input className={input+' mt-2'} type="password" value={password} onChange={e=>setPassword(e.target.value)}
                minLength={8} required autoComplete={signUp?'new-password':'current-password'}/>
            </label>
            <button className={primary+' w-full'} disabled={busy}>{busy?'Working…':signUp?'Create free account':'Sign in securely'}</button>
          </form>
          <button className="mt-4 w-full text-sm font-medium text-[#FF87D8] underline underline-offset-4"
            onClick={()=>{setSignUp(!signUp);setError('');setNotice('');}}>
            {signUp?'Already have an account? Sign in':'New here? Create your free account'}
          </button>
          {!signUp&&<button type="button" className="mt-2 w-full text-sm text-[#B7C3DD] underline underline-offset-4"
            onClick={()=>{setRecovering(true);setError('');setNotice('');}}>
            Forgot password?
          </button>}
        </>}
        <div className="mt-5"><ErrorMessage message={error}/>{notice&&<p className="mt-3 text-sm text-emerald-300" role="status">{notice}</p>}</div>
        <p className="mt-5 text-center text-xs text-[#99A9C4]">Independent adult verification is required before accessing protected creator and location features.</p>
        <a href="/" className="mt-4 block text-center text-sm text-[#FF87D8] underline underline-offset-4">Back to home page</a>
      </section>
    </div>
  </div>;

  if(passwordRecoverySession)return <div className={shell+' grid min-h-screen place-items-center px-4'}>
    <form onSubmit={updateRecoveredPassword} className={panel+' w-full max-w-lg space-y-4'}>
      <h1 className="text-2xl font-bold">Set a new password</h1>
      <p className="text-sm text-[#B7C3DD]">Your recovery link has been verified. Create a new password to protect your account.</p>
      <label className="block text-sm">New password (12+ characters)
        <input className={input+' mt-2'} type="password" autoComplete="new-password" required minLength={12}
          value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
      </label>
      <label className="block text-sm">Confirm new password
        <input className={input+' mt-2'} type="password" autoComplete="new-password" required minLength={12}
          value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)}/>
      </label>
      <button className={primary+' w-full'} disabled={busy}>{busy?'Updating…':'Update password securely'}</button>
      <ErrorMessage message={error}/>
      <button type="button" className="text-sm text-[#B7C3DD] underline"
        onClick={()=>supabase.auth.signOut()}>Cancel and sign out</button>
    </form>
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

  useEffect(()=>{
    const onPopState=()=>{setTab(tabFromLegacyPath(window.location.pathname));setError('');};
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);
  const navigateInWorkspace=(destination)=>{
    setTab(destination);setError('');setNotice('');
    const target=legacyPathForTab(destination);
    if(window.location.pathname!==target)
      window.history.pushState({ccxTab:destination},'',target);
  };
  const signOut=()=>{void supabase.auth.signOut();};
  return <OriginalShell user={user} profile={profile} approved={approved}
    isAdmin={isAdmin} tab={tab}
    onNavigate={navigateInWorkspace} onSignOut={signOut}
    onRolePreviewChange={setRolePreview}>
    <ErrorMessage message={error}/>
    {notice&&<p role="status" className="my-3 text-green-400">{notice}</p>}
    {suspended?<div className="space-y-4">
      <div className={panel}><AlertTriangle className="mb-2 text-red-400"/>
      Account access is suspended. You can still review or withdraw your existing consent.</div>
      <ConsentCenter user={user} canGrant={false}/>
      <ProductionManager user={user} paid={false} isAdmin={false}/>
    </div>:<>
    {tab==='dashboard'&&<OriginalRoleDashboard profile={profile} verified={approved}
      paid={paid} onNavigate={navigateInWorkspace}
      roleOverride={isAdmin?rolePreview:null}/>}
    {tab==='profile'&&<CreatorProfileEditor user={user} profile={profile} approved={approved}
      paid={paid} isAdmin={isAdmin} onNavigate={navigateInWorkspace}
      onSaved={()=>refresh(session)}/>}
    {tab==='verification'&&<div className={`${panel} space-y-4 max-w-2xl`}><h2 className="text-xl font-semibold">Free age verification</h2><p className={muted}>Identity documents are stored privately for authorized review. Upload your ID and a selfie; this does not grant immediate verified status.</p>{approved?<div className="flex gap-2 text-green-400"><CheckCircle2/>Verified</div>:verification?.status==='pending'?<p className="text-amber-300">Your documents are under review. No payment is required.</p>:<><label className="block text-sm">Government ID<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={upload('id')} className="block mt-2 text-sm" disabled={busy}/></label><label className="block text-sm">Selfie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload('selfie')} className="block mt-2 text-sm" disabled={busy}/></label><button className={`${primary} inline-flex gap-2 items-center`} disabled={busy||!documents.id||!documents.selfie} onClick={submitVerification}><UploadCloud size={16}/> Submit for review</button></>}</div>}
    {tab==='verification'&&<div className="mt-5 max-w-2xl"><YotiVerification/></div>}
    {['directory','search','favorites'].includes(tab)&&
      <CreatorDiscovery key={tab} user={user} approved={approved} paid={paid}
       mode={tab==='directory'?'discovery':tab}/>}
    {tab==='reviews'&&isAdmin&&approved&&<div className="space-y-4"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold">Age verification review queue</h2><button className={primary} onClick={loadReviews} disabled={busy}><RefreshCw size={16}/></button></div><p className={muted}>Only authorized administrators can open short-lived private document links or approve requests.</p>{reviews.map(request=><div key={request.id} className={`${panel} space-y-2`}><p className="text-sm">Request {request.id} · {request.status}</p><p className={muted}>{new Date(request.created_at).toLocaleString()}</p><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>openReviewDocument(request.id,'id')} disabled={busy}>View ID</button><button className={primary} onClick={()=>openReviewDocument(request.id,'selfie')} disabled={busy}>View selfie</button>{request.status==='pending'&&<><button className={primary} onClick={()=>reviewAge(request.id,'approve')} disabled={busy}>Approve</button><button className="rounded-lg bg-red-700 px-4 py-2.5 text-white disabled:opacity-50" onClick={()=>reviewAge(request.id,'reject')} disabled={busy}>Reject</button></>}</div></div>)}{reviews.length===0&&<p className={muted}>Select refresh to load recent review requests.</p>}</div>}
    {['workspace','messages','connections','collaborations','contracts','notifications'].includes(tab)&&(
      !approved?<div className={panel}>Independent age verification is required to access this workspace.</div>:
      !paid?<div className={panel+' space-y-3'}>
        <h2 className="text-xl font-semibold">Premium member workspace</h2>
        <p className="text-sm text-[#AABBD4]">This workflow requires an active paid membership.
          Existing creator records are preserved and remain protected.</p>
        <button className={primary} onClick={()=>navigateInWorkspace('membership')}>Membership details</button>
      </div>:
      <MemberWorkspace key={tab} user={user} flags={visibleFeatures||{}}
       initialSection={['messages','connections','collaborations','contracts','notifications'].includes(tab)?tab:'collaborations'}/>
    )}
    {tab==='trust' && paid && approved && <TrustCenter isAdmin={isAdmin}/> }
    {tab==='consent' && <ConsentCenter user={user} canGrant={Boolean(paid && approved)}/> }
    {tab==='account-security' && <SecurityCenter/>}
    {tab==='safety' && approved && <SafetyPanel/>}
    {tab==='community' && approved && <CommunityHub paid={paid} userId={user.id}/>}
    {tab==='feedback' && approved && <FeedbackHub admin={isAdmin}/>}
    {tab==='media' && approved && <MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
    {tab==='schedule' && approved && paid && <ScheduleHub paid={paid} userId={user.id} creatorBookingEnabled={Boolean(visibleFeatures?.creator_booking)}/>}
    {tab==='production' && approved && <ProductionManager user={user} paid={paid} isAdmin={isAdmin}/>}
    {['hosting','host','host-settings'].includes(tab)&&(
       !approved?<div className={panel}>Independent age verification is required to browse filming spaces.</div>:
       <React.Suspense fallback={<div className={panel}>Loading hosting marketplace…</div>}>
        <HostingMarketplace key={tab} user={user} paid={paid} isAdmin={isAdmin}
         initialSection={tab==='host'?(paid?'host':'explore'):
          tab==='host-settings'?'alerts':'explore'}/>
       </React.Suspense>)}
    {tab==='portfolio'&&approved&&<MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
    {tab==='testing'&&approved&&<TrustCenter isAdmin={isAdmin}/>}
    {tab==='settings'&&<SecurityCenter/>}
    {tab==='roster'&&approved&&<ProductionManager user={user} paid={paid} isAdmin={isAdmin}/>}
    {tab==='representations'&&<div className={panel+' space-y-2'}>
      <h2 className="text-xl font-semibold">Representations</h2>
      <p className="text-sm text-[#AABBD4]">The original agent and studio representation
       manager is not yet connected to the Supabase representation records.
       Existing production team and collaboration workflows remain accessible.</p>
      <button className={primary} onClick={()=>navigateInWorkspace('production')}>Production teams</button>
    </div>}
    {tab==='developer'&&isAdmin&&<div className={panel}>
      The original developer documentation is preserved in the repository’s
      pre-migration reference branch.</div>}
    {tab==='reputation' && approved && paid && <ReputationHub isAdmin={isAdmin}/>}
    {tab==='agreements' && approved && paid && <AgreementPackets/>}
    {tab==='controls' && approved && isAdmin && <AdminProductControls/>}
    {tab==='integrations' && approved && isAdmin && <IntegrationHealth/>}
    {tab==='membership'&&<div className={`${panel} max-w-2xl space-y-3`}><h2 className="text-xl font-semibold">Free today. Unlock more when ready.</h2><p className={muted}>Your free account includes age verification, profile setup and limited directory previews.</p><div className="p-4 rounded-lg bg-[#1A2438]"><LockKeyhole className="text-blue-400 mb-2"/>Full discovery, direct messages, contracts, collaboration rooms, property booking and advanced tools require membership.</div><p className="text-sm text-amber-200">Checkout will only become available after an approved adult-industry payment provider is configured. Payment is never collected by this website directly.</p><div className="flex flex-wrap gap-2"><p className={muted}>Paid checkout is paused until an adult-industry merchant processor approves this business model. No subscription charges are possible from this preview.</p></div></div>}
  </>}</OriginalShell>;
}