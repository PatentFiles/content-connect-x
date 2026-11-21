import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveHostSupabaseConfig} from '../src/api/hostSupabaseConfig.mjs';

const hostname='https://abcdefgh123456789012.supabase.co';
const publishable='sb_publishable_fixture_host_connect_x_12345';

test('host project rejects missing config and cannot fall back to CCX',()=>{
 assert.equal(resolveHostSupabaseConfig({}).ready,false);
 const fallback=resolveHostSupabaseConfig({
  VITE_SUPABASE_URL:'https://yxuqbygykpfbioslljlf.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY:publishable
 });
 assert.equal(fallback.ready,false);
 assert.match(fallback.error,/Content Connect X/);
});

test('host browser keys must be publishable and project URL explicit',()=>{
 assert.equal(resolveHostSupabaseConfig({VITE_SUPABASE_URL:hostname,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_not_for_browser'}).ready,false);
 const allowed=resolveHostSupabaseConfig({VITE_SUPABASE_URL:hostname,VITE_SUPABASE_PUBLISHABLE_KEY:publishable});
 assert.equal(allowed.ready,true);
 assert.equal(allowed.url,hostname);
 assert.equal(allowed.source,'host-environment');
});

test('standalone host entry always uses Host Connect and crosses to CCX external domain',()=>{
 const boot=readFileSync('src/supabase/bootstrap.jsx','utf8');
 const app=readFileSync('src/supabase/OnlyHostApp.jsx','utf8');
 const client=readFileSync('src/api/supabaseClient.js','utf8');
 assert.match(boot,/<OnlyHostApp\/>/);
 assert.doesNotMatch(boot,/import SupabaseApp/);
 assert.match(client,/resolveHostSupabaseConfig/);
 assert.match(app,/href="https:\/\/contentconnectx\.com"/);
});
