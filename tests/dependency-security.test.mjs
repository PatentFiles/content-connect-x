import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const pm=require('picomatch');

test('all build consumers resolve the reviewed implementation, not a vulnerable registry copy',()=>{
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 const copies=Object.entries(lock.packages).filter(([path])=>path.endsWith('/picomatch'));
 assert.ok(copies.length>0);
 for(const [path,entry] of copies){assert.equal(entry.link,true,path);assert.equal(entry.resolved,'vendor/picomatch-safe',path);}
 assert.equal(require('picomatch/package.json').name,'@content-connect/picomatch-safe');
 for(const consumer of ['vite','micromatch','tinyglobby','anymatch','readdirp']){
  const child=createRequire(require.resolve(consumer));
  assert.equal(child.resolve('picomatch'),require.resolve('picomatch'),consumer);
 }
});

test('known repeated-extglob DoS variants fail closed in a bounded subprocess',()=>{
 const child=spawnSync(process.execPath,['-e',`
  const assert=require('node:assert/strict'),pm=require('picomatch');
  for(const pattern of ['+(*)','*(*)','+(*a)','+(a*)','*(a*)','foo/+(*a)/bar','+(@(a|b)*)','@(+(*a)|safe)','+(a|aa)','[+(*)]']){
   for(const f of [p=>pm(p),p=>pm.makeRe(p),p=>pm.parse(p),p=>pm.scan(p)]){
    assert.throws(()=>f(pattern),e=>e.code==='ERR_UNSAFE_REPEATED_EXTGLOB');
   }
  }
 `],{cwd:process.cwd(),timeout:3000,encoding:'utf8'});
 assert.equal(child.error,undefined,'security regressions must not hang the test process');
 assert.equal(child.status,0,child.stderr);
});

test('normal build glob behavior is preserved',()=>{
 assert.equal(pm('src/**/*.{js,jsx}')('src/components/Button.jsx'),true);
 assert.equal(pm('src/**/*.{js,jsx}')('src/components/Button.css'),false);
 assert.equal(pm('**/*.js',{ignore:'**/node_modules/**'})('src/node_modules/a.js'),false);
 assert.equal(pm('**/.*',{dot:true})('src/.env'),true);
 assert.equal(pm('*.@(js|jsx)')('Button.jsx'),true);
 assert.equal(pm('file?.[jt]s')('file1.ts'),true);
 assert.ok(pm.scan('src/**/*.{js,jsx}').isGlob);
});

test('preparsed and direct fastpath APIs cannot bypass the repeated-pattern guard',()=>{
 assert.throws(()=>pm.compileRe({input:'+(*)',output:'(a+)+',tokens:[]}),e=>e.code==='ERR_UNSAFE_REPEATED_EXTGLOB');
 const parse=require('picomatch/lib/parse');
 assert.throws(()=>parse.fastpaths('+(a*)',{}),e=>e.code==='ERR_UNSAFE_REPEATED_EXTGLOB');
});
