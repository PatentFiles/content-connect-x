/** End-to-end source invariants for whole-day Host Connect rentals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nightsBetween,validRange,venueDateToIso} from '../src/supabase/hostingDateRange.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('only venue-local whole days may be booked, even at DST transitions',()=>{
 assert.equal(nightsBetween('2026-03-07T15:00','2026-03-09T15:00'),2);
 assert.equal(validRange('2026-03-07T15:00','2026-03-09T15:00'),true);
 assert.equal(validRange('2026-03-07T09:00','2026-03-09T17:00'),false);
 assert.equal(validRange('2026-03-07T15:00','2026-03-07T15:00'),false);
 assert.equal(validRange('2026-03-07T15:00','2027-07-02T15:00'),false);
 const zone='America/New_York';
 const springA=venueDateToIso('2026-03-07',zone),springB=venueDateToIso('2026-03-08',zone);
 assert.equal((Date.parse(springB)-Date.parse(springA))/3600000,23);
 const fallA=venueDateToIso('2026-10-31',zone),fallB=venueDateToIso('2026-11-01',zone);
 assert.equal((Date.parse(fallB)-Date.parse(fallA))/3600000,25);
});
test('host and guest screens use daily rates without 72-hour cap',()=>{
 const listing=read('src/supabase/HostingMarketplace.jsx');
 const host=read('src/supabase/HostingHost.jsx');
 const card=read('src/supabase/HostPortfolio.jsx');
 const picker=read('src/supabase/HostingDateRange.jsx');
 const market=read('src/supabase/HostMarketExplorer.jsx');
 const amenity=read('src/supabase/HostingEquipmentManager.jsx');
 assert.match(listing,/venueDateToIso\(datePortion\(starts\),item\.timezone\)/);
 assert.match(listing,/nightsBetween\(starts,ends\)/);
 assert.match(listing,/Calculate daily rental quote/);
 assert.doesNotMatch(listing,/hours>72|maximum of 72 hours|Max \$\/hr/);
 assert.match(listing,/requestedSection=null/); // preserve newer mobile navigation.
 assert.match(host,/daily_rate:800/);
 assert.match(host,/Daily rental rate \(USD\)/);
 assert.match(card,/listing\.daily_rate/);
 assert.match(market,/v\.daily_rate/);
 assert.match(amenity,/a\.daily_cents/);
 assert.match(picker,/DAILY_CHECKIN_TIME/);
 assert.doesNotMatch(picker,/HALF_HOUR_SLOTS/);
});
test('backend validates daily pricing and SQL enforces local-day quotes and direct booking integrity',()=>{
 const backend=read('supabase/functions/hosting-marketplace/index.ts');
 const sql=read('supabase/sql/host_daily_local_quotes_reconciled.sql');
 assert.match(backend,/daily_rate:number\('daily_rate'/);
 assert.match(backend,/category,hourly_rate:rate,daily_rate:daily/);
 assert.match(backend,/query=query\.lte\('daily_rate',max\)/);
 assert.match(backend,/!Number\.isFinite\(daily\)\|\|daily<1\|\|daily>100000/);
 assert.match(sql,/ALTER TABLE public\.properties ADD COLUMN IF NOT EXISTS daily_rate/i);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.ccx_hosting_price_quote/i);
 assert.match(sql,/rental_days:=local_end-local_start/);
 assert.match(sql,/AT TIME ZONE prop\.timezone/);
 assert.match(sql,/CREATE TRIGGER ccx_hosting_daily_booking_guard/i);
 assert.match(sql,/NEW\.daily_rate_snapshot:=daily/);
});
