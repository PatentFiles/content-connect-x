import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMarketingFixtures,CATEGORY_COUNTS,DEMO_PERSON_ID,DEMO_CLOCK,marketingAssetManifest} from '../src/demo/marketingFixtures.mjs';
import {startDemo,stopDemo,demoSnapshot,demoFunction,demoHostAction,demoQuote,isDemoActive,withDemoData,subscribeDemo} from '../src/demo/demoRuntime.mjs';
import {HOST_VENUE_IDS} from '../src/supabase/hostVenueCategories.mjs';
import {AMENITY_IDS,ACCESSIBILITY_IDS} from '../supabase/functions/_shared/propertyFeatureCatalog.mjs';
const reset=()=>{stopDemo();return startDemo('fixture-authorized-admin');};
test('100 stable LA venues cover the supported taxonomy and requested category minimums',()=>{
 const a=createMarketingFixtures(),b=createMarketingFixtures();assert.deepEqual(a,b);assert.equal(a.properties.length,100);assert.equal(new Set(a.properties.map(p=>p.id)).size,100);assert.equal(new Set(a.properties.map(p=>p.title)).size,100);
 for(const [category,count]of Object.entries(CATEGORY_COUNTS)){assert.ok(HOST_VENUE_IDS.includes(category));assert.equal(a.properties.filter(p=>p.category===category).length,count);}
 for(const p of a.properties){assert.ok(p.approx_lat>33.85&&p.approx_lat<34.3);assert.ok(p.approx_lng>-118.85&&p.approx_lng<-118.05);assert.equal(p.state,'California');assert.equal(p.min_rental_hours,3);assert.ok(p.hourly_rate_cents>0);assert.equal(p.one_day_including_cleaning_cents,p.daily_rate_cents+p.cleaning_fee_cents);assert.ok(p.amenities.every(v=>AMENITY_IDS.includes(v)),p.id+' has unsupported amenities: '+p.amenities.filter(v=>!AMENITY_IDS.includes(v)));assert.ok(p.accessibility_features.every(v=>ACCESSIBILITY_IDS.includes(v)));}
 assert.equal(new Set(a.properties.map(p=>p.approx_lat+','+p.approx_lng)).size,100);
});
test('one shared identity graph populates people, projects, contracts and notifications',()=>{
 const d=createMarketingFixtures(),people=new Map(d.profiles.map(p=>[p.id,p])),places=new Map(d.properties.map(p=>[p.id,p]));
 assert.equal(d.profiles.length,34);assert.equal(d.self.id,DEMO_PERSON_ID);assert.equal(d.agent.display_name,'Jade Ryder');assert.equal(d.groups.length,12);assert.equal(d.products.length,42);assert.equal(d.conversations.length,12);assert.equal(d.contracts.length,8);assert.equal(d.testing.length,6);assert.equal(d.notifications.length,24);
 for(const p of d.profiles){assert.ok(p.age>=25);assert.equal(p.age,p.profile_age);assert.doesNotMatch(p.display_name,/demo profile|\d/i);}
 for(const c of d.conversations){assert.deepEqual(c.peer,people.get(c.peer_user_id));assert.ok(d.messages.filter(m=>m.conversation_id===c.id).length>=5);}
 for(const c of d.collaborations){assert.equal(c.plan.property_id,c.property_id);assert.equal(c.plan.venue_label,places.get(c.property_id).title);for(const p of c.participants)assert.equal(p.display_name,people.get(p.id).display_name);}
 for(const b of d.bookings){assert.equal(b.title,places.get(b.property_id).title);assert.equal(b.cover_url,places.get(b.property_id).cover_url);assert.equal(b.total_cents,places.get(b.property_id).one_day_including_cleaning_cents);}
 for(const n of d.notifications){assert.ok(d.conversations.some(c=>c.id===n.details.conversation_id));assert.ok(d.groups.some(g=>g.id===n.details.group_id));assert.ok(d.collaborations.some(c=>c.id===n.details.collaboration_id));}
 assert.equal(d.recap.metrics.completed_projects,d.collaborations.filter(c=>c.status==='completed').length);assert.equal(d.recap.as_of,DEMO_CLOCK);
});
test('approved image overrides propagate without replacing identity or property records',()=>{
 const assets={'demo-la-venue-001':{cover_url:'/demo-assets/properties/demo-la-venue-001.webp'},'demo-person-jade-ryder':{avatar_url:'/demo-assets/people/demo-person-jade-ryder.webp'}};
 const d=createMarketingFixtures(assets);assert.equal(d.bookings[0].cover_url,d.properties[0].cover_url);assert.equal(d.representation.avatar_url,d.agent.avatar_url);assert.equal(d.conversations[0].peer.avatar_url,d.agent.avatar_url);
 const manifest=marketingAssetManifest(d);assert.equal(manifest.length,176);assert.equal(manifest.filter(a=>a.status==='approved').length,2);assert.ok(manifest.every(a=>a.width>0&&a.height>0&&a.brief.length>30));
});
test('unknown demo calls never fall through to any live service and auth remains real',async()=>{
 let realCalls=0;const live={auth:{getSession:()=>({actual:true})},functions:{invoke:async()=>{realCalls++;return {data:{live:true},error:null};}},rpc:async()=>{realCalls++;return {data:{live:true},error:null};},from:()=>{realCalls++;throw Error('Unexpected live table read');},storage:{},channel:()=>{realCalls++;throw Error('Unexpected live channel');}};
 const client=withDemoData(live);reset();assert.equal(client.auth,live.auth);
 for(const name of ['payment-capture','admin-approve','identity-upload','unknown']){const r=await client.functions.invoke(name,{body:{action:'execute'}});assert.ok(r.error);}
 assert.ok((await client.rpc('production_permission_grant',{})).error);assert.equal(realCalls,0);
 assert.equal((await client.from('member_profiles').select('*').eq('id',DEMO_PERSON_ID).single()).data.display_name,'Tommy Ryder');
 const stale=client.from('member_profiles').select('*');stopDemo();assert.ok((await stale).error);assert.equal(realCalls,0);
 assert.ok((await client.functions.invoke('member-workflows',{body:{action:'send_message',conversation_id:'demo-conversation-0',message:'Must not reach a live service'}})).error);
 assert.ok((await client.rpc('any-write',{p_data:{target_id:'demo-person-jade-ryder'}})).error);assert.equal(realCalls,0);
 assert.equal((await client.functions.invoke('real-service',{body:{}})).data.live,true);assert.equal(realCalls,1);assert.equal(isDemoActive(),false);
});
test('demo messages and profile edits update locally and reset between recordings',async()=>{
 const d=reset(),client=withDemoData({functions:{},rpc(){},from(){throw Error('Live write');},auth:{},storage:{}}),c=d.conversations[0];
 const before=d.messages.length;demoFunction('member-workflows',{action:'send_message',conversation_id:c.id,message:'The revised call sheet is ready.'});assert.equal(demoSnapshot().messages.length,before+1);assert.equal(c.last_message_preview,'The revised call sheet is ready.');
 const result=await client.from('member_profiles').update({display_name:'Tommy Ryder',bio:'A locally edited demo biography.'}).eq('id',DEMO_PERSON_ID);assert.equal(result.error,null);assert.equal(demoSnapshot().self.bio,'A locally edited demo biography.');
 const forbidden=await client.from('member_profiles').update({age_verified:true,admin:true}).eq('id',DEMO_PERSON_ID);assert.ok(forbidden.error);
 reset();assert.equal(demoSnapshot().messages.length,before);assert.notEqual(demoSnapshot().self.bio,'A locally edited demo biography.');stopDemo();
});
test('quotes enforce minimum duration and capacity, and add the cleaning fee exactly once',()=>{
 const d=reset(),p=d.properties[0],start='2026-12-01T18:00:00Z';
 assert.throws(()=>demoQuote(p,{starts_at:start,ends_at:'2026-12-01T20:00:00Z',rental_unit:'hour',crew_size:2}),/three-hour/);
 const q=demoQuote(p,{starts_at:start,ends_at:'2026-12-01T21:00:00Z',rental_unit:'hour',crew_size:2});assert.equal(q.total_cents,p.hourly_rate_cents*3+p.cleaning_fee_cents);assert.equal(q.cleaning_cents,p.cleaning_fee_cents);
 assert.throws(()=>demoQuote(p,{starts_at:start,ends_at:'2026-12-02T18:00:00Z',crew_size:999}),/capacity/);
 assert.throws(()=>demoQuote(p,{starts_at:start,ends_at:start}),/valid/);stopDemo();
});
test('map filtering stays within the selected area and does not mutate the canonical 100',()=>{
 const d=reset(),result=demoHostAction('browse',{categories:['private_beach']});assert.equal(result.items.length,4);assert.equal(d.properties.length,100);
 const r=demoHostAction('browse',{bounds:{west:-118.4,east:-118.2,south:34.05,north:34.16}});assert.ok(r.items.length>0&&r.items.length<100);assert.ok(r.items.every(p=>p.approx_lng>=-118.4&&p.approx_lng<=-118.2));stopDemo();
});
test('fictional verification does not claim a production approval or call an approval action',()=>{
 reset();const r=demoFunction('identity-verification',{action:'status'});assert.equal(r.demo,true);assert.equal(r.session.production_approved,false);assert.throws(()=>demoFunction('identity-verification',{action:'approve'}),/not available/);assert.throws(()=>demoFunction('ccx-integrations',{action:'signature_request'}),/not available/);stopDemo();
});
test('every new dashboard card inherits stripe-free styling and mobile search defaults closed',()=>{
 for(const file of ['workspace-refinement.css','workspace-visual-system.css','workspace-public-palette.css']){const p='src/supabase/'+file;if(fs.existsSync(p))assert.doesNotMatch(fs.readFileSync(p,'utf8'),/\.ccx-dashboard-card(?::nth-child\([^)]*\))?::before/);}
 const source=fs.readFileSync('src/supabase/MarketplaceExplore.jsx','utf8');assert.match(source,/searchOpen,setSearchOpen\]=useState\(false\)/);assert.match(source,/aria-expanded=\{searchOpen\}/);assert.match(source,/HostVenueCategoryRail/);assert.match(source,/venueMatchesTypes/);
 const unsubscribe=subscribeDemo(()=>{});assert.equal(unsubscribe(),undefined);
});
