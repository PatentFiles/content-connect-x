/** Only build-time configured browser settings select the correct Supabase project.
 * Publishable keys are public. Service-role and other secrets must never be bundled.
 */
import { createClient } from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL;
const publishableKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY;
const valid=typeof url==='string'&&url.startsWith('https://')&&
 typeof publishableKey==='string'&&publishableKey.length>=12;

export const supabase=valid?createClient(url,publishableKey,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
}):null;

export function requireSupabase(){
 if(!supabase)throw new Error('Deployment is missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
 return supabase;
}
