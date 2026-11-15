/** Supabase client for the new Content Connect X backend. */
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL || 'https://yxuqbygykpfbioslljlf.supabase.co';
// Publishable keys are safe in frontend code; never embed service-role or secret keys.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_FQDWy7ff93mzy7Tj8DR22Q_OYSPYxb6';
// Keep the current UI compiling until the new project and Auth integration are linked.
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function requireSupabase() {
  if (!supabase) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  return supabase;
}
