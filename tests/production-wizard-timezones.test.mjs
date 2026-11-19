import test from 'node:test';
import assert from 'node:assert/strict';
import {localDateTimeToUtc,normalizedTimeZone,validateProductionWizardStep,WIZARD_STEPS} from '../src/supabase/productionWizardPolicy.mjs';
test('each production wizard step has an explicit purpose and final review',()=>{
 assert.deepEqual(WIZARD_STEPS.map(s=>s.id),['project','schedule','scope','people','review']);
 assert.equal(validateProductionWizardStep(0,{title:'  '}),'Enter a project title with at least three characters.');
 assert.match(validateProductionWizardStep(2,{plan:{scope_of_work:' '}}),/scope/i);
 assert.equal(validateProductionWizardStep(0,{title:'Valid production'}),null);
});
test('UTC conversion honors Arizona, Pacific, Australian and European production zones',()=>{
 assert.equal(localDateTimeToUtc('2026-07-01T10:30','America/Phoenix'),'2026-07-01T17:30:00.000Z');
 assert.equal(localDateTimeToUtc('2026-01-15T10:00','America/Los_Angeles'),'2026-01-15T18:00:00.000Z');
 assert.equal(localDateTimeToUtc('2026-07-15T10:00','America/Los_Angeles'),'2026-07-15T17:00:00.000Z');
 assert.equal(localDateTimeToUtc('2026-01-15T12:00','Australia/Sydney'),'2026-01-15T01:00:00.000Z');
 assert.equal(localDateTimeToUtc('2026-07-15T12:00','Europe/London'),'2026-07-15T11:00:00.000Z');
});
test('DST skipped and ambiguous local hours reject instead of silently rescheduling',()=>{
 assert.throws(()=>localDateTimeToUtc('2026-03-08T02:30','America/Los_Angeles'),/does not exist/);
 assert.throws(()=>localDateTimeToUtc('2026-11-01T01:30','America/Los_Angeles'),/occurs twice/);
 assert.equal(localDateTimeToUtc('2026-03-08T03:30','America/Los_Angeles'),'2026-03-08T10:30:00.000Z');
});
test('invalid calendar days, timezone names and missing paired times fail closed',()=>{
 for(const value of ['2026-02-29T11:00','2026-13-01T12:00','2026-12-01T25:30','2032-01-01T99:00'])assert.throws(()=>localDateTimeToUtc(value,'UTC'));
 assert.throws(()=>normalizedTimeZone('Mars/Olympus'),/valid/);
 assert.equal(localDateTimeToUtc('', 'UTC'),null);
 assert.match(validateProductionWizardStep(1,{plan:{timezone:'UTC',starts_at:'2026-11-20T10:00',ends_at:''}}),/both/i);
});
test('no browser-supplied professional may invite themselves',()=>{
 assert.match(validateProductionWizardStep(3,{target:'abc',userId:'abc'}),/cannot invite yourself/i);
});
