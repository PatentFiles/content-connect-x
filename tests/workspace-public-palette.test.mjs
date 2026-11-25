import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const lum=hex=>{
 const rgb=hex.slice(1).match(/.{2}/g).map(v=>parseInt(v,16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{
 const [x,y]=[lum(a),lum(b)].sort((a,b)=>b-a);
 return (x+.05)/(y+.05);
};
const token=(css,name)=>{
 const match=css.match(new RegExp('--'+name+':(#[0-9a-f]{6})','i'));
 assert.ok(match,'Missing exact brand token: '+name);
 return match[1].toLowerCase();
};

test('workplace reuses the actual public cyan, violet and fuchsia palette',()=>{
 const css=read('src/supabase/workspace-public-palette.css');
 const bootstrap=read('src/supabase/bootstrap.jsx');
 const publicCss=read('src/supabase/public-brand-theme.css');
 const old=bootstrap.indexOf("import './workspace-visual-system.css'");
 const next=bootstrap.indexOf("import './workspace-public-palette.css'");
 assert.ok(old>=0&&next>old,'Workspace palette must override older teal rules');
 assert.match(css,/:root\[data-ccx-appearance="workspace"\] \.ccx-original-shell/);
 const activeSelectors=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(activeSelectors,/data-ccx-appearance="public"|\.oh-app/);
 assert.ok(publicCss.includes('#09D3F7'));
 assert.ok(publicCss.includes('#8D69FF'));
 assert.ok(publicCss.includes('#F800B8'));
 for(const color of ['#09d3f7','#8d69ff','#f800b8'])
  assert.ok(css.includes(color),'Workspace must reuse public brand tone '+color);
 assert.match(css,/\.ccx-shell-fixed-header::after/);
 assert.doesNotMatch(css,/\.ccx-dashboard-card::before/,'Cards must not regain decorative left stripes');
 assert.match(css,/\.ccx-member-firstname/);
 assert.match(css,/\.ccx-nav-link\.is-active/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('purple-blue-pink buttons and text accents maintain accessible contrast on light cards',()=>{
 const css=read('src/supabase/workspace-public-palette.css');
 const primaryText='#ffffff';
 for(const stop of ['#126ea7','#6e42be','#b12c83'])
  assert.ok(contrast(primaryText,stop)>=4.5,'White button text below 4.5:1 at '+stop);
 for(const stop of ['#126f9d','#6a43b7','#aa277f'])
  assert.ok(contrast(stop,'#ffffff')>=4.5,'Gradient name text too light at '+stop);
 for(const color of ['cc-text-primary','cc-text-secondary','cc-text-muted','cc-link'])
  for(const surface of ['cc-surface','cc-surface-subtle'])
   assert.ok(contrast(token(css,color),token(css,surface))>=4.5,color+' / '+surface);
 assert.ok(contrast('#f8f5ff','#21163e')>12,'Sidebar text must be readable');
});

test('Host Connect blue tokens and all public artwork remain intact',()=>{
 const old=read('src/supabase/workspace-visual-system.css');
 const css=read('src/supabase/workspace-public-palette.css');
 const host=read('src/supabase/OnlyHostApp.jsx');
 assert.match(old,/--brand-host-action:#12698f/);
 assert.match(old,/:root\[data-ccx-appearance="workspace"\] \.oh-app/);
 const activeSelectors=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(activeSelectors,/\.oh-app|\.host-connect-theme/);
 assert.match(host,/Host_Connect_Banner_Mobile\.png/);
 assert.match(read('src/supabase/SupabaseApp.jsx'),/content_conect_hero\.png/);
});
