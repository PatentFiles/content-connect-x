import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoData} from '../supabase/functions/admin-demo-data/demoData.mjs';
import {markerPosition,finitePoint,normalizeBounds,rentalPrice,VENUE_ARTWORK} from '../src/supabase/hostMapPresentation.mjs';
import {venueHourToIso,rentalPeriod} from '../src/supabase/hostRentalPeriod.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('stable fictional dataset stays out of real account and booking identifiers',()=>{
 const a=demoData(),b=demoData();assert.deepEqual(a,b);assert.equal(a.demo,true);assert.equal(a.read_only,true);
 assert.equal(a.profiles.length,18);assert.equal(a.properties.length,14);
 assert.ok(a.profiles.every(x=>x.demo===true&&x.id.startsWith('demo-profile-')&&x.avatar_ref===x.id));
 assert.ok(a.properties.every(x=>x.demo===true&&x.id.startsWith('demo-venue-')&&finitePoint(x)&&VENUE_ARTWORK[x.category]));
 assert.equal(new Set(a.properties.map(x=>x.id)).size,a.properties.length);
 const ui=read('src/supabase/AdminDemoWorkspace.jsx'),edge=read('supabase/functions/admin-demo-data/index.ts');
 assert.doesNotMatch(ui,/supabase\.|functions\.invoke|localStorage|sessionStorage/);
 assert.match(edge,/auth\.getUser\(token\)/);assert.match(edge,/Administrator access required/);
 assert.doesNotMatch(edge,/\.(insert|update|upsert|delete)\(/);
 assert.match(read('src/supabase/useAdminDemo.js'),/record\?\.owner===userId/);
});
test('map markers remain stable, bounded, approximate and pricing is explicit',()=>{
 for(const item of demoData().properties){
  const p=markerPosition(item);assert.deepEqual(p,markerPosition(item));assert.ok(p.every(Number.isFinite));
  assert.ok(Math.abs(p[0]-item.approx_lng)<.02&&Math.abs(p[1]-item.approx_lat)<.02);
  assert.equal(rentalPrice(item,'hour'),item.hourly_rate_cents);
  assert.equal(rentalPrice(item,'day'),item.daily_rate_cents);
 }
 assert.equal(markerPosition({approx_lat:null,approx_lng:0}),null);
 assert.equal(markerPosition({approx_lat:Infinity,approx_lng:0}),null);
 assert.equal(rentalPrice({},'hour'),null);
 assert.deepEqual(normalizeBounds({getWest:()=>170,getEast:()=>190,getSouth:()=>-90,getNorth:()=>90}),{west:170,east:-170,south:-85,north:85});
});
test('hourly periods are venue-local elapsed hours with DST gaps/repeats rejected',()=>{
 const p={timezone:'America/Phoenix',hourly_rate_cents:8500,min_rental_hours:3};
 const a=rentalPeriod(p,'hour','2027-01-12','',9,6);
 assert.equal(a.starts_at,'2027-01-12T16:00:00.000Z');assert.equal(a.ends_at,'2027-01-12T22:00:00.000Z');
 assert.throws(()=>rentalPeriod(p,'hour','2027-01-12','',9,2));assert.throws(()=>rentalPeriod(p,'hour','2027-01-12','',9,25));assert.throws(()=>rentalPeriod({...p,hourly_rate_cents:null},'hour','2027-01-12','',9,6));
 assert.throws(()=>venueHourToIso('2027-03-14',2,'America/New_York'));assert.throws(()=>venueHourToIso('2027-11-07',1,'America/New_York'));
 assert.equal(venueHourToIso('2027-01-12',9,'Asia/Kolkata'),'2027-01-12T03:30:00.000Z');
 const daily=rentalPeriod({...p,timezone:'America/New_York'},'day','2027-03-13','2027-03-14',9,6);
 assert.equal((Date.parse(daily.ends_at)-Date.parse(daily.starts_at))/3600000,23);
});
test('marker and rental logic withstand repeated synthetic evaluations',()=>{
 const rows=demoData().properties;let n=0;
 for(let i=0;i<10000;i++){const p=rows[i%rows.length];const a=markerPosition(p);assert.ok(a.every(Number.isFinite));assert.equal(rentalPrice(p,'hour'),p.hourly_rate_cents);n+=2;}
 assert.equal(n,20000);
});
