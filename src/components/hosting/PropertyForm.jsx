/**
 * PropertyForm — Create or edit a Property listing.
 * Handles media uploads, pricing, rules, amenities, and onboarding checklist updates.
 * Writes to Property entity directly (no new backend function needed — RLS enforces ownership).
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { X, Plus, Building2 } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import PropertyRulesManager from './PropertyRulesManager';
import PropertyEquipmentManager from './PropertyEquipmentManager';
import PropertyBundleManager from './PropertyBundleManager';
import PropertyAccessSettings from './PropertyAccessSettings';
import PropertyDamageDepositSection from './PropertyDamageDepositSection';
import CancellationPolicySelector from './CancellationPolicySelector';
import { useFeatureFlag } from '@/lib/featureFlags';
import BottomSheetSelect from '@/components/ui-custom/BottomSheetSelect';

const PROPERTY_TYPES = [
  'studio', 'loft', 'house', 'apartment', 'studio_set', 'dungeon',
  'warehouse', 'hotel_suite', 'dedicated_content_house', 'commercial_space',
  'rooftop', 'outdoor', 'office', 'other'
];
const OWNER_TYPES = ['individual', 'studio', 'agency', 'production_company'];
const COMMON_AMENITIES = ['WiFi', 'Parking', 'Lighting Rig', 'Backdrop', 'Green Room', 'Kitchen', 'AC', 'Bathroom', '4K Camera', 'Audio', 'Makeup Station', 'Wardrobe'];

function field(label, children, hint) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#6B7A94] mt-1">{hint}</p>}
    </div>
  );
}

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50";

export default function PropertyForm({ property, ownerUserId, onSaved, onCancel }) {
  const isEdit = !!property?.id;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const equipmentEnabled = useFeatureFlag('equipment_rentals');
  const bundlesEnabled = useFeatureFlag('bundle_templates');
  const cleaningFeeEnabled = useFeatureFlag('cleaning_fee');
  const cancellationPoliciesEnabled = useFeatureFlag('cancellation_policies');

  const [form, setForm] = useState({
    title: property?.title || '',
    property_type: property?.property_type || 'studio',
    owner_type: property?.owner_type || 'individual',
    city: property?.city || '',
    state: property?.state || '',
    exact_address: property?.exact_address || '',
    description: property?.description || '',
    amenities: property?.amenities || [],
    media: property?.media || [],
    capacity: property?.capacity || {},
    pricing: property?.pricing || { currency: 'USD' },
    buffers: property?.buffers || { setup_buffer_hours: 0, teardown_buffer_hours: 0, cleaning_buffer_hours: 0 },
    rules: property?.rules || { verified_only: true, no_smoking: true },
    equipment: property?.equipment || [],
    bundles: property?.bundles || [],
    access_settings: property?.access_settings || {},
    damage_deposit: property?.damage_deposit || {},
    instant_book: property?.instant_book || false,
    onboarding_checklist: property?.onboarding_checklist || {},
  });

  const set = (path, val) => {
    const parts = path.split('.');
    if (parts.length === 1) {
      setForm(prev => ({ ...prev, [path]: val }));
    } else {
      setForm(prev => ({
        ...prev,
        [parts[0]]: { ...prev[parts[0]], [parts[1]]: val },
      }));
    }
  };

  const toggleAmenity = (a) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a],
    }));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const newMedia = [...form.media];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newMedia.push({
          url: file_url,
          type: file.type.startsWith('video') ? 'video' : 'image',
          is_cover: newMedia.length === 0,
          order: newMedia.length,
        });
      }
      setForm(prev => ({ ...prev, media: newMedia }));

      // Update checklist
      set('onboarding_checklist.photos_uploaded', true);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (idx) => {
    setForm(prev => {
      const updated = prev.media.filter((_, i) => i !== idx);
      if (updated.length > 0 && !updated.some(m => m.is_cover)) updated[0].is_cover = true;
      return { ...prev, media: updated };
    });
  };

  const setCover = (idx) => {
    setForm(prev => ({
      ...prev,
      media: prev.media.map((m, i) => ({ ...m, is_cover: i === idx })),
    }));
  };

  const handleSave = async (status = 'draft') => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.city.trim()) { toast.error('City is required'); return; }
    setSaving(true);

    // Build updated checklist
    const checklist = {
      ...form.onboarding_checklist,
      photos_uploaded: form.media.length > 0,
      pricing_set: !!(form.pricing.hourly_rate || form.pricing.full_day_rate),
      rules_set: true,
      address_verified: !!form.exact_address,
    };

    try {
      const payload = {
        ...form,
        owner_user_id: ownerUserId,
        status,
        onboarding_checklist: checklist,
        // Ensure arrays always present
        equipment: form.equipment || [],
        bundles: form.bundles || [],
        buffers: form.buffers || {},
        access_settings: form.access_settings || {},
        damage_deposit: form.damage_deposit || {},
      };

      // Call backend function for host eligibility enforcement
      const response = await base44.functions.invoke('manageProperty', {
        action: isEdit ? 'update' : 'create',
        property: isEdit ? { ...payload, id: property.id } : payload,
      });

      if (response?.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success(isEdit ? 'Property updated' : 'Property created');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CCCard padding="lg" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#4F8CFF]" />
          {isEdit ? 'Edit Property' : 'New Property Listing'}
        </h2>
        <button onClick={onCancel} className="text-[#6B7A94] hover:text-[#E8EEF9]">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        {field('Title *',
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Bright Downtown Loft Studio" className={INPUT} />
        )}
        {field('Property Type',
          <BottomSheetSelect
            value={form.property_type}
            onChange={val => set('property_type', val)}
            options={PROPERTY_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') }))}
            placeholder="Select property type"
          />
        )}
        {field('Owner Type',
          <BottomSheetSelect
            value={form.owner_type}
            onChange={val => set('owner_type', val)}
            options={OWNER_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))}
            placeholder="Select owner type"
          />
        )}
        {field('City *',
          <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Los Angeles" className={INPUT} />
        )}
        {field('State',
          <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="CA" className={INPUT} />
        )}
        {field('Exact Address (private)', 
          <input value={form.exact_address} onChange={e => set('exact_address', e.target.value)} placeholder="123 Main St..." className={INPUT} />,
          'Only revealed to confirmed bookings'
        )}
      </div>

      {field('Description',
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Describe your space..." className={INPUT + ' resize-none'} />
      )}

      {/* Photos */}
      {field('Photos',
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.media.map((m, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#0B0F14] border border-[#263248]">
                <img src={m.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button onClick={() => setCover(i)} title="Set as cover" className="p-1 bg-[#4F8CFF] rounded text-white text-xs">★</button>
                  <button onClick={() => removeMedia(i)} className="p-1 bg-[#EF4444] rounded text-white"><X className="w-3 h-3" /></button>
                </div>
                {m.is_cover && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-[#4F8CFF] text-white py-0.5">Cover</span>}
              </div>
            ))}
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[#263248] flex flex-col items-center justify-center cursor-pointer hover:border-[#4F8CFF] transition-colors">
              {uploading ? <div className="w-5 h-5 border-2 border-[#4F8CFF] border-t-transparent rounded-full animate-spin" /> : <Plus className="w-5 h-5 text-[#6B7A94]" />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Capacity */}
      <div className="grid grid-cols-3 gap-3">
        {field('Max People', <input type="number" value={form.capacity.max_people || ''} onChange={e => set('capacity.max_people', parseInt(e.target.value) || undefined)} placeholder="10" className={INPUT} />)}
        {field('Rooms', <input type="number" value={form.capacity.rooms || ''} onChange={e => set('capacity.rooms', parseInt(e.target.value) || undefined)} placeholder="2" className={INPUT} />)}
        {field('Sq Ft', <input type="number" value={form.capacity.sq_ft || ''} onChange={e => set('capacity.sq_ft', parseInt(e.target.value) || undefined)} placeholder="1200" className={INPUT} />)}
      </div>

      {/* Pricing */}
      <div>
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Pricing (USD)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {field('Hourly Rate', <input type="number" value={form.pricing.hourly_rate || ''} onChange={e => set('pricing.hourly_rate', parseFloat(e.target.value) || undefined)} placeholder="150" className={INPUT} />)}
          {field('Half-Day Rate', <input type="number" value={form.pricing.half_day_rate || ''} onChange={e => set('pricing.half_day_rate', parseFloat(e.target.value) || undefined)} placeholder="500" className={INPUT} />)}
          {field('Full-Day Rate', <input type="number" value={form.pricing.full_day_rate || ''} onChange={e => set('pricing.full_day_rate', parseFloat(e.target.value) || undefined)} placeholder="800" className={INPUT} />)}
          {field('Min Hours', <input type="number" value={form.pricing.minimum_hours || ''} onChange={e => set('pricing.minimum_hours', parseInt(e.target.value) || 1)} placeholder="1" className={INPUT} />)}
          {field('Deposit Amount', <input type="number" value={form.pricing.deposit_amount || ''} onChange={e => set('pricing.deposit_amount', parseFloat(e.target.value) || undefined)} placeholder="0" className={INPUT} />)}
        </div>
        {field('Pricing Notes', <input value={form.pricing.pricing_notes || ''} onChange={e => set('pricing.pricing_notes', e.target.value)} placeholder="e.g. Weekend rates may vary" className={INPUT} />)}

        {/* Cleaning Fee */}
        {cleaningFeeEnabled && (
          <div className="border-t border-[#263248] pt-3 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.pricing.cleaning_fee_enabled || false} onChange={e => set('pricing.cleaning_fee_enabled', e.target.checked)} />
              <span className="text-sm font-medium text-[#E8EEF9]">Charge a cleaning fee</span>
            </label>
            {form.pricing.cleaning_fee_enabled && (
              <div className="flex items-center gap-3 pl-6">
                <span className="text-sm text-[#9AA6BC]">$</span>
                <input type="number" value={form.pricing.cleaning_fee_amount || ''} onChange={e => set('pricing.cleaning_fee_amount', parseFloat(e.target.value) || undefined)} placeholder="e.g. 75" className={INPUT + ' w-32'} />
                <span className="text-xs text-[#6B7A94]">flat fee added to every booking</span>
              </div>
            )}
          </div>
        )}

        {/* Turnover Buffers */}
        <div className="border-t border-[#263248] pt-3">
          <p className="text-sm font-medium text-[#E8EEF9] mb-2">Turnover Buffers</p>
          <p className="text-xs text-[#6B7A94] mb-3">Blocks availability before/after each booking to prevent overlap during setup, teardown, and cleaning.</p>
          <div className="grid grid-cols-3 gap-3">
            {field('Setup (hrs)', <input type="number" min={0} step={0.5} value={form.buffers.setup_buffer_hours || ''} onChange={e => setForm(p => ({ ...p, buffers: { ...p.buffers, setup_buffer_hours: parseFloat(e.target.value) || 0 } }))} placeholder="0" className={INPUT} />)}
            {field('Teardown (hrs)', <input type="number" min={0} step={0.5} value={form.buffers.teardown_buffer_hours || ''} onChange={e => setForm(p => ({ ...p, buffers: { ...p.buffers, teardown_buffer_hours: parseFloat(e.target.value) || 0 } }))} placeholder="0" className={INPUT} />)}
            {field('Cleaning (hrs)', <input type="number" min={0} step={0.5} value={form.buffers.cleaning_buffer_hours || ''} onChange={e => setForm(p => ({ ...p, buffers: { ...p.buffers, cleaning_buffer_hours: parseFloat(e.target.value) || 0 } }))} placeholder="0" className={INPUT} />)}
          </div>
        </div>
      </div>

      {/* Amenities */}
      {field('Amenities',
        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAmenity(a)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                form.amenities.includes(a)
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#0B0F14] border border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Equipment */}
      {equipmentEnabled && (
        <PropertyEquipmentManager
          equipment={form.equipment}
          onChange={(eq) => setForm(prev => ({ ...prev, equipment: eq }))}
        />
      )}

      {/* Bundles */}
      {bundlesEnabled && (
        <PropertyBundleManager
          bundles={form.bundles}
          equipment={form.equipment}
          onChange={(b) => setForm(prev => ({ ...prev, bundles: b }))}
        />
      )}

      {/* Damage Deposit */}
      <PropertyDamageDepositSection
        deposit={form.damage_deposit}
        onChange={(d) => setForm(prev => ({ ...prev, damage_deposit: d }))}
      />

      {/* Cancellation Policy */}
      {cancellationPoliciesEnabled && (
        <div className="border-t border-[#263248] pt-4">
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Cancellation Policy</h3>
          <CancellationPolicySelector
            ownerUserId={ownerUserId}
            propertyId={property?.id}
            onChange={() => {}}
          />
        </div>
      )}

      {/* Access & Check-In Settings */}
      <PropertyAccessSettings
        settings={form.access_settings}
        onChange={(s) => setForm(prev => ({ ...prev, access_settings: s }))}
      />

      {/* Rules — structured via PropertyRulesManager */}
      <PropertyRulesManager
        rules={form.rules}
        onChange={(updatedRules) => setForm(prev => ({ ...prev, rules: updatedRules }))}
        propertyType={form.property_type}
      />

      {/* Instant book */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.instant_book} onChange={e => set('instant_book', e.target.checked)} />
        <div>
          <p className="text-sm font-medium text-[#E8EEF9]">⚡ Instant Book</p>
          <p className="text-xs text-[#6B7A94]">Bookings are confirmed automatically without host approval</p>
        </div>
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-[#263248]">
        <CCButton variant="outline" onClick={onCancel} disabled={saving}>Cancel</CCButton>
        <CCButton variant="outline" onClick={() => handleSave('draft')} loading={saving}>Save Draft</CCButton>
        <CCButton variant="primary" onClick={() => handleSave('active')} loading={saving}>
          {isEdit ? 'Update & Publish' : 'Publish Listing'}
        </CCButton>
      </div>
    </CCCard>
  );
}