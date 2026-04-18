/**
 * PropertyAccessSettings
 * Host-side editor for property access configuration:
 *  - GPS check-in toggle (with disclaimer modal on disable)
 *  - Geofence radius
 *  - Code window (minutes before/after)
 *  - Smart lock provider & config
 *  - Checkout evidence requirement
 *
 * Used inside PropertyForm, gated by feature flags.
 * Props: settings (object), onChange(updatedSettings)
 */
import React, { useState } from 'react';
import { Key, Navigation, Lock, Camera, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

const INPUT = "bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

const LOCK_PROVIDERS = [
  { value: 'manual', label: 'Manual (host sets code)' },
  { value: 'august', label: 'August' },
  { value: 'schlage', label: 'Schlage Encode' },
  { value: 'yale', label: 'Yale' },
  { value: 'nuki', label: 'Nuki' },
  { value: 'igloohome', label: 'igloohome' },
  { value: 'remotelock', label: 'RemoteLock' },
  { value: 'other', label: 'Other / Custom API' },
];

// GPS disable confirmation modal
function GpsDisableModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#151D2B] border border-[#F59E0B]/40 rounded-2xl p-6 max-w-md w-full space-y-4">
        <div className="flex items-center gap-2 text-[#F59E0B]">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold text-[#E8EEF9]">Disable GPS Check-In?</h3>
        </div>
        <div className="text-sm text-[#9AA6BC] space-y-2">
          <p>Before disabling GPS check-in, please note:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>GPS evidence is <strong className="text-[#E8EEF9]">recommended</strong> as it creates a verifiable check-in record for disputes.</li>
            <li>Some phones have <strong className="text-[#E8EEF9]">imperfect geolocation</strong> — guests outside your geofence may still be on-site. Disable if this causes unnecessary friction.</li>
            <li>Disabling reduces failed check-ins and support requests for properties in multi-unit buildings or basements with poor GPS signal.</li>
            <li>Manual check-in is still logged — GPS is optional, not the only evidence mechanism.</li>
          </ul>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-[#263248] rounded-lg text-sm text-[#E8EEF9] hover:bg-[#263248] transition-colors"
          >
            Keep GPS On
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-[#F59E0B]/20 border border-[#F59E0B]/40 rounded-lg text-sm text-[#F59E0B] hover:bg-[#F59E0B]/30 transition-colors"
          >
            Disable GPS
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PropertyAccessSettings({ settings = {}, onChange }) {
  const gpsEnabled = useFeatureFlag('gps_checkin');
  const smartLockEnabled = useFeatureFlag('smart_lock_enabled');
  const checkoutEvidenceEnabled = useFeatureFlag('checkout_evidence_enabled');
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [showSmartLock, setShowSmartLock] = useState(false);

  const set = (key, val) => onChange({ ...settings, [key]: val });
  const setConfig = (key, val) => onChange({ ...settings, smart_lock_config: { ...(settings.smart_lock_config || {}), [key]: val } });

  const handleGpsToggle = (val) => {
    if (!val && settings.gps_checkin_required) {
      setShowGpsModal(true);
    } else {
      set('gps_checkin_required', val);
    }
  };

  const hasAnyFeature = gpsEnabled || smartLockEnabled || checkoutEvidenceEnabled;
  if (!hasAnyFeature) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-1.5">
        <Key className="w-4 h-4 text-[#4F8CFF]" /> Access & Check-In Settings
      </h3>

      {/* GPS check-in */}
      {gpsEnabled && (
        <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#E8EEF9] flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-[#22C55E]" /> Require GPS Check-In
              </p>
              <p className="text-xs text-[#6B7A94] mt-0.5">Guest must check in with GPS during their booking window</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.gps_checkin_required || false}
                onChange={e => handleGpsToggle(e.target.checked)}
              />
            </label>
          </div>

          {settings.gps_checkin_required && (
            <div className="space-y-2 pl-1 border-l border-[#263248]">
              <div>
                <label className="block text-xs text-[#9AA6BC] mb-1">Geofence Radius (meters)</label>
                <input
                  type="number"
                  min={50}
                  max={1000}
                  value={settings.gps_geofence_radius_meters || 200}
                  onChange={e => set('gps_geofence_radius_meters', parseInt(e.target.value) || 200)}
                  className={INPUT + ' w-32'}
                />
                <p className="text-[10px] text-[#6B7A94] mt-1">Default 200m. Increase for buildings with poor GPS signal.</p>
              </div>
            </div>
          )}

          {/* Code window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Code available (mins before start)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={settings.access_code_window_minutes_before ?? 30}
                onChange={e => set('access_code_window_minutes_before', parseInt(e.target.value) || 30)}
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Code valid (mins after end)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={settings.access_code_window_minutes_after ?? 15}
                onChange={e => set('access_code_window_minutes_after', parseInt(e.target.value) || 15)}
                className={INPUT}
              />
            </div>
          </div>
        </div>
      )}

      {/* Smart lock */}
      {smartLockEnabled && (
        <div className="bg-[#0B0F14] border border-[#263248] rounded-xl overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between p-3"
            onClick={() => setShowSmartLock(s => !s)}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#FF2DAA]" />
              <div className="text-left">
                <p className="text-sm font-medium text-[#E8EEF9]">Smart Lock Integration</p>
                <p className="text-xs text-[#6B7A94]">Optional API-connected lock configuration</p>
              </div>
            </div>
            {showSmartLock ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
          </button>

          {showSmartLock && (
            <div className="border-t border-[#263248] p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smart_lock_enabled || false}
                  onChange={e => set('smart_lock_enabled', e.target.checked)}
                />
                <span className="text-sm text-[#E8EEF9]">This property has a smart/API-connected lock</span>
              </label>

              {settings.smart_lock_enabled && (
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="block text-xs text-[#9AA6BC] mb-1">Lock Provider</label>
                    <select
                      value={settings.smart_lock_provider || 'manual'}
                      onChange={e => set('smart_lock_provider', e.target.value)}
                      className={INPUT + ' w-full'}
                    >
                      {LOCK_PROVIDERS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  {settings.smart_lock_provider !== 'manual' && (
                    <>
                      <div>
                        <label className="block text-xs text-[#9AA6BC] mb-1">Device/Lock ID</label>
                        <input
                          value={settings.smart_lock_config?.device_id || ''}
                          onChange={e => setConfig('device_id', e.target.value)}
                          placeholder="From your lock app/dashboard"
                          className={INPUT + ' w-full'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9AA6BC] mb-1">Account Reference</label>
                        <input
                          value={settings.smart_lock_config?.account_ref || ''}
                          onChange={e => setConfig('account_ref', e.target.value)}
                          placeholder="Account ID or property reference"
                          className={INPUT + ' w-full'}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs text-[#9AA6BC] mb-1">Notes (private)</label>
                    <input
                      value={settings.smart_lock_config?.notes || ''}
                      onChange={e => setConfig('notes', e.target.value)}
                      placeholder="e.g. Backup code: use lockbox if app fails"
                      className={INPUT + ' w-full'}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7A94]">
                    API integrations are configured here but require platform-level connector setup to automate code delivery. Until connected, codes are managed manually via your lock provider's app.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Checkout evidence */}
      {checkoutEvidenceEnabled && (
        <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#F59E0B]" />
              <div>
                <p className="text-sm font-medium text-[#E8EEF9]">Request Checkout Evidence</p>
                <p className="text-xs text-[#6B7A94]">Prompt host and guest to upload photo/video at checkout</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.checkout_evidence_required || false}
              onChange={e => set('checkout_evidence_required', e.target.checked)}
            />
          </label>
        </div>
      )}

      {/* GPS disable modal */}
      {showGpsModal && (
        <GpsDisableModal
          onConfirm={() => { set('gps_checkin_required', false); setShowGpsModal(false); }}
          onCancel={() => setShowGpsModal(false)}
        />
      )}
    </div>
  );
}