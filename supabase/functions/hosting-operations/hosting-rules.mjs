/**
 * Hosting financial policy calculations, independent of payment providers.
 * All values are USD cents (safe integers); NEVER interpret a quote as a refund.
 * These policy schedules require review before merchant activation.
 */
export const cancellationPolicies=Object.freeze({
 flexible:{fullHours:24,halfHours:null},
 moderate:{fullHours:72,halfHours:24},
 strict:{fullHours:168,halfHours:72},
});

function money(cents){
 if(!Number.isSafeInteger(cents)||cents<0||cents>100_000_000)throw Error('Invalid monetary amount');
 return cents;
}

/** Return the proposed maximum refund before processor fees; no money moves. */
export function cancellationQuote({policy,rentalCents,startAt,at,initiator='guest'}){
 money(rentalCents);
 const p=cancellationPolicies[policy];
 if(!p)throw Error('Unrecognized cancellation policy');
 const start=new Date(startAt).getTime(),now=new Date(at).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(now))throw Error('Invalid booking date');
 const hours=(start-now)/3_600_000;
 if(initiator==='host')return {refundableCents:rentalCents,forfeitedCents:0,policy,reason:'host_cancelled'};
 if(initiator!=='guest')throw Error('Invalid cancellation initiator');
 const rate=hours>=p.fullHours?1:(p.halfHours!==null&&hours>=p.halfHours?0.5:0);
 const refundableCents=Math.round(rentalCents*rate);
 return {refundableCents,forfeitedCents:rentalCents-refundableCents,policy,reason:rate===1?'advance_cancel':rate===0.5?'partial_cancel':'late_cancel'};
}

/** Deposit amount is separately authorized by a compatible processor. */
export function depositQuote({rentalCents,percent}){
 money(rentalCents);
 if(!Number.isInteger(percent)||percent<0||percent>50)throw Error('Invalid deposit percentage');
 return Math.round(rentalCents*percent/100);
}

/** Payout cannot be eligible without independent financial and legal evidence. */
export function payoutEligibility({bookingStatus,legalStatus,paymentStatus,hostVerified,accountVerified,openClaim,openRefund}){
 const reasons=[];
 if(bookingStatus!=='completed')reasons.push('booking_incomplete');
 if(legalStatus!=='signed')reasons.push('agreement_not_signed');
 if(!['captured','partially_refunded'].includes(paymentStatus))reasons.push('charge_not_captured');
 if(!hostVerified)reasons.push('host_not_verified');
 if(!accountVerified)reasons.push('payout_account_not_verified');
 if(openClaim)reasons.push('damage_claim_open');
 if(openRefund)reasons.push('refund_pending');
 return {eligible:reasons.length===0,reasons};
}

export function payoutQuote({capturedCents,refundedCents=0,feeBasisPoints=0}){
 money(capturedCents);money(refundedCents);
 if(refundedCents>capturedCents)throw Error('Refund exceeds captured value');
 if(!Number.isInteger(feeBasisPoints)||feeBasisPoints<0||feeBasisPoints>10000)throw Error('Invalid fee basis points');
 const net=capturedCents-refundedCents;
 const fee=Math.round(net*feeBasisPoints/10000);
 return {grossCents:net,platformFeeCents:fee,hostPayoutCents:net-fee};
}
