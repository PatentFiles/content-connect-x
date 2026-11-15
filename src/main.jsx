// Separate application entrypoints: Bolt's Supabase preview does not load the
// Base44 SDK, routing contexts, or any old backend modules.
import '@/index.css';
if (import.meta.env.MODE === 'supabase' || import.meta.env.VITE_BACKEND_PROVIDER === 'supabase') {
  import('./supabase/bootstrap.jsx');
} else {
  import('./legacyBootstrap.jsx');
}
