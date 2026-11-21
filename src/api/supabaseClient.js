/** Single public browser client. No service-role credentials belong here. */
import {createClient} from '@supabase/supabase-js';
import {resolveHostSupabaseConfig} from './hostSupabaseConfig.mjs';
import {compatibleEdgeFetch} from './edgeTransport.mjs';
export const supabaseConfiguration=resolveHostSupabaseConfig(import.meta.env);
if(supabaseConfiguration.warning)console.warn(supabaseConfiguration.warning);
export const supabase=supabaseConfiguration.ready
 ?createClient(supabaseConfiguration.url,supabaseConfiguration.key,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
   global:{fetch:compatibleEdgeFetch(supabaseConfiguration.url)}
 }):null;
export function requireSupabase(){
 if(!supabase)throw new Error(supabaseConfiguration.error||'The public Supabase browser configuration is missing or invalid.');
 return supabase;
}
