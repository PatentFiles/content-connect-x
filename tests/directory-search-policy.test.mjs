import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryFilters,escapeLikeLiteral,DIRECTORY_ROLES} from '../supabase/functions/directory/searchPolicy.mjs';

test('only supported public creator roles can be filtered',()=>{
 for(const role of DIRECTORY_ROLES){
  assert.equal(directoryFilters({role},true).role,role);
 }
 assert.throws(()=>directoryFilters({role:'admin'},true),/Unsupported creator type/);
 assert.throws(()=>directoryFilters({role:'anything.invalid'},true),/Unsupported creator type/);
});

test('free discovery uses a small page size but permits worldwide pagination',()=>{
 const filters=directoryFilters({offset:900000,limit:9999},false);
 assert.equal(filters.limit,12);
 assert.equal(filters.offset,480);
 const paid=directoryFilters({offset:25,limit:9999},true);
 assert.equal(paid.limit,24);
 assert.equal(paid.offset,25);
 assert.equal(directoryFilters({offset:-100},true).offset,0);
 assert.equal(directoryFilters({offset:NaN},true).offset,0);
 assert.equal(directoryFilters({offset:100000},true).offset,480);
});

test('normalize query, location and ignored client-only fields',()=>{
 const result=directoryFilters({
  query:'   Joan  \n  Doe % ',
  city:'  Los \u0000 Angeles  ',
  country:' US  ',
  role:'VIDEOGRAPHER',
  include_private:true,subscription:'premium'
 },true);
 assert.deepEqual(result,{query:'Joan Doe %',city:'Los Angeles',country:'US',
  role:'videographer',state:'',category:'',gender:'',ids:null,limit:24,offset:0});
 assert.equal(directoryFilters({query:'X'.repeat(500)}).query.length,80);
});

test('escape LIKE wildcards and backslashes as literal user query text',()=>{
 assert.equal(escapeLikeLiteral('50%_\\abc'),'50\\%\\_\\\\abc');
 assert.equal(escapeLikeLiteral('hello'),'hello');
});

test('validate compatibility search values and privacy-safe IDs',()=>{
 assert.deepEqual(directoryFilters({category:'FETISH',gender:'WOMAN'}).category,'fetish');
 assert.equal(directoryFilters({gender:'trans_woman'}).gender,'trans_woman');
 assert.throws(()=>directoryFilters({gender:'private-gender'}),/Unsupported gender identity/);
 assert.throws(()=>directoryFilters({category:'unknown'}),/Unsupported content category/);
 const id='11111111-1111-4111-8111-111111111111';
 const result=directoryFilters({ids:[id,'invalid',id],state:' California '},true);
 assert.deepEqual(result.ids,[id]);
 assert.equal(result.state,'California');
});
