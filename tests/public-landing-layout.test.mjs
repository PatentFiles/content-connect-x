import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('signed-out discovery is first below the original hero and shares the supported category catalog',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const categories=read('src/supabase/CategoryArtwork.jsx');
 assert.ok(landing.indexOf('ccx-slim-section ccx-home-discovery')<landing.indexOf('ccx-slim-section ccx-slim-features'));
 assert.match(app,/<section className="ccx-hero-image[\s\S]*?<PublicLandingSections\/>/);
 assert.match(landing,/DISCOVERY_CATEGORIES\.map\(\(item,index\)=>/);
 assert.doesNotMatch(categories,/key:'(?:chef|spa)'/,'neither site advertises removed services');
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
 assert.ok(trust.includes('<span className="ccx-trust-brand"><BrandWordmark brand="content"/></span>'));
 assert.ok(!trust.includes('<a href="/" className="ccx-trust-brand">'),'Own brand should not link to the site already open');
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
 const mobile=fade.slice(fade.indexOf('@media(max-width:640px)'));
 assert.ok(fade.includes('.ccx-hero-image picture {'));
 assert.ok(fade.includes('-webkit-mask-image:linear-gradient(to bottom,'));
 assert.ok(fade.includes('mask-image:linear-gradient(to bottom,'));
 assert.ok(fade.includes('transparent 0%'));
 assert.ok(fade.includes('#000 16%'));
 assert.ok(fade.includes('transparent 100%'));
 assert.ok(mobile.includes('transparent 0%'));
 assert.ok(mobile.includes('#000 18%'));
 assert.ok(mobile.includes('#000 71%'));
 assert.ok(mobile.includes('transparent 100%'));
 assert.ok(!fade.includes('.ccx-public-hero-actions {'));
 assert.ok(app.includes('srcSet="/ContentConnectX__Create,_Collaborate,_Grow.png"'));
 assert.ok(app.includes('src="/content_conect_hero.png"'));
});

test('all eleven supported professional Discovery cards have useful modal descriptions and protected navigation',async()=>{
 const {PUBLIC_DISCOVERY_DETAILS}=await import('../src/supabase/publicDiscoveryDetails.mjs');
 const catalog=read('src/supabase/CategoryArtwork.jsx');
 const section=catalog.split('export const DISCOVERY_CATEGORIES=[')[1].split('];')[0];
 const keys=[...section.matchAll(/\{key:'([^']+)'/g)].map(match=>match[1]);
 assert.equal(keys.length,11);
 assert.deepEqual(Object.keys(PUBLIC_DISCOVERY_DETAILS).sort(),keys.sort());
 for(const [key,story] of Object.entries(PUBLIC_DISCOVERY_DETAILS)){
  assert.ok(story.label.length>3,key+' label');
  assert.ok(story.title.length>15,key+' title');
  assert.ok(story.intro.length>60,key+' introduction');
  assert.ok(story.detail.length>95,key+' explanation');
  assert.equal(story.ways.length,3,key+' useful suggestions');
  assert.ok(story.ways.every(value=>value.length>17),key+' suggestions need substance');
 }
 assert.equal(PUBLIC_DISCOVERY_DETAILS.spa,undefined);
 assert.match(PUBLIC_DISCOVERY_DETAILS.verified.detail,/OnlyFans or Fansly/);
 assert.match(PUBLIC_DISCOVERY_DETAILS.verified.detail,/independently confirmed/);
 const landing=read('src/supabase/PublicLandingSections.jsx');
 for(const term of ['DISCOVERY_CATEGORIES.map','ccx-home-discovery-trigger','aria-haspopup="dialog"','aria-controls="ccx-discovery-detail-dialog"','onClick={event=>openDialog','<dialog','aria-modal="true"','aria-labelledby=','onClose=','dialog.showModal()','document.body.style.overflow','triggerRef.current?.focus()','href="/signup"','href="/login"'])
  assert.ok(landing.includes(term),'Missing accessible modal behavior: '+term);
 const css=read('src/supabase/public-brand-theme.css');
 for(const selector of ['.ccx-discovery-detail-dialog::backdrop','.ccx-discovery-dialog-ways','.ccx-home-discovery-trigger:focus-visible','.ccx-discovery-dialog-art','.ccx-discovery-dialog-actions'])
  assert.ok(css.includes(selector),'Missing modal styling: '+selector);
});
