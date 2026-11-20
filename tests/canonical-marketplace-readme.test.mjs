import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const readme=readFileSync('README.md','utf8');
test('canonical developer README describes current Bolt, Supabase and Railway authority',()=>{
 assert.match(readme,/^# Content Connect X \/ Host Connect — Developer ReadMe/m);
 assert.match(readme,/\*\*Bolt\*\*/);
 assert.match(readme,/\*\*Supabase\*\*/);
 assert.match(readme,/\*\*Railway\*\*/);
 assert.doesNotMatch(readme,/(?:Base44|base44)/i);
});
test('no unvalidated provider claims or explicit-media distribution promise in canonical doc',()=>{
 assert.match(readme,/production self-hosted ID verification[^\n]*\*\*Disabled\*\*/i);
 assert.match(readme,/Public trust\/safety report intake[^\n]*\*\*Was disabled Nov 19\*\*/i);
 assert.match(readme,/Public safety reports[\s\S]*ccx_trust_public_config\(\)\.ready=true/i);
 assert.match(readme,/not sell, host for public distribution, publish, distribute, or monetize explicit audiovisual content/i);
 assert.match(readme,/Adding a key alone is insufficient/i);
});
test('legacy feature appendix remains at the bottom for review/replace/retire decisions',()=>{
 const marker='## 15. Legacy capability decision register';
 const start=readme.indexOf(marker);
 assert.ok(start>0);
 const appendix=readme.slice(start);
 const candidates=appendix.split('\n').filter(line=>/^\|/.test(line)&&/REBUILD|REPLACE|RETIRE|REEVALUATE|DEFER/.test(line));
 assert.ok(candidates.length>=35, 'missing old platform feature disposition candidates');
 assert.doesNotMatch(appendix,/^## 16\./m);
});
