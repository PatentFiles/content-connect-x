import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
const read=p=>fs.readFileSync(p,'utf8');
test('original desktop/mobile Content Connect and Host Connect artwork is unchanged',()=>{
 const manifest=JSON.parse(read('tests/public-brand-assets.json'));
 for(const [file,hash] of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(fs.readFileSync('public/'+file)).digest('hex'),hash,file);
});
test('every refreshed CSS rule excludes public pages, while every restored rule requires them',()=>{
 const files=["src/globals.css","src/supabase/brand-theme.css","src/supabase/onlyhost-theme.css","src/supabase/host-workspace.css","src/supabase/public-landing.css","src/supabase/professional-theme.css"];
 for(const file of [...files,'src/supabase/public-brand-theme.css']){
  const isPublic=file.endsWith('public-brand-theme.css');
  postcss.parse(read(file)).walkRules(rule=>{
   let p=rule.parent;while(p){if(p.type==='atrule'&&/keyframes$/i.test(p.name))return;p=p.parent;}
   for(const selector of rule.selectors){assert.ok(selector.includes(isPublic?'[data-ccx-appearance="public"]':':not([data-ccx-appearance="public"])'),file+' '+selector);}
  });
 }
});
test('appearance helper switches dark/light and browser chrome without changing authorization',async()=>{
 const {applyAuthAppearance}=await import('../src/supabase/authAppearance.js');
 const classes=new Set(),metas=new Map();
 const root={dataset:{},classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)},ownerDocument:{querySelector:name=>({setAttribute:(key,value)=>metas.set(name,value)})}};
 assert.equal(applyAuthAppearance(false,root),'public');assert.ok(classes.has('dark'));
 assert.equal(applyAuthAppearance(true,root),'workspace');assert.ok(!classes.has('dark'));
 assert.equal(applyAuthAppearance(false,root),'public');assert.ok(classes.has('dark'));
 const source=read('src/supabase/authAppearance.js');assert.doesNotMatch(source,/localStorage|matchMedia|member_admissions|functions\.invoke/);
});

test('shared wordmarks use exact names and brand-specific X treatment in active headers and footers',()=>{
 const wordmark=read('src/supabase/BrandWordmark.jsx');
 const shell=read('src/supabase/OriginalShell.jsx');
 const app=read('src/supabase/SupabaseApp.jsx');
 const html=read('index.html');
 const manifest=JSON.parse(read('public/manifest.json'));
 assert.match(wordmark,/content:'Content ConnectX'/);
 assert.match(wordmark,/host:'Host ConnectX'/);
 assert.match(wordmark,/#12698f/);
 assert.match(wordmark,/linear-gradient/);
 assert.match(shell,/<BrandWordmark brand="content"/);
 assert.match(shell,/<BrandWordmark brand="host"/);
 assert.match(app,/<BrandWordmark brand="host"/);
 assert.match(html,/<title>Content ConnectX<\/title>/);
 assert.match(manifest.name,/^Content ConnectX/);
 assert.doesNotMatch(shell,/CategoryRail|ccx-nav-rail-button|expandedGroup/);
});

test('signed-out discovery displays every original professional icon and no private member information',()=>{
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const categories=read('src/supabase/CategoryArtwork.jsx');
 const css=read('src/supabase/public-brand-theme.css');
 const shell=read('src/supabase/workspace-visual-system.css');
 // The markup uses the same catalog as authenticated Discovery rather than stale copies.
 assert.match(landing,/import \{DISCOVERY_CATEGORIES\} from '.\/CategoryArtwork'/);
 assert.match(landing,/DISCOVERY_CATEGORIES\.filter\(item=>item\.key!=='chef'\)\.map\(item=>/);
 assert.match(landing,/data-public-discovery-icons="true"/);
 assert.match(landing,/Discover a network of/);
 assert.match(landing,/href="\/signup"/);
 assert.match(categories,/Videographer\.png/);
 assert.match(categories,/Video%20Editor\.png/);
 assert.match(css,/ccx-home-discovery-grid/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/--ccx-gradient:linear-gradient\(112deg,#12698f/);
 assert.match(shell,/\.ccx-sister-brand-footer\{margin:0!important;width:100%/);
 assert.match(shell,/--cc-action:#12698f/);
});

test('signed-in partner footer uses viewport center, never sidebar compensation',()=>{
 const shell=read('src/supabase/OriginalShell.jsx');
 const css=read('src/supabase/workspace-visual-system.css');
 assert.match(shell,/className="ccx-sister-brand-footer-inner"/);
 assert.match(shell,/Production locations and daily rentals:/);
 assert.match(css,/\.ccx-sister-brand-footer-inner\{[\s\S]*?justify-content:center/);
 assert.match(css,/\.ccx-sister-brand-footer-inner\{[\s\S]*?transform:none!important/);
 assert.match(css,/\.ccx-original-shell \.ccx-sister-brand-footer\{[\s\S]*?width:100%!important/);
 assert.doesNotMatch(css,/translateX\(calc\(var\(--ccx-workspace-nav-width/);
 assert.match(css,/\.ccx-sister-brand-footer\{margin:0!important;width:100%/);
});
