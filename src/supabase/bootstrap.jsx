/** Startup keeps public trust/support pages accessible without granting member access. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,supabaseConfiguration} from '../api/supabaseClient';
import OnlyHostApp from './OnlyHostApp';
import TrustSite from './TrustSite';
import SessionPrivacyBoundary from './SessionPrivacyBoundary';
import './brand-theme.css';
import './onlyhost-theme.css';
import './host-workspace.css';
import './public-landing.css';
import './professional-theme.css';
import './public-brand-theme.css';
import './workspace-refinement.css';
import './workspace-nav.css';
import './workspace-visual-system.css';
import {applyAuthAppearance} from './authAppearance';
import {initializeOptionalIntegrations} from './integrations';
import {initializeFormKeyboardHints} from './formKeyboard.mjs';
class StartupErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('Host Connect X startup failed',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main className="min-h-screen bg-[var(--cc-surface-subtle)] px-5 py-24 text-[var(--cc-text-primary)]"><section role="alert" className="mx-auto max-w-lg rounded-xl border border-rose-300 bg-[var(--cc-surface)] p-7"><h1 className="text-xl font-semibold">The preview could not finish loading</h1><p className="mt-3 text-sm text-[var(--cc-text-secondary)]">A frontend module failed while starting. Refresh once, and check the first error in Bolt's browser console if it continues. The Supabase project was not changed.</p><button className="mt-5 rounded-lg ccx-solid-action px-4 py-2 text-sm font-semibold text-[var(--cc-text-primary)]" onClick={()=>window.location.reload()}>Reload website</button></section></main>;
 }
}
applyAuthAppearance(false);
void initializeOptionalIntegrations().catch(()=>console.warn('Optional frontend integration unavailable'));
const mount=document.getElementById('root');if(!mount)throw new Error('Host Connect X root element is missing');
initializeFormKeyboardHints(mount);
// Host Connect X standalone entrypoint. Every path, including /, renders
// the EXISTING Host Connect website. This build cannot route to the CCX
// creator dashboard or law-enforcement portal.
const isTrustRoute=/^\/trust(?:\/|$)/i.test(window.location.pathname);
const configuredApp=supabase?(isTrustRoute?<TrustSite><OnlyHostApp/></TrustSite>:<OnlyHostApp/>):<main className="min-h-screen bg-[var(--cc-surface-subtle)] px-6 py-24 text-[var(--cc-text-primary)]"><div role="alert" className="mx-auto max-w-xl rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-8"><h1 className="text-2xl font-semibold">Host Connect X setup required</h1><p className="mt-4 text-sm text-[var(--cc-text-secondary)]">{supabaseConfiguration.error||'Configure the Host Connect X Supabase project before publishing.'}</p></div></main>;
createRoot(mount).render(<StartupErrorBoundary><SessionPrivacyBoundary>{configuredApp}</SessionPrivacyBoundary></StartupErrorBoundary>);
