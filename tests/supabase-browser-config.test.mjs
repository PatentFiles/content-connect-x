import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CCX_SUPABASE_PROJECT_REF,CCX_SUPABASE_PUBLIC_URL,CCX_SUPABASE_PUBLIC_KEY,
 resolveBrowserSupabaseConfig
} from '../src/api/publicSupabaseConfig.mjs';

test('Bolt preview without Vite settings connects to the verified public Supabase project',()=>{
 const resolved=resolveBrowserSupabaseConfig({});
 assert.equal(resolved.ready,true);
 assert.equal(resolved.url,'https://'+CCX_SUPABASE_PROJECT_REF+'.supabase.co');
 assert.equal(resolved.url,CCX_SUPABASE_PUBLIC_URL);
 assert.equal(resolved.key,CCX_SUPABASE_PUBLIC_KEY);
 assert.equal(resolved.source,'project-default');
 assert.ok(resolved.key.startsWith('sb_publishable_'),'Never use private service keys in a browser');
});
test('existing Bolt VITE_SUPABASE_ANON_KEY legacy naming remains supported',()=>{
 const result=resolveBrowserSupabaseConfig({
  VITE_SUPABASE_URL:CCX_SUPABASE_PUBLIC_URL,VITE_SUPABASE_ANON_KEY:'test-anon-public-value'
 });
 assert.equal(result.ready,true);
 assert.equal(result.source,'environment');
 assert.equal(result.key,'test-anon-public-value');
});
test('current VITE_SUPABASE_PUBLISHABLE_KEY overrides a legacy key',()=>{
 const result=resolveBrowserSupabaseConfig({
  VITE_SUPABASE_URL:CCX_SUPABASE_PUBLIC_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY:'test-publishable-public-value',
  VITE_SUPABASE_ANON_KEY:'test-legacy-public-key'
 });
 assert.equal(result.ready,true);
 assert.equal(result.key,'test-publishable-public-value');
});
test('missing same-project half-pair uses the known safe public configuration',()=>{
 const byUrl=resolveBrowserSupabaseConfig({VITE_SUPABASE_URL:CCX_SUPABASE_PUBLIC_URL});
 const byKey=resolveBrowserSupabaseConfig({VITE_SUPABASE_PUBLISHABLE_KEY:CCX_SUPABASE_PUBLIC_KEY});
 assert.equal(byUrl.ready,true);assert.equal(byKey.ready,true);
 assert.equal(byUrl.source,'environment-and-project-default');
 assert.equal(byKey.source,'environment-and-project-default');
});
test('Bolt-native database variables cannot switch the application to an empty project',()=>{
 const wrong=resolveBrowserSupabaseConfig({
  VITE_SUPABASE_URL:'https://sotlluwlqxfrzexxidno.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_BOLT_NATIVE_DIFFERENT_PROJECT'
 });
 assert.equal(wrong.ready,true);
 assert.equal(wrong.url,CCX_SUPABASE_PUBLIC_URL);
 assert.equal(wrong.key,CCX_SUPABASE_PUBLIC_KEY);
 assert.equal(wrong.source,'canonical-override');
 assert.ok(wrong.warning);
 const partial=resolveBrowserSupabaseConfig({VITE_SUPABASE_ANON_KEY:'some-other-public-key'});
 assert.equal(partial.ready,true);
 assert.equal(partial.url,CCX_SUPABASE_PUBLIC_URL);
 assert.equal(partial.source,'canonical-override');
});
test('fail closed for insecure URLs and server-only keys',()=>{
 for(const url of ['http://yxuqbygykpfbioslljlf.supabase.co',
  'https://user:pass@yxuqbygykpfbioslljlf.supabase.co',
  'https://yxuqbygykpfbioslljlf.supabase.co/path',
  'not-a-url']){
  assert.equal(resolveBrowserSupabaseConfig({
   VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:'test-public-value'
  }).ready,false,url);
 }
 assert.equal(resolveBrowserSupabaseConfig({
  VITE_SUPABASE_URL:CCX_SUPABASE_PUBLIC_URL,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_never-allowed'
 }).ready,false);
});
