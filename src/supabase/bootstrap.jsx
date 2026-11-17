/**
 * Content Connect X startup — a missing Bolt-native Supabase connection must
 * not blank the application. Only the verified PUBLIC browser settings are used.
 */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,supabaseConfiguration} from '../api/supabaseClient';
import SupabaseApp from './SupabaseApp';
import OnlyHostApp from './OnlyHostApp';
import './brand-theme.css';
import './onlyhost-theme.css';
import './public-landing.css';
import {initializeOptionalIntegrations} from './integrations';
import {initializeFormKeyboardHints} from './formKeyboard.mjs';

class StartupErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('Content Connect X startup failed',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main className="min-h-screen bg-[#090F1A] px-5 py-24 text-white">
   <section role="alert" className="mx-auto max-w-lg rounded-xl border border-rose-500/40 bg-[#152033] p-7">
    <h1 className="text-xl font-semibold">The preview could not finish loading</h1>
    <p className="mt-3 text-sm text-[#B3C6DF]">
     A frontend module failed while starting. Refresh once, and check the first error
     in Bolt's browser console if it continues. The Supabase project was not changed.
    </p>
    <button className="mt-5 rounded-lg bg-[#BB347D] px-4 py-2 text-sm font-semibold text-white"
      onClick={()=>window.location.reload()}>Reload website</button>
   </section>
  </main>;
 }
}

document.documentElement.classList.add('dark');
void initializeOptionalIntegrations().catch(error=>{
 // Optional monitoring/feature-flag services must not stop the main website.
 console.warn('Optional frontend integration unavailable',error);
});
const mount=document.getElementById('root');
if(!mount)throw new Error('Content Connect X root element is missing');
initializeFormKeyboardHints(mount);
const knownHosts=(import.meta.env.VITE_ONLYHOST_HOSTNAMES||'')
 .split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const showHostConnect=window.location.pathname==='/hostconnect'||
 window.location.pathname.startsWith('/hostconnect/')||
 window.location.pathname==='/onlyhost'||
 window.location.pathname.startsWith('/onlyhost/')||
 knownHosts.includes(window.location.hostname.toLowerCase());

createRoot(mount).render(
 <StartupErrorBoundary>
  {supabase?(showHostConnect?<OnlyHostApp/>:<SupabaseApp/>):
   <main className="min-h-screen bg-[#090F1A] px-6 py-24 text-white">
    <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-[#34455B] bg-[#152033] p-8">
     <h1 className="text-2xl font-semibold">Supabase browser configuration requires attention</h1>
     <p className="mt-4 text-sm text-[#B3C6DF]">{supabaseConfiguration.error||
      'A matching Supabase public project URL and publishable key are required.'}</p>
     <p className="mt-4 font-mono text-xs text-[#92A7C1]">VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY</p>
    </div>
   </main>}
 </StartupErrorBoundary>
);
