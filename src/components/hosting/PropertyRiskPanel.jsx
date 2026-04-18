/**
 * PropertyRiskPanel
 *
 * Admin-only panel for setting geo risk metadata, insurance verification,
 * and enforcement state on a Property. Shown in the AdminDashboard
 * property review context. Never shown to guests or hosts.
 *
 * Props: property, onUpdated()
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Shield, MapPin, AlertTriangle, FileCheck, Ban, Upload } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

const RISK_LEVEL_VARIANTS = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  flagged: 'danger',
};

const ENFORCEMENT_STATE_VARIANTS = {
  none: 'success',
  warning: 'warning',
  probation: 'warning',
  suspended: 'danger',
  banned: 'danger',
};

export default function PropertyRiskPanel({ property, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [geoRisk, setGeoRisk] = useState({
    risk_level: property?.geo_risk?.risk_level || 'low',
    jurisdiction_notes: property?.geo_risk?.jurisdiction_notes || '',
    requires_manual_review: property?.geo_risk?.requires_manual_review || false,
    reserve_pct_override: property?.geo_risk?.reserve_pct_override ?? '',
    ranking_penalty: property?.geo_risk?.ranking_penalty ?? 0,
    risk_tags: property?.geo_risk?.risk_tags || [],
  });

  const [insurance, setInsurance] = useState({
    insurance_verified: property?.insurance?.insurance_verified || false,
    insurance_document_url: property?.insurance?.insurance_document_url || '',
    coverage_notes: property?.insurance?.coverage_notes || '',
    policy_expiry_date: property?.insurance?.policy_expiry_date || '',
  });

  const [enforcement, setEnforcement] = useState({
    state: property?.host_enforcement?.state || 'none',
    enforcement_notes: property?.host_enforcement?.enforcement_notes || '',
  });

  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !geoRisk.risk_tags.includes(t)) {
      setGeoRisk(prev => ({ ...prev, risk_tags: [...prev.risk_tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setGeoRisk(prev => ({ ...prev, risk_tags: prev.risk_tags.filter(t => t !== tag) }));
  };

  const handleInsuranceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setInsurance(prev => ({ ...prev, insurance_document_url: file_url }));
      toast.success('Document uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates = {
        geo_risk: {
          ...geoRisk,
          reserve_pct_override: geoRisk.reserve_pct_override !== '' ? parseFloat(geoRisk.reserve_pct_override) : undefined,
          last_reviewed_at: now,
        },
        insurance: {
          ...insurance,
          ...(insurance.insurance_verified && !property?.insurance?.verified_at ? { verified_at: now } : {}),
        },
        host_enforcement: {
          ...(property?.host_enforcement || {}),
          state: enforcement.state,
          enforcement_notes: enforcement.enforcement_notes,
          enforcement_updated_at: now,
        },
      };

      await base44.entities.Property.update(property.id, updates);

      // Log to AdminActionLog
      await base44.entities.AdminActionLog.create({
        admin_user_id: 'ADMIN',
        target_type: 'Property',
        target_id: property.id,
        action: 'property_risk_updated',
        reason: `Risk level: ${geoRisk.risk_level}, Insurance: ${insurance.insurance_verified}, Enforcement: ${enforcement.state}`,
        metadata_json: { property_id: property.id, geo_risk: geoRisk, enforcement_state: enforcement.state, timestamp: now },
      }).catch(() => {});

      toast.success('Property risk profile updated');
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Geo Risk */}
      <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#F59E0B]" />
          Geo Risk Classification
          <CCBadge variant={RISK_LEVEL_VARIANTS[geoRisk.risk_level] || 'default'} size="sm">
            {geoRisk.risk_level}
          </CCBadge>
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Risk Level</label>
            <select
              value={geoRisk.risk_level}
              onChange={e => setGeoRisk(prev => ({ ...prev, risk_level: e.target.value }))}
              className={INPUT}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Reserve % Override</label>
            <input
              type="number"
              min={0}
              max={100}
              value={geoRisk.reserve_pct_override}
              onChange={e => setGeoRisk(prev => ({ ...prev, reserve_pct_override: e.target.value }))}
              placeholder="Platform default"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Ranking Penalty (pts)</label>
            <input
              type="number"
              min={0}
              value={geoRisk.ranking_penalty}
              onChange={e => setGeoRisk(prev => ({ ...prev, ranking_penalty: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              className={INPUT}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={geoRisk.requires_manual_review}
              onChange={e => setGeoRisk(prev => ({ ...prev, requires_manual_review: e.target.checked }))}
            />
            <span className="text-xs text-[#E8EEF9]">Require manual admin review for all bookings</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Jurisdiction Notes</label>
          <textarea
            value={geoRisk.jurisdiction_notes}
            onChange={e => setGeoRisk(prev => ({ ...prev, jurisdiction_notes: e.target.value }))}
            rows={2}
            placeholder="Local permit requirements, zoning restrictions, known legal constraints..."
            className={INPUT + ' resize-none'}
          />
        </div>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Risk Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {geoRisk.risk_tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full text-xs text-[#F59E0B] cursor-pointer hover:bg-[#F59E0B]/20"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="e.g. no_permit, prior_incidents"
              className={INPUT}
            />
            <CCButton variant="outline" size="sm" onClick={addTag}>Add</CCButton>
          </div>
          <p className="text-[10px] text-[#6B7A94] mt-1">Press Enter or click Add. Tags influence moderation routing and ranking.</p>
        </div>
      </div>

      {/* Insurance */}
      <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-[#22C55E]" />
          Insurance Verification
          {insurance.insurance_verified && <CCBadge variant="success" size="sm">Verified</CCBadge>}
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={insurance.insurance_verified}
            onChange={e => setInsurance(prev => ({ ...prev, insurance_verified: e.target.checked }))}
          />
          <span className="text-sm text-[#E8EEF9]">Mark insurance as verified</span>
        </label>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Coverage Notes</label>
          <input
            value={insurance.coverage_notes}
            onChange={e => setInsurance(prev => ({ ...prev, coverage_notes: e.target.value }))}
            placeholder="e.g. General liability $1M, filming permitted"
            className={INPUT}
          />
        </div>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Policy Expiry Date</label>
          <input
            type="date"
            value={insurance.policy_expiry_date}
            onChange={e => setInsurance(prev => ({ ...prev, policy_expiry_date: e.target.value }))}
            className={INPUT}
          />
        </div>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Insurance Document (private)</label>
          {insurance.insurance_document_url ? (
            <div className="flex items-center gap-2">
              <a
                href={insurance.insurance_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#4F8CFF] underline truncate"
              >
                View document
              </a>
              <button
                onClick={() => setInsurance(prev => ({ ...prev, insurance_document_url: '' }))}
                className="text-xs text-[#6B7A94] hover:text-[#EF4444]"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#9AA6BC] hover:text-[#E8EEF9]">
              {uploading
                ? <div className="w-4 h-4 border-2 border-[#4F8CFF] border-t-transparent rounded-full animate-spin" />
                : <Upload className="w-4 h-4" />
              }
              Upload proof of insurance
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleInsuranceUpload} />
            </label>
          )}
        </div>
      </div>

      {/* Host Enforcement */}
      <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <Ban className="w-4 h-4 text-[#EF4444]" />
          Host Enforcement State
          <CCBadge variant={ENFORCEMENT_STATE_VARIANTS[enforcement.state] || 'default'} size="sm">
            {enforcement.state}
          </CCBadge>
        </h3>

        {/* Incident counters (read-only) */}
        {(property?.host_enforcement?.no_show_count > 0 || property?.host_enforcement?.cancellation_count > 0 || property?.host_enforcement?.failed_access_count > 0) && (
          <div className="flex gap-4 text-xs text-[#9AA6BC]">
            <span>No-shows: <strong className="text-[#E8EEF9]">{property.host_enforcement.no_show_count || 0}</strong></span>
            <span>Cancellations: <strong className="text-[#E8EEF9]">{property.host_enforcement.cancellation_count || 0}</strong></span>
            <span>Failed access: <strong className="text-[#E8EEF9]">{property.host_enforcement.failed_access_count || 0}</strong></span>
          </div>
        )}

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Enforcement State</label>
          <select
            value={enforcement.state}
            onChange={e => setEnforcement(prev => ({ ...prev, state: e.target.value }))}
            className={INPUT}
          >
            <option value="none">None</option>
            <option value="warning">Warning</option>
            <option value="probation">Probation</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#9AA6BC] mb-1">Enforcement Notes</label>
          <textarea
            value={enforcement.enforcement_notes}
            onChange={e => setEnforcement(prev => ({ ...prev, enforcement_notes: e.target.value }))}
            rows={2}
            placeholder="Reason for current enforcement state..."
            className={INPUT + ' resize-none'}
          />
        </div>
      </div>

      <CCButton variant="primary" fullWidth loading={saving} onClick={handleSave}>
        Save Risk Profile
      </CCButton>
    </div>
  );
}