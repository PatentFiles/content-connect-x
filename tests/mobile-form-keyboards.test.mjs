import test from 'node:test';
import assert from 'node:assert/strict';
import {inferInputMode} from '../src/supabase/formKeyboard.mjs';

test('appropriate keyboards for common mobile fields',()=>{
 assert.equal(inferInputMode({type:'email'}),'email');
 assert.equal(inferInputMode({type:'tel'}),'tel');
 assert.equal(inferInputMode({type:'text',label:'Phone number'}),'tel');
 assert.equal(inferInputMode({type:'text',label:'ZIP Code'}),'numeric');
 assert.equal(inferInputMode({type:'number',label:'Crew size'}),'numeric');
 assert.equal(inferInputMode({type:'number',label:'Hourly price',step:'0.01'}),'decimal');
});
test('never interfere with sensitive, file, date or international text fields',()=>{
 assert.equal(inferInputMode({type:'password'}),null);
 assert.equal(inferInputMode({type:'file'}),null);
 assert.equal(inferInputMode({type:'date'}),null);
 assert.equal(inferInputMode({type:'text',label:'Postal code'}),null);
 assert.equal(inferInputMode({type:'text',label:'Street address'}),null);
});
