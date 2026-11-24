import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFESSIONAL_ROLES,DEFAULT_PREMIUM_PLANS,FREE_BENEFITS,ROLE_BENEFITS,MEMBERSHIP_TERMS,membershipTermPrice} from '../src/supabase/membershipCatalog.mjs';
import {isFreeAction,localContactStatus,milesBetween} from '../supabase/functions/member-workflows/contactPolicy.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('monthly pricing excludes Host and includes configured agent capacities',()=>{
 assert.equal(PROFESSIONAL_ROLES.some(p=>p.id==='host'),false);
 assert.deepEqual(DEFAULT_PREMIUM_PLANS.slice(0,8).map(p=>p.monthly_cents),[1999,2999,4999,4999,4999,9999,24999,24999]);
 assert.equal(DEFAULT_PREMIUM_PLANS.length,15);
 for(const role of PROFESSIONAL_ROLES)assert.ok(DEFAULT_PREMIUM_PLANS.some(p=>p.role_type===role.id));
 assert.deepEqual(DEFAULT_PREMIUM_PLANS.filter(p=>p.role_type==='agent').map(p=>p.roster_seats),[10,25,null]);
 assert.equal(FREE_BENEFITS.some(s=>s.includes('25-mile')),true);
 for(const role of PROFESSIONAL_ROLES)assert.ok(ROLE_BENEFITS[role.id].items.length>=2,role.id+' needs a description without invented paid plans');
});
test('five local contact actions are separately gated from premium collaboration features',()=>{
 for(const a of ['request_connection','respond_connection','send_message','list_messages','list_notifications'])assert.equal(isFreeAction(a),true);
 for(const a of ['create_contract','create_collaboration','create_group_conversation','view_social_links'])assert.equal(isFreeAction(a),false);
});
test('same-city and mapped-city access use a strict 25 mile cutoff',()=>{
 const la={city:'Los Angeles',state:'CA',country:'United States'};
 const nearby={city:'West Hollywood',state:'CA',country:'US'};
 const far={city:'San Francisco',state:'CA',country:'United States'};
 const areas=[
  {...la,region:'CA',latitude:34.05223,longitude:-118.24368},
  {...nearby,region:'CA',latitude:34.09001,longitude:-118.36174},
  {...far,region:'CA',latitude:37.77493,longitude:-122.41942}
 ];
 assert.equal(localContactStatus(la,nearby,areas).allowed,true);
 assert.equal(localContactStatus(la,far,areas).allowed,false);
 assert.equal(localContactStatus(la,{...la},[]).allowed,true);
 assert.equal(localContactStatus({...la,state:''},{...la,state:''},[]).allowed,false);
 assert.ok(milesBetween(areas[0],areas[2])>25);
});
test('unfinished signups see only non-dismissable onboarding and admitted members are checked by Edge',()=>{
 const app=read('src/supabase/SupabaseApp.jsx');
 const gate=read('src/supabase/AgeGateOnboarding.jsx');
 const backend=read('supabase/functions/member-workflows/index.ts');
 assert.match(app,/if\(user&&!approved\)return <AgeGateOnboarding/);
 assert.match(gate,/aria-modal="true"/);
 assert.doesNotMatch(gate,/setModalOpen\(false\)/);
 assert.match(backend,/Complete account onboarding first/);
 assert.match(backend,/from\('member_admissions'\)/);
});
test('private socials require verified paid authorization, never free browser reads',()=>{
 const db=read('supabase/migrations/20261117132747_member_social_links_opt_in.sql');
 const backend=read('supabase/functions/member-workflows/index.ts');
 assert.match(db,/row level security/i);
 assert.match(db,/share_with_premium boolean not null default false/i);
 assert.match(backend,/Professional social links require Premium membership/i);
});

test('free verified member messaging is backed by restrictive Supabase RLS policies',()=>{
 const sql=read('supabase/migrations/20261117134400_verified_free_chat_rls.sql');
 assert.match(sql,/create or replace function ccx_internal\.can_read_premium_chat/);
 assert.match(sql,/latest\.status='approved'/);
 assert.match(sql,/security\.banned or security\.suspended/);
 assert.match(sql,/as restrictive for select to authenticated/i);
 assert.doesNotMatch(sql,/member_subscriptions/);
});

test('all professions and agency tiers have exact monthly and prepaid totals',()=>{
 assert.deepEqual(MEMBERSHIP_TERMS.map(x=>x.days),[30,180,365]);
 for(const plan of DEFAULT_PREMIUM_PLANS){
  const m=membershipTermPrice(plan.monthly_cents,'monthly'),s=membershipTermPrice(plan.monthly_cents,'six_months'),a=membershipTermPrice(plan.monthly_cents,'annual');
  assert.equal(m.total_cents,plan.monthly_cents);
  assert.equal(s.total_cents,Math.round(plan.monthly_cents*6*90/100));
  assert.equal(a.total_cents,Math.round(plan.monthly_cents*12*80/100));
  assert.ok(a.monthly_equivalent_cents<s.monthly_equivalent_cents&&s.monthly_equivalent_cents<m.total_cents);
 }
 assert.equal(membershipTermPrice(1999,'six_months').total_cents,10795);
 assert.equal(membershipTermPrice(1999,'annual').total_cents,19190);
 assert.equal(membershipTermPrice(1999,'invalid'),null);
});
