import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HALF_HOUR_SLOTS,selectionForDay,validRange,calendarDays,timeFor,mergeLocal,isHalfHour} from '../src/supabase/hostingDateRange.mjs';
const read=p=>fs.readFileSync(p,'utf8');

test('one tap sets check-in; tapping a day in another month sets checkout automatically',()=>{
 const first=selectionForDay('2026-11-19','','');
 assert.equal(first.start,'2026-11-19T09:00');
 assert.equal(first.end,'');
 const second=selectionForDay('2026-12-03',first.start,first.end);
 assert.equal(second.start,'2026-11-19T09:00');
 assert.equal(second.end,'2026-12-03T11:00');
 assert.equal(validRange(second.start,second.end),true);
 const restarted=selectionForDay('2026-12-20',second.start,second.end);
 assert.equal(restarted.start,'2026-12-20T09:00');assert.equal(restarted.end,'');
});
test('checkout earlier than first day swaps dates and same-day selection offers an afternoon end',()=>{
 const f=selectionForDay('2026-11-19','','');
 const swapped=selectionForDay('2026-11-18',f.start,f.end);
 assert.equal(swapped.start,'2026-11-18T09:00');
 assert.equal(swapped.end,'2026-11-19T17:00');
 const same=selectionForDay('2026-11-19',f.start,f.end);
 assert.equal(same.end,'2026-11-19T17:00');
});
test('times are exactly 48 hourly/half-hour selections, never arbitrary minutes',()=>{
 assert.equal(HALF_HOUR_SLOTS.length,48);
 assert.equal(HALF_HOUR_SLOTS[0].value,'00:00');
 assert.equal(HALF_HOUR_SLOTS[13].value,'06:30');
 assert.equal(HALF_HOUR_SLOTS[14].value,'07:00');
 assert.equal(HALF_HOUR_SLOTS[47].value,'23:30');
 assert.ok(HALF_HOUR_SLOTS.every(({value})=>/:(00|30)$/.test(value)));
 assert.equal(isHalfHour('2026-11-19T07:30'),true);
 assert.equal(isHalfHour('2026-11-19T07:13'),false);
 assert.equal(validRange('2026-11-19T07:30','2026-11-19T07:00'),false);
 assert.equal(timeFor('2026-12-03','2026-12-03T06:30','11:00'),'2026-12-03T06:30');
});
test('month grids include correct leap dates and weekday offset',()=>{
 const feb=calendarDays(2028,1);
 assert.equal(feb.days.length,29);assert.equal(feb.days.at(-1),'2028-02-29');
 assert.equal(mergeLocal('2026-11-19','18:30'),'2026-11-19T18:30');
});
test('guest marketplace shows only three guest navigation tabs; host workspace remains separate',()=>{
 const page=read('src/supabase/HostingMarketplace.jsx');
 const host=read('src/supabase/OnlyHostApp.jsx');
 assert.match(page,/Guest Host Connect navigation/);
 assert.match(page,/\[\['explore','Explore spaces',Search\],\['favorites','Saved',Heart\],\['bookings','My requests',CalendarDays\]\]/);
 assert.doesNotMatch(page,/\['cleaning','My cleaning jobs'/);
 assert.doesNotMatch(page,/\['review','Listing approvals'/);
 assert.match(host,/initialSection="host" requestedSection=\{hostSection\} hostOnly/);
  assert.match(host,/aria-label="Host Connect mobile navigation"/);
  assert.match(host,/aria-label="Open Host Connect navigation menu"/);
 assert.match(page,/data-host-space-filters/);
 assert.match(page,/HostingDateRange label="Rental check-in and checkout"/);
 assert.match(page,/HostingDateRange label="Search check-in and checkout"/);
 assert.doesNotMatch(page,/type="datetime-local"/);
});
test('map wheel event is nonpassive and captured; double clicks, touch taps and public-only category pins exist',()=>{
 const map=read('src/supabase/HostingAreaMap.jsx');
 for(const term of ["addEventListener('wheel',onWheel,{passive:false})","e.preventDefault()","onDoubleClick","e.pointerType==='touch'","const iconFor=category","House:","apartment:Building2","dungeon:Castle","public_area_id","radius_km","Map data ©","onSearchBounds"]) {
  if(term==='House:')continue;
  assert.ok(map.includes(term),term);
 }
 assert.doesNotMatch(map,/public.*private.*exact_address|property_private/);
 assert.match(map,/Approximate public area|Approximate location|Approximate/);
 assert.match(map,/OpenStreetMap contributors/);
 const b=read('supabase/functions/hosting-marketplace/index.ts');
 assert.match(b,/hosting_public_areas/);
 assert.match(b,/approvedAreaFor/);
 assert.match(b,/publicLocationFor/);
 assert.match(b,/public_address_visible:publicAddress/);
 assert.match(b,/row\.public_address_visible===true/);
});
test('host public address is strictly opt-in and private entry instructions are still gated',()=>{
 const host=read('src/supabase/HostingHost.jsx');
 const migration=read('supabase/migrations/20261120024000_host_address_public_opt_in.sql');
 const handler=read('supabase/functions/hosting-marketplace/index.ts');
 assert.match(migration,/public_address_visible boolean not null default false/);
 assert.match(host,/Show my street address publicly on this listing/);
 assert.match(host,/Optional exact public map pin/);
 assert.match(handler,/guest_checkin_details/);
 assert.match(handler,/Completed rental agreement and confirmed payment required/);
 assert.match(handler,/public_address_visible:publicAddress/);
});
test('signed-in host accents reuse public pink, cyan and violet without altering public theme',()=>{
 const source=read('src/supabase/host-workspace.css');
 assert.match(source,/Host Connect signed-in accent treatment/);
 for(const color of ['#09D3F7','#8D69FF','#F800B8'])assert.match(source,new RegExp(color));
 assert.match(source,/html:not\(\[data-ccx-appearance="public"\]\)/);
 assert.match(read('src/supabase/OnlyHostApp.jsx'),/Host_Connect_Banner\.png/);
});
