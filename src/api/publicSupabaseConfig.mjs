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
  const givenUrl=clean(raw.VITE_SUPABASE_URL);
  const givenKey=clean(raw.VITE_SUPABASE_PUBLISHABLE_KEY)||clean(raw.VITE_SUPABASE_ANON_KEY);
  // Safe fallback is limited to the single existing Content Connect X project.
  const url=givenUrl||(!givenKey||givenKey===CCX_SUPABASE_PUBLIC_KEY?CCX_SUPABASE_PUBLIC_URL:'');
  const key=givenKey||(!givenUrl||givenUrl===CCX_SUPABASE_PUBLIC_URL?CCX_SUPABASE_PUBLIC_KEY:'');
  if(!url||!key)return failure(
    'The Bolt build contains an incomplete Supabase URL/key pair for a different project. Use matching public credentials for the intended project.'
  );
  let parsed;
  try{parsed=new URL(url);}catch{return failure('Invalid Supabase project URL in Bolt environment settings.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname.includes('.')||
     parsed.search||parsed.hash||parsed.pathname!=='/'){
    return failure('The Supabase browser URL must be an HTTPS project origin without a path, query or credentials.');
  }
  if(key.startsWith('sb_secret_')||key.length<12){
    return failure('Invalid browser API key. Use the public publishable/anon key, never a Supabase secret key.');
  }
  const source=givenUrl&&givenKey?'environment':givenUrl||givenKey?'environment-and-project-default':'project-default';
  const projectRef=parsed.hostname.endsWith('.supabase.co')?parsed.hostname.split('.')[0]:null;
  return {ready:true,url:parsed.origin,key,source,projectRef,error:null};
}
