/**
 * Prevent runtime-only failures when a deployed Supabase Edge Function imports
 * a local source file that is absent from its own deployable function package.
 * Also ensure duplicated webhook cryptographic helpers match canonical sources.
 */
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const root='supabase/functions';
const files=[];
function walk(dir){
  for(const name of readdirSync(dir)){
    const path=join(dir,name);
    if(statSync(path).isDirectory())walk(path);
    else if(/\.(ts|tsx|mjs|js)$/.test(name))files.push(path);
  }
}
walk(root);
const errors=[];
for(const file of files){
  const source=readFileSync(file,'utf8');
  const imports=source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g);
  for(const match of imports){
    const requested=resolve(dirname(file),match[1]);
    if(!existsSync(requested)&&!existsSync(requested+'.ts')&&!existsSync(requested+'.mjs')){
      errors.push(file+': unresolved local Edge dependency '+match[1]);
    }
  }
}
for(const [canonical,mirror] of [
  [root+'/hosting-ccbill/ccbill.ts',root+'/hosting-ccbill-webhook/ccbill.ts'],
  [root+'/hosting-docusign/token.ts',root+'/hosting-docusign-webhook/token.ts']
]){
  assert.ok(existsSync(canonical)&&existsSync(mirror),'Missing cryptographic webhook dependency');
  assert.equal(readFileSync(canonical,'utf8'),readFileSync(mirror,'utf8'),
    'Webhook security helper drift detected: '+mirror);
}
assert.deepEqual(errors,[],errors.join('\n'));
process.stdout.write('PASS '+files.length+' local Edge source files have resolved imports; webhook helpers match\n');
