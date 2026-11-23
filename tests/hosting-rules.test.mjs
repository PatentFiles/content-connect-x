import test from 'node:test';
import assert from 'node:assert/strict';
import {cancellationQuote,depositQuote,payoutEligibility,payoutQuote} from '../supabase/functions/hosting-operations/hosting-rules.mjs';
const booking={policy:'moderate',rentalCents:10000,startAt:'2026-12-20T12:00:00Z'};
test('advance guest cancellation is fully refundable per selected policy',()=>{
 const r=cancellationQuote({...booking,at:'2026-12-15T12:00:00Z'});
 assert.equal(r.refundableCents,10000);
});
test('moderate policy partial refund',()=>{
 const r=cancellationQuote({...booking,at:'2026-12-19T08:00:00Z'});
 assert.equal(r.refundableCents,5000);
});
test('late guest cancellation returns zero under moderate policy',()=>{
 const r=cancellationQuote({...booking,at:'2026-12-20T10:00:00Z'});
 assert.equal(r.refundableCents,0);
});
test('host cancellation always quotes full refund',()=>{
 const r=cancellationQuote({...booking,at:'2026-12-20T10:00:00Z',initiator:'host'});
 assert.equal(r.refundableCents,10000);
});
test('strict policy staged refund',()=>{
 const r=cancellationQuote({...booking,policy:'strict',at:'2026-12-16T12:00:00Z'});
 assert.equal(r.refundableCents,5000);
});
test('invalid monetary input is rejected',()=>{
 assert.throws(()=>depositQuote({rentalCents:-5,percent:10}));
 assert.throws(()=>payoutQuote({capturedCents:10,refundedCents:11}));
});
test('deposit quote uses cents safely',()=>{
 assert.equal(depositQuote({rentalCents:10005,percent:20}),2001);
});
test('payout requires verification, settled rental and no disputes',()=>{
 const ok=payoutEligibility({bookingStatus:'completed',legalStatus:'signed',paymentStatus:'captured',
 hostVerified:true,accountVerified:true,openClaim:false,openRefund:false});
 assert.equal(ok.eligible,true);
 const bad=payoutEligibility({bookingStatus:'accepted',legalStatus:'draft',paymentStatus:'pending',
 hostVerified:false,accountVerified:false,openClaim:true,openRefund:true});
 assert.equal(bad.eligible,false);
 assert.ok(bad.reasons.length>=5);
});
test('quoted payout nets refund and fee without inventing settlement',()=>{
 assert.deepEqual(payoutQuote({capturedCents:10000,refundedCents:2000,feeBasisPoints:1000}),
  {grossCents:8000,platformFeeCents:800,hostPayoutCents:7200});
});

/** Regression: Date.parse normalizes impossible civil dates unless round-tripped. */
test('impossible booking dates fail closed without changing a valid selection',async()=>{
 const {isCalendarDate,nightsBetween,validRange,venueDateToIso,selectionForDay}=await import('../src/supabase/hostingDateRange.mjs');
 for(const date of ['2026-02-29','2026-02-30','2026-04-31','2026-13-01','2026-01-00','2026-01-32']){
  assert.equal(isCalendarDate(date),false,date);
  assert.equal(nightsBetween(date+'T15:00','2026-05-02T15:00'),0,date);
  assert.equal(validRange(date+'T15:00','2026-05-02T15:00'),false,date);
  assert.throws(()=>venueDateToIso(date,'UTC'),/booking calendar date/);
  assert.deepEqual(selectionForDay(date,'2026-02-28T15:00',''),{start:'2026-02-28T15:00',end:''});
 }
 assert.equal(isCalendarDate('2028-02-29'),true);
 assert.equal(nightsBetween('2028-02-29T15:00','2028-03-01T15:00'),1);
 assert.equal(venueDateToIso('2028-02-29','UTC'),'2028-02-29T15:00:00.000Z');
});
