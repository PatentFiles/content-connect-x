/** Deterministic server policy. Facial age estimation and browser verdicts are never evidence. */
export const POLICY = 'ccx-idv-v2';
export const ENGINE_REVISION = '3c6f17f1aba84bc980dc759f6be42f69b576f439';
export const SCHEMA = 'ccx-idv-engine-v1';
export const MAX_IMAGE = 8 * 1024 * 1024;
export const MAX_CAPTURE = 2 * 1024 * 1024;
export const TYPES = ['passport', 'drivers_license', 'national_id'];
export const PHASES = ['turn1_start','turn1_peak','turn1_return','turn_start','turn_peak','turn_return'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function identifier(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('Invalid identifier');
  return value.toLowerCase();
}
export function legalName(value) {
  if (typeof value !== 'string') throw Error('Enter the full legal name printed on your ID.');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu,' ');
  if (!name || name.length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(name) || !/\p{L}/u.test(name)) throw Error('Enter a valid legal name.');
  return name;
}
// Deliberately not fuzzy: do not silently drop middle names, accents, suffixes or reorder tokens.
export const nameKey = value => legalName(value).toLowerCase();
export function isoDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value ? value : null;
}
export function eligibilityDate(dob) {
  if (!isoDate(dob)) return null;
  const [y,m,d] = dob.split('-').map(Number);
  if (y > 9980) return null;
  // Product policy: in a non-leap eighteenth year Feb 29 is treated as March 1;
  // eligibility starts the NEXT UTC calendar day. This is not a statement of law.
  const birthday = new Date(Date.UTC(y+18,m-1,d));
  birthday.setUTCDate(birthday.getUTCDate()+1);
  return birthday.toISOString().slice(0,10);
}
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function imageMime(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MAX_IMAGE) throw Error('Use a JPEG or PNG no larger than 8 MB.');
  if ([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return 'image/png';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  throw Error('Use a JPEG or PNG image.');
}
export function validateCapture(value, session) {
  if (!value || value.challenge_id !== session.challenge_id || value.challenge_type !== 'head_turn'
      || !Array.isArray(value.directions) || !Array.isArray(session.directions)
      || value.directions.length!==2 || value.directions.some(d=>!['left','right'].includes(d))
      || value.directions.join(',') !== session.directions.join(',')
      || !Array.isArray(value.frames) || value.frames.length !== PHASES.length) throw Error('Capture challenge does not match this session.');
  const duration = value.end_timestamp-value.start_timestamp;
  if (!Number.isFinite(value.start_timestamp) || !Number.isFinite(value.end_timestamp)
      || !Number.isFinite(duration) || duration<16000 || duration>90000) throw Error('Please complete a new live camera capture.');
  for (let i=0;i<PHASES.length;i++) {
    const f=value.frames[i];
    if (f?.phase!==PHASES[i] || typeof f.frame_base64!=='string' || f.frame_base64.length<16 || f.frame_base64.length>200000
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.frame_base64) || f.frame_base64.length%4!==0
        || !Number.isFinite(f.timestamp) || f.timestamp<value.start_timestamp || f.timestamp>value.end_timestamp
        || (i>0 && f.timestamp-value.frames[i-1].timestamp<1000)) throw Error('Invalid camera evidence. Please capture again.');
  }
  for (const offset of [0,3]) if (value.frames[offset+2].timestamp-value.frames[offset].timestamp<8000) throw Error('Complete both camera turns slowly.');
  return value;
}
/** Call only with a response obtained over HTTPS from the server-configured worker. */
export function decide(report, session, today) {
  if (!isoDate(today)) throw Error('Invalid server date');
  const review = reason => ({status:'review_required',reason});
  if (!report || report.schema!==SCHEMA || report.engine_revision!==ENGINE_REVISION
      || report.session_id!==session.id) return review('engine_contract_mismatch');
  for (const kind of ['front','selfie','capture',...(session.document_type==='passport'?[]:['back'])]) {
    if (!/^[a-f0-9]{64}$/.test(session.evidence?.[kind]?.sha256||'') || report.evidence_hashes?.[kind]!==session.evidence[kind].sha256) return review('evidence_mismatch');
  }
  const doc=report.document, face=report.face;
  if (!doc || doc.type!==session.document_type || doc.country!==session.issuing_country) return review('document_mismatch');
  if (doc.fields_confident!==true || doc.cross_checked!==true || doc.authenticity_passed!==true) return review('document_checks_incomplete');
  if (!isoDate(doc.dob) || doc.dob>today || Number(today.slice(0,4))-Number(doc.dob.slice(0,4))>120) return review('birth_date_uncertain');
  if (!isoDate(doc.expiry) || doc.expiry<today) return review('id_expired_or_unclear');
  if (typeof doc.number!=='string' || doc.number.trim().length<3 || doc.number.length>100) return review('document_number_uncertain');
  let readName;
  try { readName=legalName(doc.name); } catch { return review('legal_name_uncertain'); }
  if (face?.matched!==true || !Number.isFinite(face.distance) || face.distance<0 || face.distance>0.5
      || face.liveness_passed!==true || face.frame_identity_passed!==true) return review('face_or_liveness_not_verified');
  const eligible=eligibilityDate(doc.dob);
  if (!eligible) return review('birth_date_uncertain');
  if (today<eligible) {
    const birthday = new Date(`${eligible}T00:00:00Z`); birthday.setUTCDate(birthday.getUTCDate()-1);
    return {status:'age_restricted',reason:today<birthday.toISOString().slice(0,10)?'under_18':'birthday_wait',eligible_on:eligible,legal_name:readName,dob:doc.dob};
  }
  let matches=false;try { matches=nameKey(session.legal_name)===nameKey(readName); } catch { return review('account_name_missing'); }
  if (!matches) return {status:'name_mismatch',reason:'legal_name_mismatch',legal_name:readName,dob:doc.dob,eligible_on:eligible};
  return {status:'approved',reason:'checks_passed',legal_name:readName,dob:doc.dob,eligible_on:eligible};
}
export function publicMessage(status, reason, eligible) {
  if (status==='age_restricted') return reason==='birthday_wait'
    ? `Your eighteenth birthday has arrived, but this service permits entry starting the following day. You may verify again on ${eligible} (UTC).`
    : `The date of birth on your ID indicates that you are under 18. You are not permitted to use Content Connect. You may verify again on ${eligible} (UTC), the day after your eighteenth birthday. If the date was read incorrectly, request a review.`;
  if (status==='name_mismatch') return 'The legal name on your account does not match the name read from your ID. Enter the full legal name printed on your ID, or request a review if it was read incorrectly. Your public display name will not change.';
  if (status==='approved') return 'Your identity and age checks are complete.';
  if (status==='review_required') return 'We could not confidently verify every required check. Your account remains restricted. Request a review or start a new attempt with a clear, valid ID.';
  if (status==='retryable_error') return 'Verification could not finish. Your account remains restricted. Please retry.';
  if (status==='processing') return 'Your ID and live camera capture are being checked.';
  return 'Upload your government-issued ID and complete a live camera capture.';
}
