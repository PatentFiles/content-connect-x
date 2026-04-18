/**
 * PropertyIncidentWidget
 *
 * Allows hosts and guests to file a PropertyIncident for a session.
 * Integrates with existing AdminActionLog and Report moderation patterns.
 * Shown in SoloSessionsInbox / BookingAccessWidget after a session.
 *
 * Props: session, currentUser, property (optional)
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertTriangle, Plus, X, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';

const INCIDENT_TYPES = [
  { value: 'damage',            label: 'Property Damage' },
  { value: 'unauthorized_use',  label: 'Unauthorized Use' },
  { value: 'safety_issue',      label: 'Safety Issue' },
  { value: 'illegal_activity',  label: 'Illegal Activity' },
  { value: 'cleanup_failure',   label: 'Cleanup Failure' },
  { value: 'equipment_issue',   label: 'Equipment Issue' },
  { value: 'host_no_show',      label: 'Host No-Show' },
  { value: 'host_cancelled',    label: 'Host Cancelled (Late)' },
  { value: 'failed_access',     label: 'Failed Access / Lockout' },
  { value: 'other',             label: 'Other' },
];

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

export default function PropertyIncidentWidget({ session, currentUser, property }) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    incident_type: 'damage',
    title: '',
    description: '',
    estimated_damage_amount: '',
    evidence_urls: [],
  });

  const isHost = session?.host_user_id === currentUser?.email;
  const isGuest = session?.guest_user_id === currentUser?.email;
  if (!isHost && !isGuest) return null;

  // Only show for completed/active sessions or sessions with issues
  const relevantStatuses = ['active', 'completed', 'disputed', 'confirmed', 'contract_signed'];
  if (!relevantStatuses.includes(session?.status)) return null;

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [...form.evidence_urls];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      setForm(prev => ({ ...prev, evidence_urls: urls }));
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = (idx) => {
    setForm(prev => ({ ...prev, evidence_urls: prev.evidence_urls.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Please provide a title'); return; }
    if (!form.description.trim()) { toast.error('Please describe the incident'); return; }
    setSubmitting(true);
    try {
      const propertyId = property?.id || session?.booking_snapshot?.property_id;

      await base44.entities.PropertyIncident.create({
        session_id: session.id,
        property_id: propertyId || '',
        reporter_user_id: currentUser.email,
        reporter_role: isHost ? 'host' : 'guest',
        incident_type: form.incident_type,
        title: form.title,
        description: form.description,
        evidence_urls: form.evidence_urls,
        estimated_damage_amount: form.estimated_damage_amount ? parseFloat(form.estimated_damage_amount) : undefined,
        status: 'open',
      });

      toast.success('Incident reported. Our team will review it.');
      setSubmitted(true);
      setExpanded(false);
    } catch (err) {
      toast.error(err.message || 'Failed to submit incident');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[#1A1F0F] border border-[#4B5E24] rounded-xl p-3 text-xs text-[#A8C36A] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Incident reported — our moderation team will review within 24–48 hours.
      </div>
    );
  }

  return (
    <div className="border border-[#3A2020] bg-[#151010] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(s => !s)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          <span className="text-sm font-medium text-[#E8EEF9]">Report an Incident</span>
          <span className="text-xs text-[#6B7A94]">damage, no-show, safety, access issues</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </button>

      {expanded && (
        <div className="border-t border-[#3A2020] p-4 space-y-3">
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Incident Type</label>
            <select
              value={form.incident_type}
              onChange={e => setForm(prev => ({ ...prev, incident_type: e.target.value }))}
              className={INPUT}
            >
              {INCIDENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Water damage to equipment"
              className={INPUT}
            />
          </div>

          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Describe what happened in detail..."
              className={INPUT + ' resize-none'}
            />
          </div>

          {form.incident_type === 'damage' && (
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Estimated Damage Amount (USD, optional)</label>
              <input
                type="number"
                value={form.estimated_damage_amount}
                onChange={e => setForm(prev => ({ ...prev, estimated_damage_amount: e.target.value }))}
                placeholder="e.g. 250"
                className={INPUT}
              />
            </div>
          )}

          {/* Evidence uploads */}
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Evidence (photos/videos)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.evidence_urls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded overflow-hidden bg-[#0B0F14] border border-[#263248]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeEvidence(i)}
                    className="absolute top-0.5 right-0.5 bg-[#EF4444] rounded p-0.5"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 border-2 border-dashed border-[#3A2020] rounded flex items-center justify-center cursor-pointer hover:border-[#EF4444]/50 transition-colors">
                {uploading
                  ? <div className="w-4 h-4 border-2 border-[#EF4444] border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-4 h-4 text-[#6B7A94]" />
                }
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            </div>
            <p className="text-[10px] text-[#6B7A94]">Evidence is private and only reviewed by our moderation team.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <CCButton variant="outline" size="sm" onClick={() => setExpanded(false)}>Cancel</CCButton>
            <CCButton variant="danger" size="sm" loading={submitting} onClick={handleSubmit}>
              Submit Incident Report
            </CCButton>
          </div>
        </div>
      )}
    </div>
  );
}