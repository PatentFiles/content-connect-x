/** Text-only intake; never fetch a submitted URL or accept an evidence upload. */
export const REQUEST_KINDS=Object.freeze(['ncii','trafficking','csam','privacy','support','copyright','law_enforcement','accessibility','affiliate','appeal','other']);
export function validateTrustRequest(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid request.');
 if(!REQUEST_KINDS.includes(raw.kind))throw Error('Choose a request category.');
 if(typeof raw.idempotency_key!=='string'||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(raw.idempotency_key)||!/^[a-f0-9-]+$/i.test(raw.idempotency_key))throw Error('Refresh the form and try again.');
 const payload={};
 for(const field of ['kind','name','email','locator','details','signature','agency','jurisdiction','case_reference','legal_basis','scope']){
  const value=raw[field]??'';
  if(typeof value!=='string'||value.includes('\u0000'))throw Error('Use text values only.');
  const limit=['details','scope'].includes(field)?4000:field==='locator'?3000:254;
  if(value.length>limit)throw Error('One of the fields is too long.');
  payload[field]=value.trim();
 }
 payload.authorized=raw.authorized===true;payload.good_faith=raw.good_faith===true;
 if(payload.details.length<10)throw Error('Describe your request in at least 10 characters.');
 if(payload.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))throw Error('Enter a valid contact email.');
 if(payload.kind==='ncii'&&(!payload.authorized||!payload.good_faith||payload.signature.length<2||!payload.email||payload.locator.length<3))throw Error('A removal request needs a locator, contact email, electronic signature and both declarations.');
 if(payload.kind==='law_enforcement'&&(!payload.email||['agency','jurisdiction','case_reference'].some(k=>payload[k].length<2)||['legal_basis','scope'].some(k=>payload[k].length<5)))throw Error('Provide agency, jurisdiction, official contact, case reference, legal basis and narrow scope.');
 return {payload,idempotency:raw.idempotency_key};
}

/** Report status requires BOTH a reference and the private code provided on
 * its original receipt. Do not grant access from a report ID alone.
 */
export function validateTrustStatus(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.action!=='status')throw Error('Invalid case lookup.');
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 if(typeof raw.reference!=='string'||!uuid.test(raw.reference)||typeof raw.access_code!=='string'||!uuid.test(raw.access_code))
  throw Error('Enter both the receipt reference and private access code.');
 return {reference:raw.reference.toLowerCase(),accessCode:raw.access_code.toLowerCase()};
}
