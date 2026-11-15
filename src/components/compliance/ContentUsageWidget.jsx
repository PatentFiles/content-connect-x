/**
 * ContentUsageWidget
 * Allows a session/collaboration participant to log or report content usage.
 * Used in SoloSessionsInbox (completed sessions) and CollaborationDetail.
 * Writes to ContentUsageRecord entity. Admin-reviewable.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Film, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';

const USAGE_TYPES = [
  { value: 'authorized_self_publish', label: 'Authorized — self publish', color: 'success' },
  { value: 'authorized_third_party', label: 'Authorized — third party', color: 'success' },
  { value: 'disputed_unauthorized', label: 'Unauthorized use (dispute)', color: 'danger' },
  { value: 'takedown_requested', label: 'Takedown requested', color: 'danger' },
  { value: 'within_embargo', label: 'Published within embargo period', color: 'warning' },
  { value: 'post_embargo', label: 'Published post-embargo (authorized)', color: 'success' },
  { value: 'licensed_commercial', label: 'Licensed commercial use', color: 'primary' },
];

const CONTENT_TYPES = ['photo', 'video', 'clip', 'reel', 'post', 'advertisement', 'other'];

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50";

export default function ContentUsageWidget({ session, collaboration, currentUser }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    usage_type: 'authorized_self_publish',
    content_type: 'video',
    platform_or_url: '',
    published_at: '',
    contract_clause_reference: '',
    notes: '',
    evidence_urls: [],
  });

  const handleEvidenceUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      setForm(p => ({ ...p, evidence_urls: [...p.evidence_urls, ...urls] }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.platform_or_url) { toast.error('Platform / URL is required'); return; }
    setSubmitting(true);
    try {
      await base44.entities.ContentUsageRecord.create({
        session_id: session?.id || null,
        collaboration_id: collaboration?.id || null,
        contract_id: session?.contract_id || collaboration?.contract_id || null,
        reported_by_user_id: currentUser.email,
        ...form,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
        status: 'logged',
      });
      toast.success('Content usage logged');
      setOpen(false);
      setForm({ usage_type: 'authorized_self_publish', content_type: 'video', platform_or_url: '', published_at: '', contract_clause_reference: '', notes: '', evidence_urls: [] });
    } catch (err) {
      toast.error(err.message || 'Failed to log usage');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = USAGE_TYPES.find(u => u.value === form.usage_type);

  return (
    <div className="bg-[#151D2B] border border-[#263248] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#E8EEF9] hover:bg-[#1A2438] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#4F8CFF]" />
          <span className="font-medium">Log Content Usage</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#263248]">
          <p className="text-xs text-[#6B7A94] pt-3">Log where content from this session has been published or report unauthorized use.</p>

          {/* Usage type */}
          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1.5">Usage Type</label>
            <div className="flex flex-wrap gap-1.5">
              {USAGE_TYPES.map(u => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, usage_type: u.value }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    form.usage_type === u.value
                      ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]'
                      : 'border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">Content Type</label>
              <select value={form.content_type} onChange={e => setForm(p => ({ ...p, content_type: e.target.value }))} className={INPUT}>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">Published Date</label>
              <input type="date" value={form.published_at} onChange={e => setForm(p => ({ ...p, published_at: e.target.value }))} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1">Platform or URL *</label>
            <input value={form.platform_or_url} onChange={e => setForm(p => ({ ...p, platform_or_url: e.target.value }))} placeholder="e.g. OnlyFans, https://..." className={INPUT} />
          </div>

          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1">Contract clause reference (optional)</label>
            <input value={form.contract_clause_reference} onChange={e => setForm(p => ({ ...p, contract_clause_reference: e.target.value }))} placeholder="e.g. Section 4.2 — usage rights" className={INPUT} />
          </div>

          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={INPUT + ' resize-none'} placeholder="Any additional context..." />
          </div>

          {/* Evidence upload */}
          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1.5">Evidence (screenshots / links)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.evidence_urls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-[#263248]" />
                  <button onClick={() => setForm(p => ({ ...p, evidence_urls: p.evidence_urls.filter((_, j) => j !== i) }))} className="absolute -top-1 -right-1 bg-[#EF4444] rounded-full p-0.5">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-14 h-14 border-2 border-dashed border-[#263248] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#4F8CFF]">
                {uploading ? <div className="w-4 h-4 border-2 border-[#4F8CFF] border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4 text-[#6B7A94]" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleEvidenceUpload} />
              </label>
            </div>
          </div>

          <CCButton variant={selectedType?.color === 'danger' ? 'danger' : 'primary'} fullWidth onClick={handleSubmit} loading={submitting}>
            Log Usage Record
          </CCButton>
        </div>
      )}
    </div>
  );
}