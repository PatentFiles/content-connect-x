/**
 * Content Connect X's PUBLIC Supabase browser configuration.
 *
 * This app intentionally binds to its existing Supabase project. The publishable
 * key is explicitly a public browser credential, NOT a server/service-role key.
 * GitHub/Bolt can therefore render an app preview even if Bolt loses the
 * environment variables supplied by its optional native Supabase integration.
 *
 * Explicit VITE_ configuration always wins when provided as a complete pair.
 * A partial pair pointing to another project is rejected, never mixed with
 * the key for Content Connect X. This avoids silently selecting a wrong DB.
 */
import {browserKeyIsUnsafe} from './browserKeySafety.mjs';
export const CCX_SUPABASE_PROJECT_REF='yxuqbygykpfbioslljlf';
export const CCX_SUPABASE_PUBLIC_URL='https://yxuqbygykpfbioslljlf.supabase.co';
// Browser publishable keys are documented as safe to distribute; NEVER place
// sb_secret_ / service_role credentials in this file or Vite environment vars.
export const CCX_SUPABASE_PUBLIC_KEY="sb_publishable_FQDWy7ff93mzy7Tj8DR22Q_OYSPYxb6";

const clean=value=>typeof value==='string'?value.trim():'';
const failure=message=>({ready:false,url:null,key:null,source:'invalid',error:message,projectRef:null});

/**
 * Resolve public build configuration without depending on Bolt's connection UI.
 * No network access or authorization decisions happen here.
 */
/** @param {Record<string, unknown>} [env] */
export function resolveBrowserSupabaseConfig(env={}){
  const raw=env&&typeof env==='object'?env:{};
  const requestedUrl=clean(raw.VITE_SUPABASE_URL);
  const requestedKey=clean(raw.VITE_SUPABASE_PUBLISHABLE_KEY)||clean(raw.VITE_SUPABASE_ANON_KEY);

  // Bolt can automatically inject credentials for a SECOND, empty database.
  // Never connect Content Connect X to that project: its auth.users, profile
  // schema, Storage buckets, and Edge Functions are all independent.
  // Keep a single canonical Supabase identity and database across deployments.
  let parsed=null;
  if(requestedUrl){
    try{parsed=new URL(requestedUrl);}catch{return failure('Invalid Supabase project URL supplied by Bolt.');}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||
       parsed.hash||parsed.pathname!=='/'||!parsed.hostname.endsWith('.supabase.co')){
      return failure('Supabase URL must be a valid HTTPS project origin.');
    }
  }
  if(browserKeyIsUnsafe(raw.VITE_SUPABASE_PUBLISHABLE_KEY)||browserKeyIsUnsafe(raw.VITE_SUPABASE_ANON_KEY)){
    return failure('Do not use a service-role/secret key in the browser.');
  }
  const mismatchedProject=Boolean(parsed&&parsed.origin!==CCX_SUPABASE_PUBLIC_URL);
  const unmatchedKey=Boolean(!parsed&&requestedKey&&requestedKey!==CCX_SUPABASE_PUBLIC_KEY);
  if(mismatchedProject||unmatchedKey){
    return {ready:true,url:CCX_SUPABASE_PUBLIC_URL,key:CCX_SUPABASE_PUBLIC_KEY,
      source:'canonical-override',projectRef:CCX_SUPABASE_PROJECT_REF,error:null,
      warning:'Bolt supplied settings for another Supabase project. Using the established Content Connect X database instead.'};
  }
  const key=requestedKey||CCX_SUPABASE_PUBLIC_KEY;
  if(key.length<12)return failure('Invalid public Supabase API key.');
  const source=parsed&&requestedKey?'environment':parsed||requestedKey?'environment-and-project-default':'project-default';
  return {ready:true,url:CCX_SUPABASE_PUBLIC_URL,key,source,
    projectRef:CCX_SUPABASE_PROJECT_REF,error:null};
}
