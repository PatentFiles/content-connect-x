/**
 * Host Connect X browser configuration. This standalone application must NOT
 * fall back to the Content Connect X Supabase project or its auth.users.
 * All client-side keys must be publishable/legacy anon keys, never service keys.
 */
import {browserKeyIsUnsafe} from './browserKeySafety.mjs';
const SOURCE_PROJECT='yxuqbygykpfbioslljlf';
const invalid=error=>({ready:false,url:null,key:null,error,source:'invalid'});
const clean=value=>typeof value==='string'?value.trim():'';
export function resolveHostSupabaseConfig(env={}){
 const url=clean(env.VITE_SUPABASE_URL);
 const key=clean(env.VITE_SUPABASE_PUBLISHABLE_KEY)||clean(env.VITE_SUPABASE_ANON_KEY);
 if(!url||!key)return invalid('Host Connect X requires its own VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before launch.');
 if(browserKeyIsUnsafe(env.VITE_SUPABASE_PUBLISHABLE_KEY)||browserKeyIsUnsafe(env.VITE_SUPABASE_ANON_KEY))return invalid('A secret or service-role credential cannot be shipped to a browser.');
 let parsed;
 try{parsed=new URL(url);}catch{return invalid('Host Connect X Supabase URL is invalid.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||!parsed.hostname.endsWith('.supabase.co'))return invalid('Host Connect X requires a valid HTTPS Supabase project origin.');
 if(parsed.hostname===SOURCE_PROJECT+'.supabase.co')return invalid('Do not point Host Connect X to the Content Connect X production database. Configure the new Host Connect X Supabase project.');
 if(key.length<12)return invalid('Host Connect X publishable API key is invalid.');
 return {ready:true,url:parsed.origin,key,source:'host-environment',projectRef:parsed.hostname.split('.')[0],error:null};
}
