/** Server-only EVALUATION adapter. It never grants account admission. */
export const EVALUATED_ENGINE_REVISION = '3c6f17f1aba84bc980dc759f6be42f69b576f439';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['passport', 'drivers_license', 'national_id']);
export function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('Invalid identifier');
  return value.toLowerCase();
}
export function imageType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) throw new Error('Invalid image size');
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  // A signature check is NOT an image decoder, malware scan or authenticity check.
  throw new Error('Only JPEG and PNG signatures are accepted');
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
}
async function readJson(response) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) throw new Error('Provider returned non-JSON');
  const reader = response.body.getReader(); const parts = []; let length = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) throw new Error('Provider response exceeds limit');
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Provider returned invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.success !== true) throw new Error('Provider operation unsuccessful');
  return data;
}
export class IdswyftClient {
  #origin; #key; #fetch; #timeout;
  constructor({baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 30000}) {
    if (typeof window !== 'undefined') throw new Error('Server-only adapter');
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Configure one HTTPS origin');
    if (url.hostname === 'idswyft.app' || url.hostname.endsWith('.idswyft.app')) throw new Error('Use a self-hosted origin, not vendor cloud');
    if (typeof apiKey !== 'string' || apiKey.length < 16 || /\s/.test(apiKey)) throw new Error('Invalid server API key');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('Invalid timeout');
    this.#origin = url.origin; this.#key = apiKey; this.#fetch = fetchImpl; this.#timeout = timeoutMs;
  }
  async #request(path, {method = 'GET', body, idempotencyKey} = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.#timeout);
    const headers = {'X-API-Key': this.#key, Accept: 'application/json'};
    try {
      if (idempotencyKey) headers['Idempotency-Key'] = uuid(idempotencyKey);
      if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
      const response = await this.#fetch(`${this.#origin}/api/v2/verify${path}`, {method, headers, body, redirect: 'error', signal: controller.signal});
      // Never include raw upstream error bodies or fetch errors in logs/responses.
      if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
      return await readJson(response);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Provider timed out');
      if (error instanceof Error && /^Provider /.test(error.message)) throw error;
      throw new Error('Provider request failed');
    } finally { clearTimeout(timer); }
  }
  async initialize({subjectId, documentType, issuingCountry, idempotencyKey}) {
    uuid(subjectId); uuid(idempotencyKey);
    if (!TYPES.has(documentType) || !/^[A-Z]{2}$/.test(issuingCountry)) throw new Error('Invalid document metadata');
    const data = await this.#request('/initialize', {method: 'POST', idempotencyKey,
      body: {user_id: subjectId, document_type: documentType, issuing_country: issuingCountry,
        verification_mode: 'full', source: 'api', sandbox: false,
        addons: {aml_screening: false, address_verification: false}}});
    return {verificationId: uuid(data.verification_id)};
  }
  async upload({verificationId, kind, bytes, idempotencyKey, documentType, issuingCountry, livenessMetadata}) {
    uuid(verificationId); uuid(idempotencyKey);
    const routes = {front: 'front-document', back: 'back-document', selfie: 'live-capture'};
    if (!Object.hasOwn(routes, kind)) throw new Error('Invalid evidence kind');
    const type = imageType(bytes); const form = new FormData();
    // Upstream source requires "selfie"; its README example used "image".
    form.append(kind === 'selfie' ? 'selfie' : 'document', new Blob([bytes], {type}), `${kind}.${type === 'image/png' ? 'png' : 'jpg'}`);
    if (kind !== 'selfie') {
      if (!TYPES.has(documentType) || !/^[A-Z]{2}$/.test(issuingCountry)) throw new Error('Document upload requires type and country');
      form.append('document_type', documentType); form.append('issuing_country', issuingCountry);
    }
    if (livenessMetadata !== undefined) {
      if (kind !== 'selfie' || !livenessMetadata || typeof livenessMetadata !== 'object' || Array.isArray(livenessMetadata)) throw new Error('Invalid liveness metadata');
      const json = JSON.stringify(livenessMetadata);
      if (new TextEncoder().encode(json).length > MAX_IMAGE_BYTES) throw new Error('Liveness payload exceeds limit');
      // Relay actual SDK capture evidence; never manufacture a "passed" flag.
      form.append('liveness_metadata', json);
    }
    const data = await this.#request(`/${uuid(verificationId)}/${routes[kind]}`, {method: 'POST', body: form, idempotencyKey});
    if (uuid(data.verification_id) !== uuid(verificationId)) throw new Error('Provider session mismatch');
    return data; // Sensitive: do not log or return wholesale to browsers.
  }
  async status(verificationId) {
    const data = await this.#request(`/${uuid(verificationId)}/status`);
    if (uuid(data.verification_id) !== uuid(verificationId)) throw new Error('Provider session mismatch');
    return data;
  }
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function isAdultOn(dob, onDate) {
  if (!validDate(onDate)) throw new Error('Invalid reference date');
  if (!validDate(dob) || dob > onDate) return null;
  const [y,m,d] = dob.split('-').map(Number); const [cy,cm,cd] = onDate.split('-').map(Number);
  const age = cy-y-(cm<m || (cm===m && cd<d) ? 1 : 0);
  // Conservative March 1 policy for February 29 birthdays; review by jurisdiction.
  return age > 120 ? null : age >= 18;
}
/** Screening only. Even a positive upstream result cannot admit a member. */
export function summarizeEvaluation(data, {verificationId, documentType, onDate}) {
  if (!data || uuid(data.verification_id) !== uuid(verificationId)) throw new Error('Provider session mismatch');
  if (!TYPES.has(documentType)) throw new Error('Unsupported document type');
  const reasons = [];
  if (data.success !== true) reasons.push('provider_not_successful');
  if (data.is_sandbox !== false) reasons.push('sandbox_or_unknown_mode');
  if (data.verification_mode !== 'full') reasons.push('incomplete_flow');
  if (data.status !== 'COMPLETE' || data.final_result !== 'verified') reasons.push('provider_not_verified');
  if (data.front_document_uploaded !== true) reasons.push('front_missing');
  if (documentType !== 'passport' && (data.back_document_uploaded !== true || data.documents_match !== true)) reasons.push('back_not_cross_checked');
  if (data.live_capture_uploaded !== true || data.face_match_passed !== true) reasons.push('face_match_not_passed');
  if (data.liveness_passed !== true) reasons.push('liveness_not_passed');
  const adult = isAdultOn(data.ocr_data?.date_of_birth, onDate);
  if (adult !== true) reasons.push(adult === false ? 'under_18' : 'dob_requires_review');
  const expiry = data.ocr_data?.expiration_date;
  if (!validDate(expiry) || expiry < onDate) reasons.push('expiry_requires_review');
  return Object.freeze({provider: 'idswyft_self_hosted', verification_id: uuid(verificationId),
    upstream_result: ['verified','failed','manual_review'].includes(data.final_result) ? data.final_result : 'pending_or_unknown',
    screening_checks_passed: reasons.length === 0, reasons, review_required: true,
    age_verified: false, admission_granted: false, policy_version: 'ccx-idv-evaluation-v1'});
}
