import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('signed-out discovery is the first section below the existing hero and only hides chef on the homepage',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const categories=read('src/supabase/CategoryArtwork.jsx');
 assert.ok(landing.indexOf('ccx-slim-section ccx-home-discovery')<landing.indexOf('ccx-slim-section ccx-slim-features'));
 assert.match(app,/<section className="ccx-hero-image[\s\S]*?<PublicLandingSections\/>/);
 assert.match(landing,/DISCOVERY_CATEGORIES\.filter\(item=>item\.key!=='chef'\)/);
 assert.match(categories,/key:'chef'/,'authenticated discovery retains its professional catalog');
});

test('marketing tools and workflow use pictograms, no sequence badges or operational disclaimers',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const css=read('src/supabase/public-brand-theme.css');
 for(const icon of ['Fingerprint','CreditCard','Globe2','Handshake','FilePenLine']){
  assert.match(landing,new RegExp('Icon:'+icon+'[},]'));
 }
 assert.match(landing,/ccx-slim-step-top"><Icon size=\{64\}/);
 assert.match(css,/\.ccx-slim-step-top \{[\s\S]*?width:106px;height:106px/);
 assert.doesNotMatch(landing,/ccx-slim-feature-num|String\(i\+1\)|Features requiring verification|Browse member profiles after registration|Registration is free\./);
});

test('logged-out homepage has one footer with one wordmark for each brand and no extra blue boxed footer',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const publicHome=app.slice(app.indexOf('if(!user&&!authPage)'),app.indexOf('if(!user&&authPage)'));
 assert.equal((landing.match(/<footer\b/g)||[]).length,1);
 assert.equal((landing.match(/<BrandWordmark brand="content"/g)||[]).length,1);
 assert.equal((landing.match(/<BrandWordmark brand="host"/g)||[]).length,1);
 assert.match(landing,/Production spaces and venue hosting:/);
 assert.doesNotMatch(publicHome,/<footer\b/,'second footer must not render on logged-out homepage');
});
