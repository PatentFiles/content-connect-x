/**
 * SoloSessionBookingModal
 *
 * Allows a verified user to initiate a solo/service/location booking
 * directly with a host. Captures:
 *  - session_type, booking_mode, participant_mode
 *  - schedule, location, compensation
 *  - optional external_participants for mixed mode
 *  - agreement acceptance (snapshot stored for audit)
 *
 * Calls manageSoloSession?action=create via backend function.
 * Existing BookingRequest flow is preserved — this is an additive path.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, MapPin, DollarSign, Users, User, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { useFeatureFlag } from '@/lib/featureFlags';
import PropertyBookingAddons from '@/components/hosting/PropertyBookingAddons';
import LocationContractClauses from '@/components/hosting/LocationContractClauses';
import { logAgreementAcceptance } from '@/lib/agreementLogger';
import { useFeatureFlag } from '@/lib/featureFlags';

const SESSION_TYPES = [
  { value: 'solo_session', label: 'Solo Session', description: 'Book space for personal/creative use' },
  { value: 'service_booking', label: 'Service Booking', description: 'Book a professional service' },
  { value: 'location_booking', label: 'Location Booking', description: 'Reserve a specific location' },
];

const PARTICIPANT_MODES = [
  { value: 'on_platform', label: 'On-Platform Only', icon: User },
  { value: 'external', label: 'External Guests', icon: Users },
  { value: 'mixed', label: 'Mixed', icon: Users },
];

const HOST_AGREEMENT_TEMPLATE = `By confirming this booking you agree to:
1. Arrive on time and leave the space in the condition you found it.
2. Comply with all house rules and local laws.
3. Not share access credentials with unauthorised persons.
4. Notify the host immediately of any damage or safety concerns.`;

export default function SoloSessionBookingModal({ isOpen, onClose, hostUserId, hostProfile, hostScheduleEntry, property }) {
  const soloSessionsEnabled = useFeatureFlag('solo_sessions');
  const equipmentEnabled = useFeatureFlag('equipment_rentals');
  const bundlesEnabled = useFeatureFlag('bundle_templates');
  const cleaningFeeEnabled = useFeatureFlag('cleaning_fee');
  const locationClausesEnabled = useFeatureFlag('location_contract_clauses');
  const cancellationPoliciesEnabled = useFeatureFlag('cancellation_policies');
  const hasAddons = property && (equipmentEnabled || bundlesEnabled || cleaningFeeEnabled);

  // Steps: 1=type/participants, 2=schedule/rate, [3=add-ons if location+property], last=agreement
  const totalSteps = hasAddons && (property?.equipment?.length > 0 || property?.bundles?.length > 0 || property?.pricing?.cleaning_fee_enabled) ? 4 : 3;
  const addonsStep = hasAddons ? 3 : null;
  const agreementStep = totalSteps;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bookingSnapshot, setBookingSnapshot] = useState(null);
  const [form, setForm] = useState({
    session_type: property ? 'location_booking' : 'solo_session',
    participant_mode: 'on_platform',
    confirmed_date: '',
    start_time: '',
    end_time: '',
    city: '',
    location_notes: '',
    amount: '',
    payment_type: 'fixed',
    message: '',
    external_participants: [],
    agreement_accepted: false,
  });

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const addExternalParticipant = () => {
    setForm(prev => ({
      ...prev,
      external_participants: [...prev.external_participants, { name: '', role: '', contact: '' }],
    }));
  };

  const updateExtParticipant = (idx, field, val) => {
    setForm(prev => {
      const updated = [...prev.external_participants];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, external_participants: updated };
    });
  };

  const removeExtParticipant = (idx) => {
    setForm(prev => ({
      ...prev,
      external_participants: prev.external_participants.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async () => {
    if (!form.confirmed_date) { toast.error('Please select a date'); return; }
    if (!form.agreement_accepted) { toast.error('You must accept the host agreement to continue'); return; }

    setLoading(true);
    // Use pricing breakdown total from snapshot if available
    const totalFromSnapshot = bookingSnapshot?.pricing_breakdown?.grand_total;
    try {
      // Log agreement acceptance immutably
      const currentUser = await base44.auth.me().catch(() => null);
      if (currentUser) {
        await logAgreementAcceptance({
          userId: currentUser.email,
          agreementType: property ? 'property_booking' : 'solo_session',
          agreementVersion: '1.0',
          agreementTextSnapshot: HOST_AGREEMENT_TEMPLATE,
          checkboxPayload: { agreement_accepted: true },
          propertyId: property?.id || null,
        });
      }

      const res = await base44.functions.invoke('manageSoloSession', {
        action: 'create',
        host_user_id: hostUserId,
        session_type: form.session_type,
        participant_mode: form.participant_mode,
        booking_mode: 'solo',
        schedule: {
          confirmed_date: form.confirmed_date,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
        },
        location: {
          type: hostScheduleEntry?.location_type?.toLowerCase() || 'studio',
          name: hostScheduleEntry?.location_name || property?.title || hostProfile?.display_name || '',
          city: form.city || hostScheduleEntry?.location_city || property?.city || '',
          notes: form.location_notes || hostScheduleEntry?.booking_notes || '',
        },
        compensation: (form.amount || totalFromSnapshot) ? {
          amount: totalFromSnapshot || parseFloat(form.amount),
          currency: 'USD',
          payment_type: form.payment_type,
          notes: totalFromSnapshot ? 'Calculated from booking add-ons' : undefined,
        } : null,
        external_participants: ['external', 'mixed'].includes(form.participant_mode)
          ? form.external_participants.filter(p => p.name)
          : [],
        schedule_entry_id: hostScheduleEntry?.id || null,
        agreement_text_snapshot: HOST_AGREEMENT_TEMPLATE,
        booking_snapshot: bookingSnapshot || null,
      });

      toast.success('Session booking request sent!');
      onClose(res.data?.session_id);
    } catch (err) {
      toast.error(err.message || 'Failed to create session booking');
    } finally {
      setLoading(false);
    }
  };

  if (!soloSessionsEnabled) return null;
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-[#151D2B] border border-[#263248] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[#263248]">
            <div>
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Book a Session</h2>
              <p className="text-xs text-[#9AA6BC] mt-0.5">
                with {hostProfile?.display_name || property?.title || 'Host'} · Step {step} of {totalSteps}
              </p>
            </div>
            <button onClick={() => onClose()} className="p-2 text-[#6B7A94] hover:text-[#E8EEF9] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Step 1: Session Type & Participants */}
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-3">Session Type</label>
                  <div className="space-y-2">
                    {SESSION_TYPES.map(st => (
                      <button
                        key={st.value}
                        onClick={() => update('session_type', st.value)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          form.session_type === st.value
                            ? 'border-[#4F8CFF] bg-[#4F8CFF]/10'
                            : 'border-[#263248] hover:border-[#3A4A6B]'
                        }`}
                      >
                        <p className="text-sm font-medium text-[#E8EEF9]">{st.label}</p>
                        <p className="text-xs text-[#9AA6BC]">{st.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-3">Who's attending?</label>
                  <div className="flex gap-2">
                    {PARTICIPANT_MODES.map(pm => {
                      const Icon = pm.icon;
                      return (
                        <button
                          key={pm.value}
                          onClick={() => update('participant_mode', pm.value)}
                          className={`flex-1 py-2 px-3 rounded-lg border text-center text-xs transition-all ${
                            form.participant_mode === pm.value
                              ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]'
                              : 'border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
                          }`}
                        >
                          <Icon className="w-4 h-4 mx-auto mb-1" />
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* External participants */}
                {['external', 'mixed'].includes(form.participant_mode) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[#E8EEF9]">External Participants</label>
                      <CCButton variant="outline" size="sm" icon={Plus} onClick={addExternalParticipant}>Add</CCButton>
                    </div>
                    <p className="text-xs text-[#6B7A94] mb-3">
                      Required for legal record-keeping. Contact info is private and admin-visible only.
                    </p>
                    {form.external_participants.map((p, idx) => (
                      <div key={idx} className="bg-[#0B0F14] rounded-lg p-3 mb-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            placeholder="Name"
                            value={p.name}
                            onChange={e => updateExtParticipant(idx, 'name', e.target.value)}
                            className="flex-1 bg-[#121824] border border-[#263248] rounded px-3 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
                          />
                          <input
                            placeholder="Role"
                            value={p.role}
                            onChange={e => updateExtParticipant(idx, 'role', e.target.value)}
                            className="w-28 bg-[#121824] border border-[#263248] rounded px-3 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
                          />
                          <button onClick={() => removeExtParticipant(idx)} className="p-1.5 text-[#6B7A94] hover:text-[#EF4444]">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Schedule & Compensation */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                    <Calendar className="w-4 h-4 inline mr-1" />Date
                  </label>
                  <input
                    type="date"
                    value={form.confirmed_date}
                    onChange={e => update('confirmed_date', e.target.value)}
                    className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                      <Clock className="w-4 h-4 inline mr-1" />Start Time
                    </label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={e => update('start_time', e.target.value)}
                      className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                      <Clock className="w-4 h-4 inline mr-1" />End Time
                    </label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={e => update('end_time', e.target.value)}
                      className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                    <MapPin className="w-4 h-4 inline mr-1" />City (optional)
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    placeholder={hostScheduleEntry?.location_city || 'City'}
                    className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                    <DollarSign className="w-4 h-4 inline mr-1" />Rate (USD, optional)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => update('amount', e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    />
                    <select
                      value={form.payment_type}
                      onChange={e => update('payment_type', e.target.value)}
                      className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="hourly">Per Hour</option>
                      <option value="deposit_only">Deposit</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Message to Host</label>
                  <textarea
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    rows={3}
                    placeholder="Describe your intended use..."
                    className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
                  />
                </div>
              </>
            )}

            {/* Step 3: Add-ons (location bookings with property only) */}
            {step === 3 && addonsStep === 3 && property && (
              <PropertyBookingAddons
                property={property}
                hours={(() => {
                  if (form.start_time && form.end_time) {
                    const [sh, sm] = form.start_time.split(':').map(Number);
                    const [eh, em] = form.end_time.split(':').map(Number);
                    const diff = (eh * 60 + em - sh * 60 - sm) / 60;
                    return diff > 0 ? diff : 1;
                  }
                  return 1;
                })()}
                onUpdate={(snap) => setBookingSnapshot(snap)}
              />
            )}

            {/* Step 3/4: Agreement */}
            {step === agreementStep && (
              <>
                <div className="bg-[#0B0F14] rounded-lg p-4 border border-[#263248]">
                  <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    Host Agreement
                  </h3>
                  <pre className="text-xs text-[#9AA6BC] whitespace-pre-wrap font-sans leading-relaxed">
                    {HOST_AGREEMENT_TEMPLATE}
                  </pre>
                </div>

                {/* Location contract clauses if applicable */}
                {locationClausesEnabled && property && (
                  <LocationContractClauses property={property} compact />
                )}

                <div className="bg-[#1A2438] rounded-lg p-3 border border-[#263248] text-xs text-[#9AA6BC] space-y-1">
                  <p><strong className="text-[#E8EEF9]">Session:</strong> {SESSION_TYPES.find(t => t.value === form.session_type)?.label}</p>
                  <p><strong className="text-[#E8EEF9]">Date:</strong> {form.confirmed_date || 'TBD'}</p>
                  {form.start_time && <p><strong className="text-[#E8EEF9]">Time:</strong> {form.start_time}{form.end_time ? ` – ${form.end_time}` : ''}</p>}
                  {bookingSnapshot?.pricing_breakdown?.grand_total
                    ? <p><strong className="text-[#E8EEF9]">Total:</strong> ${bookingSnapshot.pricing_breakdown.grand_total.toFixed(2)} (incl. add-ons)</p>
                    : form.amount && <p><strong className="text-[#E8EEF9]">Rate:</strong> ${form.amount} ({form.payment_type})</p>
                  }
                  {bookingSnapshot?.bundle_name && <p><strong className="text-[#E8EEF9]">Package:</strong> {bookingSnapshot.bundle_name}</p>}
                  {bookingSnapshot?.selected_equipment?.length > 0 && <p><strong className="text-[#E8EEF9]">Equipment:</strong> {bookingSnapshot.selected_equipment.map(e => e.name).join(', ')}</p>}
                  <p><strong className="text-[#E8EEF9]">Participants:</strong> {form.participant_mode}</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agreement_accepted}
                    onChange={e => update('agreement_accepted', e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-[#9AA6BC]">
                    I have read and accept the host agreement. I understand this booking is legally binding and subject to platform policies.
                    A snapshot of these terms will be stored for audit purposes.
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-[#263248] flex gap-3">
            {step > 1 && (
              <CCButton variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
                Back
              </CCButton>
            )}
            {step < agreementStep ? (
              <CCButton
                variant="primary"
                onClick={() => setStep(s => s + 1)}
                className="flex-1"
                disabled={step === 2 && !form.confirmed_date}
              >
                Next
              </CCButton>
            ) : (
              <CCButton
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!form.agreement_accepted}
                className="flex-1"
              >
                Confirm Booking
              </CCButton>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}