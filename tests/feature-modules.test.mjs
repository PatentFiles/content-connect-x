import test from 'node:test';
import assert from 'node:assert/strict';
import {featureForTab,isModuleEnabled,MODULE_FEATURES} from '../src/supabase/featureModules.mjs';
test('every major page is a separately switchable module',()=>{
 for(const tab of ['testing','directory','search','favorites','connections','collaborations','contracts','hosting','production']){
  const key=featureForTab(tab);assert.ok(key,tab);
  assert.equal(isModuleEnabled(tab,{[key]:true}),true);
  assert.equal(isModuleEnabled(tab,{[key]:false}),false);
  assert.equal(isModuleEnabled(tab,{}),false);
 }
});
test('verification, core account access and administration cannot be hidden by switches',()=>{
 for(const tab of ['dashboard','profile','verification','settings','controls','integrations','testing-reviews','account-security','consent']){
  assert.equal(featureForTab(tab),null);
  assert.equal(isModuleEnabled(tab,{}),true);
 }
});
test('role aliases share feature flags across navigation and deep links',()=>{
 assert.equal(MODULE_FEATURES.host,MODULE_FEATURES.hosting);
 assert.equal(MODULE_FEATURES['host-settings'],MODULE_FEATURES.hosting);
 assert.equal(MODULE_FEATURES.agreements,MODULE_FEATURES.contracts);
 assert.equal(MODULE_FEATURES.invitations,MODULE_FEATURES.collaborations);
});
