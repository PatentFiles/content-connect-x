/**
 * ExternalParticipantAttestationModal
 * Shown when a session has external/mixed participants (studios, productions).
 * Requires the booking user to attest to age verification, consent, and legal compliance.
 * Writes to ExternalParticipantAttestation entity + AgreementAcceptanceLog.
 * External participants are NEVER marked as platform-verified.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import { logAgreementAcceptance } from '@/lib/agreementLogger';

const ATTESTATION_TEXT = `EXTERNAL PARTICIPANT ATTESTATION

By submitting this attestation, you confirm the following with respect to all off-platform individuals participating in this session:

1. AGE VERIFICATION — All participants are 18 years of age or older. You have personally examined a valid, government-issued photo ID for each individual prior to the session.

2. CONSENT — Informed, voluntary consent has been obtained from each participant for all activities planned in this session. No participant is under duress or coercion.

3. RECORD-KEEPING — Copies of the identity documents and consent records are retained by you in accordance with all applicable laws and regulations.

4. LEGAL COMPLIANCE — You have complied with and will continue to comply with all applicable local, state, and federal laws and regulations governing this production.

5. PLATFORM NON-VERIFICATION — You acknowledge that off-platform participants are NOT verified by this platform. The platform makes no representation or warranty about their identity, age, or legal status. Responsibility for verification rests solely with you.

Submission of this attestation is a legally binding acknowledgment of the above.`;

const CHECKS = [
  { key: 'all_participants_18_plus', label: 'All participants are 18 years of age or older' },
  { key: 'ids_checked', label: 'I have personally verified a valid government-issued photo ID for each participant' },
  { key: 'consent_obtained', label: 'Informed consent has been obtained from each participant' },
  { key: 'records_maintained', label: 'I am retaining copies of ID documents and consent records as required by law' },
  { key: 'applicable_laws_followed', label: 'All applicable laws governing this production have been followed' },
  { key: 'no_platform_verification_claimed', label: 'I understand that external participants are NOT platform-verified and that I assume full responsibility for verification' },
];

export default function ExternalParticipantAttestationModal({ isOpen, onClose, session, currentUser }) {
  const [checks, setChecks] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allChecked = CHECKS.every(c => checks[c.key]);

  const handleSubmit = async () => {
    if (!allChecked) { toast.error('Please confirm all attestations'); return; }
    setSubmitting(true);
    try {
      await base44.entities.ExternalParticipantAttestation.create({
        session_id: session.id,
        attesting_user_id: currentUser.email,
        attesting_user_role: session.host_user_id === currentUser.email ? 'host' : 'guest',
        participants: session.external_participants || [],
        attestations: { ...checks, no_platform_verification_claimed: true },
        attestation_text_snapshot: ATTESTATION_TEXT,
        submitted_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });

      await logAgreementAcceptance({
        userId: currentUser.email,
        agreementType: 'external_participant_attestation',
        agreementVersion: '1.0',
        agreementTextSnapshot: ATTESTATION_TEXT,
        checkboxPayload: checks,
        sessionId: session.id,
      });

      setDone(true);
      toast.success('Attestation submitted');
    } catch (err) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-[#151D2B] border border-[#263248] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between p-5 border-b border-[#263248]">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-lg font-semibold text-[#E8EEF9]">External Participant Attestation</h2>
            </div>
            <button onClick={onClose} className="p-2 text-[#6B7A94] hover:text-[#E8EEF9]"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {done ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto" />
                <p className="text-lg font-semibold text-[#E8EEF9]">Attestation Submitted</p>
                <p className="text-sm text-[#9AA6BC]">Your attestation has been recorded and linked to this session.</p>
                <CCButton variant="primary" onClick={onClose}>Done</CCButton>
              </div>
            ) : (
              <>
                <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#F59E0B]/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#9AA6BC]">
                      This session includes off-platform participants. You must attest to age verification, consent, and legal compliance before proceeding. External participants are <strong className="text-[#E8EEF9]">not</strong> platform-verified.
                    </p>
                  </div>
                </div>

                {/* Participants list */}
                {session?.external_participants?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#9AA6BC] mb-2">Covered participants:</p>
                    <div className="space-y-1">
                      {session.external_participants.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-[#E8EEF9] bg-[#0B0F14] px-3 py-1.5 rounded-lg">
                          <span className="font-medium">{p.name}</span>
                          {p.role && <span className="text-[#6B7A94]">· {p.role}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attestation text */}
                <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#263248] max-h-40 overflow-y-auto">
                  <pre className="text-xs text-[#9AA6BC] whitespace-pre-wrap font-sans leading-relaxed">{ATTESTATION_TEXT}</pre>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  {CHECKS.map(c => (
                    <label key={c.key} className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checks[c.key] || false}
                        onChange={e => setChecks(prev => ({ ...prev, [c.key]: e.target.checked }))}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="text-sm text-[#9AA6BC] group-hover:text-[#E8EEF9] transition-colors">{c.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {!done && (
            <div className="p-5 border-t border-[#263248]">
              <CCButton
                variant="primary"
                fullWidth
                onClick={handleSubmit}
                loading={submitting}
                disabled={!allChecked}
              >
                Submit Attestation
              </CCButton>
              <p className="text-xs text-[#6B7A94] text-center mt-2">
                This constitutes a legally binding attestation. It is recorded with timestamp and linked to session {session?.id?.slice(-8)}.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}