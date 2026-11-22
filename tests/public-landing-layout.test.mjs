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

test('signed-out home uses one unlinked Content brand with a fully linked Host brand in the legal footer',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const trust=read('src/supabase/TrustSite.jsx');
 const home=app.slice(app.indexOf('if(!user&&!authPage)'),app.indexOf('if(!user&&authPage)'));
 assert.ok(!landing.includes('<footer'),'Duplicate marketing footer is removed');
 assert.ok(!landing.includes('BrandWordmark'),'Landing section has no second Content brand');
 assert.ok(home.includes("shell+' ccx-public-home'"));
 assert.ok(home.includes('<PublicLandingSections/>'));
 assert.ok(!home.includes('<footer'));
 assert.ok(trust.includes('homePage?<span className="ccx-trust-brand"><BrandWordmark brand="content"/></span>'));
 assert.ok(trust.includes('className="ccx-home-host-link" href="https://hostconnectx.com"'));
 assert.ok(trust.includes('<BrandWordmark brand="host"/></a>'));
 assert.ok(trust.includes("homePage={path===''}"));
 assert.ok(trust.includes("<TrustFooter homePage={path===''} /></>".replace(' />','/>')),'Trust footer fragment is closed');
 assert.ok(trust.includes('aria-label="Legal, safety and support"'));
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

test('continuous root gradient, original hero fade and one animated Host link are homepage-scoped',()=>{
 const css=read('src/supabase/public-brand-theme.css');
 const app=read('src/supabase/SupabaseApp.jsx');
 const trust=read('src/supabase/TrustSite.jsx');
 const homeCss=css.slice(css.lastIndexOf('/* Logged-out Content Connect X homepage: one continuous backdrop'));
 assert.ok(homeCss.includes('#root:has(.ccx-public-home)'));
 assert.ok(homeCss.includes('linear-gradient(180deg,#0d0923'));
 for(const area of ['.ccx-home-discovery','.ccx-slim-features','.ccx-slim-steps-section','.ccx-slim-cta-wrap','.ccx-trust-footer'])assert.ok(homeCss.includes(area));
 assert.ok(homeCss.includes('background:transparent!important'));
 assert.ok(homeCss.includes('.ccx-hero-image picture'));
 assert.ok(homeCss.includes('mask-image:linear-gradient(to bottom'));
 assert.ok(homeCss.includes('a.ccx-home-host-link:hover'));
 assert.ok(homeCss.includes('a.ccx-home-host-link:focus-visible'));
 assert.ok(homeCss.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(!homeCss.includes('[data-ccx-appearance="workspace"]'));
 assert.ok(app.includes('/content_conect_hero.png'));
 assert.ok(app.includes('/ContentConnectX__Create,_Collaborate,_Grow.png'));
 assert.ok(trust.includes('<TrustFooter legalPage/>'));
});

test('the desktop and mobile hero fade in at the top and fade out at the bottom',()=>{
 const css=read('src/supabase/public-brand-theme.css');
 const app=read('src/supabase/SupabaseApp.jsx');
 const fade=css.slice(css.lastIndexOf('/* Blend both edges of the existing desktop AND mobile hero artwork'));
 assert.match(fade,/\\.ccx-hero-image picture \\{/);
 assert.match(fade,/-webkit-mask-image:linear-gradient\\(to bottom,\\s*transparent 0%/);
 assert.match(fade,/mask-image:linear-gradient\\(to bottom,\\s*transparent 0%/);
 assert.match(fade,/#000 16%/);
 assert.match(fade,/transparent 100%/);
 assert.match(fade,/@media\\(max-width:640px\\)/);
 assert.match(fade,/#000 18%/);
 assert.match(fade,/#000 71%/);
 assert.doesNotMatch(fade,/\\.ccx-public-hero-actions[^\\n]*mask-image/);
 assert.match(app,/<source media="\\(max-width: 640px\\)" srcSet="\\/ContentConnectX__Create,_Collaborate,_Grow\\.png"\\/>/);
 assert.match(app,/src="\\/content_conect_hero\\.png"/);
});
