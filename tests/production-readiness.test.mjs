import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeProductionReadiness} from '../src/supabase/productionReadinessPolicy.mjs';
const future='2028-03-01T18:00:00.000Z',end='2028-03-01T20:00:00.000Z';
const base=()=>{
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 return {collaboration:{id:'00000000-0000-4000-8000-000000000003',requires_work_clearance:false},
  plan:{starts_at:future,ends_at:end,timezone:'America/Phoenix',city:'Phoenix',venue_label:'Private studio',scope_of_work:'Photography and video editing',property_id:null},
  members:[{user_id:a,admitted:true,restricted:false},{user_id:b,admitted:true,restricted:false}],
  invitations:[{status:'accepted'}],
  consents:[{user_id:a,participation_consent:true,revoked_at:null},{user_id:b,participation_consent:true,revoked_at:null}],
  contracts:[{status:'signed',locked_at:'2027-01-01T12:00:00.000Z',signatures:[{signer_id:a},{signer_id:b}]}]};
};
test('no production record is ever authorized by browser checklist alone',()=>{
 assert.equal(summarizeProductionReadiness(null).canAuthorize,false);
 const summary=summarizeProductionReadiness(base(),{now:'2027-01-01T00:00:00.000Z'});
 assert.equal(summary.total,8);
 assert.equal(summary.complete,8);
 assert.equal(summary.canAuthorize,false);
});
test('unverified or restricted participants and unaccepted invitations fail closed',()=>{
 const detail=base();detail.members[1].restricted=true;detail.invitations.push({status:'pending'});
 const out=summarizeProductionReadiness(detail,{now:'2027-01-01T00:00:00.000Z'});
 assert.equal(out.items.find(x=>x.id==='identity').status,'action_required');
 assert.equal(out.items.find(x=>x.id==='participants').status,'action_required');
 assert.equal(out.canAuthorize,false);
});
test('withdrawn participant consent, unsigned draft and proposed property never count as ready',()=>{
 const detail=base();
 detail.consents[0].revoked_at='2027-01-01T03:00:00.000Z';
 detail.contracts[0].locked_at=null;detail.plan.property_id='00000000-0000-4000-8000-000000000004';
 const out=summarizeProductionReadiness(detail,{now:'2027-01-01T00:00:00.000Z'});
 for(const id of ['consent','signatures','venue'])assert.equal(out.items.find(x=>x.id===id).status,'action_required');
});
test('required work clearance remains pending until verified by an authorized backend',()=>{
 const detail=base();detail.collaboration.requires_work_clearance=true;
 assert.equal(summarizeProductionReadiness(detail,{now:'2027-01-01T00:00:00.000Z'}).items.find(x=>x.id==='clearance').status,'action_required');
});
test('past and invalid time zones cannot be shown as a scheduled future production',()=>{
 const detail=base();
 detail.plan.starts_at='2000-01-01T00:00:00.000Z';
 assert.equal(summarizeProductionReadiness(detail,{now:'2027-01-01T00:00:00.000Z'}).items.find(x=>x.id==='schedule').status,'action_required');
});
