/** Shared layout contracts: safety nets for future pages, not screenshot assertions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {inventoryControls} from '../scripts/control-layout-audit.mjs';
const globalCSS=fs.readFileSync('src/globals.css','utf8');
const shared=fs.readFileSync('src/control-layout.css','utf8');
const host=fs.readFileSync('src/supabase/host-workspace.css','utf8');

test('shared interaction styles are loaded for both brands at the global entry',()=>{
 assert.match(fs.readFileSync('src/index.css','utf8'),/@import ['"]\.\/control-layout\.css['"]/);
 assert.match(shared,/label:has\(> input:is\(\[type="checkbox"\], \[type="radio"\]\)/);
});
test('native choices cannot regain the negative-margin enlarged hitbox',()=>{
 for(const css of [globalCSS,shared,host])postcss.parse(css).walkRules(rule=>{
  if(!/input[^,{]*\[type[=\s"']+(checkbox|radio)/.test(rule.selector))return;
  rule.walkDecls(decl=>{
   if(/^margin/.test(decl.prop))assert.doesNotMatch(decl.value,/(?:^|\s)-[\d.]/,'Native choice margin cannot be negative: '+rule.selector);
  });
 });
 assert.match(shared,/flex: 0 0 var\(--cc-control-size\)/);
 assert.match(shared,/padding: 0;\s*margin: 0;/);
 assert.doesNotMatch(globalCSS,/\.touch-target::after/,'No overlapping invisible hit targets');
});
test('all current checkbox sites have a clickable label; actions share a wrapping layout',()=>{
 const scan=inventoryControls();
 assert.ok(scan.files>=70,'Inventory must cover all JSX, not a single screenshot');
 assert.ok(scan.labels.length>=34,'Do not narrow the regression fixture to one checkbox');
 assert.equal(scan.labels.length,scan.nativeChoices,'Each native choice needs a label and must appear in the geometry fixtures');
 assert.ok(scan.rows.length>=33,'Shared wrapping covers ordinary action/composer rows');
 assert.match(shared,/\.ccx-action-row\s*\{[^}]*flex-wrap: wrap/s);
 assert.match(shared,/\.ccx-action-row > :where\(button, a\)[\s\S]*?overflow-wrap: anywhere/);
});
test('modal field skin excludes choices, ranges, hidden fields and file inputs',()=>{
 const selector=host.match(/\.oh-dialog input:not\(\[type=checkbox\]\)[^{]+/)?.[0];
 assert.ok(selector);
 for(const type of ['radio','range','file','hidden','button','submit','reset'])assert.ok(selector.includes(`:not([type=${type}])`),type+' must not inherit text field padding');
});
test('choice geometry preserves focus, native semantics, hidden controls and forced colors',()=>{
 assert.match(shared,/\.sr-only, \[hidden\]/);
 assert.match(shared,/:focus-visible/);
 assert.match(shared,/:disabled/);
 assert.match(shared,/@media \(forced-colors: active\)/);
 assert.match(shared,/appearance: auto/);
});
