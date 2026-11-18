import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const globals=read('src/globals.css');
const theme=read('src/supabase/professional-theme.css');
function hexToken(name){const match=globals.match(new RegExp('--'+name+':\\s*(#[a-f0-9]{6})','i'));assert.ok(match,'Missing '+name);return match[1];}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('both brands deliberately default to white, independent of OS or old dark preference',()=>{
 assert.equal(hexToken('cc-bg'),'#FFFFFF');assert.match(globals,/color-scheme:\s*light/);
 assert.match(read('index.html'),/name="color-scheme" content="light"/);
 assert.doesNotMatch(read('index.html'),/<html[^>]*class="dark"/);
 assert.match(read('src/supabase/bootstrap.jsx'),/classList\.remove\('dark'\)/);
 assert.doesNotMatch(read('src/supabase/OriginalShell.jsx'),/toggleTheme|setTheme/);
 assert.equal(JSON.parse(read('public/manifest.json')).background_color,'#FFFFFF');
});
test('body, secondary and muted text have at least 4.5:1 contrast on white and subtle cards',()=>{
 for(const text of ['cc-text-primary','cc-text-secondary','cc-text-muted','cc-link'])for(const bg of ['cc-bg','cc-surface-subtle'])assert.ok(contrast(hexToken(text),hexToken(bg))>=4.5,text+' / '+bg);
});
test('solid primary actions have readable text and focus is visible on the page',()=>{
 assert.ok(contrast(hexToken('cc-on-action'),hexToken('cc-action'))>=4.5);
 assert.ok(contrast(hexToken('cc-on-action'),hexToken('cc-action-hover'))>=4.5);
 assert.ok(contrast(hexToken('cc-focus'),hexToken('cc-bg'))>=3);
 assert.match(theme,/background:var\(--cc-action\); color:var\(--cc-on-action\)/);
});
test('the professional layer is loaded globally after brand, host and marketing layouts',()=>{
 const boot=read('src/supabase/bootstrap.jsx');
 for(const layer of ['brand-theme.css','onlyhost-theme.css','host-workspace.css','public-landing.css'])assert.ok(boot.indexOf(layer)<boot.indexOf('professional-theme.css'));
 assert.doesNotMatch(theme,/filter:\s*invert|animation:.*\binfinite/);
});
test('modals use native light form chrome without sacrificing keyboard controls',()=>{
 assert.doesNotMatch(read('src/supabase/host-workspace.css'),/color-scheme:\s*dark/);
 assert.match(read('src/supabase/HostDialog.jsx'),/showModal/);
 assert.match(theme,/:focus-visible/);
 assert.match(read('src/control-layout.css'),/checkbox/);
});
test('new public hero uses real text and actions, not neon artwork with baked-in labels',()=>{
 const hero=read('src/supabase/ProfessionalLandingHero.jsx');
 assert.match(hero,/<h1/);assert.match(hero,/href="\/signup"/);assert.match(hero,/onClick=\{onStart\}/);
 assert.doesNotMatch(hero,/content_conect_hero|Host_Connect_Banner|ContentConnectX__/);
 assert.doesNotMatch(read('src/supabase/brand-theme.css'),/@keyframes.*float/);
});
