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
