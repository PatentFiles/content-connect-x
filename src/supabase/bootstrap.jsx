import React from 'react';
import { createRoot } from 'react-dom/client';
import SupabaseApp from './SupabaseApp';
import OnlyHostApp from './OnlyHostApp';
import './brand-theme.css';
import './onlyhost-theme.css';
import { initializeOptionalIntegrations } from './integrations';

document.documentElement.classList.add('dark');
void initializeOptionalIntegrations();
const mount=document.getElementById('root');
if (!mount) throw new Error('Content Connect X root element is missing');
const configured=Boolean(
 import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
// The deploy can serve ONLYHOST_HOSTNAMES from this identical build; the /onlyhost
// path enables standalone brand preview before the custom domain is connected.
const knownHosts=(import.meta.env.VITE_ONLYHOST_HOSTNAMES||'')
 .split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const showOnlyHost=window.location.pathname==='/onlyhost'||
 window.location.pathname.startsWith('/onlyhost/')||
 knownHosts.includes(window.location.hostname.toLowerCase());
createRoot(mount).render(configured?(showOnlyHost?<OnlyHostApp/>:<SupabaseApp/>):
 <main className="min-h-screen bg-[#090F1A] px-6 py-24 text-white">
  <div className="mx-auto max-w-xl rounded-2xl border border-[#34455B] bg-[#152033] p-8">
   <h1 className="text-2xl font-semibold">Content Connect X is not configured</h1>
   <p className="mt-4 text-sm text-[#B3C6DF]">This deployment has no authorized Supabase browser configuration. Authentication, private data and bookings are unavailable until the deployment administrator configures the public project URL and publishable key, then rebuilds.</p>
   <p className="mt-4 font-mono text-xs text-[#92A7C1]">VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY</p>
  </div>
 </main>);
