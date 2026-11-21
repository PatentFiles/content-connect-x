import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeTarget,compareManifests,validateManifest,main} from '../ops/restore-drill.mjs';
const source='postgresql://read-only@db.yxuqbygykpfbioslljlf.supabase.co:5432/postgres';
const target='postgresql://restore-owner@db.isolated-recovery.invalid:5432/recovery';

test('restore rehearsal cannot choose a production, same-database or insecure target',()=>{
 assert.equal(safeTarget(source,target,'yxuqbygykpfbioslljlf','isolated-recovery'),true);
 assert.throws(()=>safeTarget(source,source,'yxuqbygykpfbioslljlf','isolated-recovery'));
 assert.throws(()=>safeTarget(source,target,'yxuqbygykpfbioslljlf','yxuqbygykpfbioslljlf'));
 assert.throws(()=>safeTarget(source,'http://not-a-postgres.invalid','yxuqbygykpfbioslljlf','isolated-recovery'));
 assert.throws(()=>safeTarget(source,'postgres://wrong@db.yxuqbygykpfbioslljlf.supabase.co/postgres','yxuqbygykpfbioslljlf','isolated-recovery'));
});

test('private storage manifest rejects duplicate and unverified objects',()=>{
 const valid=[{bucket:'ccx-identity-evidence',key:'owner/object',sha256:'a'.repeat(64),bytes:12}];
 assert.equal(validateManifest(valid).size,1);
 for(const rows of [
  [],[...valid,...valid],
  [{...valid[0],sha256:'not-a-digest'}],
  [{...valid[0],bytes:-1}],
  [{...valid[0],key:''}]
 ])assert.throws(()=>validateManifest(rows));
});

test('restored storage records require identical paths, hashes, byte counts',()=>{
 const original=[{bucket:'signed-contracts',key:'contract-a.pdf',sha256:'a'.repeat(64),bytes:1000},
  {bucket:'member-private',key:'owner/photo.png',sha256:'b'.repeat(64),bytes:1234}];
 assert.equal(compareManifests(original,[...original].reverse()).objects,2);
 assert.throws(()=>compareManifests(original,original.slice(0,1)),/differ/);
 assert.throws(()=>compareManifests(original,original.map((item,i)=>i?{...item,sha256:'c'.repeat(64)}:item)),/differ/);
});

test('no restore can execute without explicit isolated target approval and source/target details',async()=>{
 await assert.rejects(main({}),/missing configuration/i);
 const sourceCode=readFileSync(new URL('../ops/restore-drill.mjs',import.meta.url),'utf8');
 assert.match(sourceCode,/CCX_DRILL_APPROVED/);
 assert.match(sourceCode,/ISOLATED_TARGET_ONLY/);
 assert.match(sourceCode,/--single-transaction/);
 assert.match(sourceCode,/pg_dump/);
 assert.match(sourceCode,/pg_restore/);
 assert.match(sourceCode,/compareManifests\(sourceManifest,targetManifest\)/);
 assert.doesNotMatch(sourceCode,/['\"]--clean['\"]|['\"]--create['\"]|drop database|delete from storage\.objects/i);
});
