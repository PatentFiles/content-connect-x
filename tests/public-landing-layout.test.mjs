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

test('workflow and discovery cards share the existing lift, twist and ambient glow with centered icons',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const css=read('src/supabase/public-brand-theme.css');
 assert.match(landing,/hoverTones=\['cyan','pink','violet'\]/);
 assert.match(landing,/ccx-home-discovery-card ccx-hover-/);
 assert.match(landing,/ccx-slim-step ccx-hover-/);
 assert.match(css,/\.ccx-public-landing \.ccx-slim-step-top \{/);
 assert.match(css,/display:grid;place-items:center/);
 assert.match(css,/width:106px;height:106px;flex:0 0 106px/);
 assert.match(css,/\.ccx-slim-step:hover \.ccx-slim-step-top \{/);
 assert.match(css,/\.ccx-home-discovery-card:hover \.ccx-home-discovery-artwork \{/);
 assert.match(css,/rotate\(-5deg\) scale\(1\.08\)/);
 assert.match(css,/radial-gradient\(circle,var\(--card-glow\),transparent 70%\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{/);
});
test('hero-matched violet, blue and pink palette is isolated to signed-out homepage including footer',()=>{
 const css=read('src/supabase/public-brand-theme.css');
 const app=read('src/supabase/SupabaseApp.jsx');
 const homeCss=css.slice(css.lastIndexOf('/* Content Connect X signed-out HOME ONLY.'));
 for(const color of ['#59ddff','#a98aff','#ff64d0'])assert.ok(homeCss.includes(color),'Hero gradient tone missing '+color);
 for(const part of ['ccx-home-discovery','ccx-slim-features','ccx-slim-steps-section','ccx-slim-cta','ccx-slim-footer'])assert.ok(homeCss.includes(part),'Missing palette '+part);
 assert.match(homeCss,/:where\(html\[data-ccx-appearance="public"\]/);
 assert.match(homeCss,/:has\(\.ccx-public-landing\)/);
 assert.doesNotMatch(homeCss,/\[data-ccx-appearance="workspace"\]/);
 assert.match(app,/content_conect_hero\.png/);
 assert.match(app,/ContentConnectX__Create,_Collaborate,_Grow\.png/);
});
