/** Startup keeps public trust/support pages accessible without granting member access. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,supabaseConfiguration} from '../api/supabaseClient';
import SupabaseApp from './SupabaseApp';
import OnlyHostApp from './OnlyHostApp';
import TrustSite from './TrustSite';
import LawEnforcementPortal from './LawEnforcementPortal';
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
 componentDidCatch(error){console.error('Content Connect X startup failed',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main className="min-h-screen bg-[var(--cc-surface-subtle)] px-5 py-24 text-[var(--cc-text-primary)]"><section role="alert" className="mx-auto max-w-lg rounded-xl border border-rose-300 bg-[var(--cc-surface)] p-7"><h1 className="text-xl font-semibold">The preview could not finish loading</h1><p className="mt-3 text-sm text-[var(--cc-text-secondary)]">A frontend module failed while starting. Refresh once, and check the first error in Bolt's browser console if it continues. The Supabase project was not changed.</p><button className="mt-5 rounded-lg ccx-solid-action px-4 py-2 text-sm font-semibold text-[var(--cc-text-primary)]" onClick={()=>window.location.reload()}>Reload website</button></section></main>;
 }
}
applyAuthAppearance(false);
void initializeOptionalIntegrations().catch(()=>console.warn('Optional frontend integration unavailable'));
const mount=document.getElementById('root');if(!mount)throw new Error('Content Connect X root element is missing');
initializeFormKeyboardHints(mount);
const knownHosts=(import.meta.env.VITE_ONLYHOST_HOSTNAMES||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const showHostConnect=window.location.pathname==='/hostconnect'||window.location.pathname.startsWith('/hostconnect/')||window.location.pathname==='/onlyhost'||window.location.pathname.startsWith('/onlyhost/')||knownHosts.includes(window.location.hostname.toLowerCase());
const showLawPortal=/^\/law-enforcement-portal\/?$/i.test(window.location.pathname);
const configuredApp=supabase?<SupabaseApp/>:<main className="min-h-screen bg-[var(--cc-surface-subtle)] px-6 py-24 text-[var(--cc-text-primary)]"><div role="alert" className="mx-auto max-w-xl rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-8"><h1 className="text-2xl font-semibold">Supabase browser configuration requires attention</h1><p className="mt-4 text-sm text-[var(--cc-text-secondary)]">{supabaseConfiguration.error||'A matching Supabase public project URL and publishable key are required.'}</p><p className="mt-4 font-mono text-xs text-[var(--cc-text-secondary)]">VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY</p></div></main>;
createRoot(mount).render(<StartupErrorBoundary><SessionPrivacyBoundary>{showLawPortal&&supabase?<LawEnforcementPortal/>:showHostConnect&&supabase?<OnlyHostApp/>:<TrustSite>{configuredApp}</TrustSite>}</SessionPrivacyBoundary></StartupErrorBoundary>);
