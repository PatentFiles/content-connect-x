/** Client preview of the database's narrow solicitation guard.
 * This is UX only: the PostgreSQL trigger is authoritative even for direct API writes.
 * Do not block discussions of safety, legal advocacy, or ordinary production fees.
 */
const patterns=[
 /\b(?:sex(?:ual)? (?:acts?|services?|intercourse)) (?:for|in exchange for) (?:money|cash|payment|fees?|donations?)\b/i,
 /\b(?:pay(?:ment)?|cash|money|donation|fee) (?:me )?(?:for|to have) (?:sex|sexual services|intercourse)\b/i,
 /\b(?:book|hire) me (?:for )?(?:escort(?:ing)?|sex(?:ual services)?)\b/i,
 /\b(?:escort(?:ing)?|prostitut(?:ion|ion services)?) (?:bookings?|appointments?|services?|rates?)\b/i,
];
export function bioSafetyMessage(text){
 if(typeof text!=='string')return '';
 return patterns.some(p=>p.test(text))
  ?'Paid sexual services or escort solicitation is not allowed. Describe your professional production services instead.'
  :'';
}
