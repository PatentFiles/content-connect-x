import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const globals=read('src/globals.css');
const theme=read('src/supabase/professional-theme.css');
function hexToken(name){const match=globals.match(new RegExp('--'+name+':\\s*(#[a-f0-9]{6})','i'));assert.ok(match,'Missing '+name);return match[1];}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('signed-in brands retain white styling independently of OS preferences',()=>{
 assert.equal(hexToken('cc-bg'),'#FFFFFF');assert.match(globals,/color-scheme:\s*light/);
 assert.match(read('index.html'),/data-ccx-appearance="public"/);
 assert.match(read('src/supabase/authAppearance.js'),/signedIn\?'workspace':'public'/);
 assert.match(read('src/supabase/authAppearance.js'),/useLayoutEffect/);
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
test('the professional layer is ordered after layouts but excludes public pages',()=>{
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
test('original public artwork and both session-driven appearance boundaries are preserved',()=>{
 const app=read('src/supabase/SupabaseApp.jsx'),host=read('src/supabase/OnlyHostApp.jsx');
 assert.match(app,/content_conect_hero\.png/);
 assert.match(app,/ContentConnectX__Create,_Collaborate,_Grow\.png/);
 assert.match(host,/Host_Connect_Banner\.png/);
 assert.match(app,/useAuthAppearance\(user\)/);assert.match(host,/useAuthAppearance\(user\)/);
 assert.match(read('src/supabase/public-brand-theme.css'),/data-ccx-appearance="public"/);
 assert.match(theme,/:not\(\[data-ccx-appearance="public"\]\)/);
});
