/**
 * agreementLogger
 * Thin helper to write an AgreementAcceptanceLog record from the frontend.
 * Call this whenever a user clicks "I accept" on any agreement/disclosure.
 *
 * Usage:
 *   import { logAgreementAcceptance } from '@/lib/agreementLogger';
 *   await logAgreementAcceptance({
 *     userId: user.email,
 *     agreementType: 'property_booking',
 *     agreementVersion: '1.0',
 *     agreementTextSnapshot: fullText,
 *     checkboxPayload: { liability_ack: true, no_smoking: true },
 *     sessionId: session.id,
 *     propertyId: property.id,
 *   });
 */

import { base44 } from '@/api/base44Client';

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.agreementType  - enum value from AgreementAcceptanceLog.agreement_type
 * @param {string} [opts.agreementVersion]
 * @param {string} [opts.agreementTextSnapshot]
 * @param {object} [opts.checkboxPayload]
 * @param {string} [opts.sessionId]
 * @param {string} [opts.collaborationId]
 * @param {string} [opts.propertyId]
 * @param {string} [opts.contractId]
 * @param {string} [opts.externalParticipantName]
 * @param {object} [opts.metadata]
 */
export async function logAgreementAcceptance({
  userId,
  agreementType,
  agreementVersion = '1.0',
  agreementTextSnapshot,
  checkboxPayload,
  sessionId,
  collaborationId,
  propertyId,
  contractId,
  externalParticipantName,
  metadata,
}) {
  if (!userId || !agreementType) {
    console.warn('[agreementLogger] Missing required fields — skipping log');
    return null;
  }
  try {
    const record = await base44.entities.AgreementAcceptanceLog.create({
      user_id: userId,
      agreement_type: agreementType,
      agreement_version: agreementVersion,
      agreement_text_snapshot: agreementTextSnapshot,
      accepted_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      ip_address: null, // populated server-side if available
      session_id: sessionId || null,
      collaboration_id: collaborationId || null,
      property_id: propertyId || null,
      contract_id: contractId || null,
      checkbox_payload: checkboxPayload || null,
      external_participant_name: externalParticipantName || null,
      metadata: metadata || null,
    });
    return record;
  } catch (err) {
    // Non-fatal — log but don't block the user flow
    console.error('[agreementLogger] Failed to write acceptance log:', err);
    return null;
  }
}