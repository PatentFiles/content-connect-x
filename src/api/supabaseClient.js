/**
 * One Supabase client for Bolt preview, published frontend and local builds.
 * The project's known public URL/publishable key are safe to bundle. Explicit
 * environment settings take precedence; server/service-role credentials NEVER
 * belong in this module.
 */
import {createClient} from '@supabase/supabase-js';
import {resolveBrowserSupabaseConfig} from './publicSupabaseConfig.mjs';

export const supabaseConfiguration=resolveBrowserSupabaseConfig(import.meta.env);
export const supabase=supabaseConfiguration.ready
 ?createClient(supabaseConfiguration.url,supabaseConfiguration.key,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 }):null;

export function requireSupabase(){
 if(!supabase)throw new Error(supabaseConfiguration.error||
   'The public Supabase browser configuration is missing or invalid.');
 return supabase;
}
