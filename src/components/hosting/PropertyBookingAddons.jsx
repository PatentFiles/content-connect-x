/**
 * PropertyBookingAddons
 * Guest-facing step injected into SoloSessionBookingModal for location bookings.
 * Lets the guest:
 *   - Select a bundle (if any)
 *   - Add rentable equipment
 *   - Acknowledge any required liability disclosures
 *   - See a live pricing breakdown including cleaning fee
 *
 * Returns via onUpdate(snapshot) where snapshot = { bundle_id, bundle_name,
 *   selected_equipment, pricing_breakdown, liability_acks }
 *
 * Props:
 *   property       – Property record (with equipment[], bundles[], pricing, buffers)
 *   hours          – Booking duration (number, used for hourly calc preview)
 *   onUpdate(snap) – Called on every change to keep parent in sync
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Wrench, AlertTriangle, DollarSign } from 'lucide-react';

export default function PropertyBookingAddons({ property, hours = 1, onUpdate }) {
  const equipment = property?.equipment || [];
  const bundles = property?.bundles || [];
  const pricing = property?.pricing || {};
  const buffers = property?.buffers || {};

  const defaultBundle = bundles.find(b => b.is_default) || bundles[0] || null;
  const [selectedBundleId, setSelectedBundleId] = useState(defaultBundle?.id || null);
  const [selectedEquipIds, setSelectedEquipIds] = useState([]);
  const [liabilityAcks, setLiabilityAcks] = useState({});

  const rentableEquipment = equipment.filter(e => e.rentable);
  const selectedBundle = bundles.find(b => b.id === selectedBundleId) || null;

  // Equipment included via bundle (already paid for, can't re-rent)
  const bundleEquipIds = new Set(selectedBundle?.included_equipment_ids || []);

  const toggleEquip = (id) => {
    setSelectedEquipIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const ackLiability = (itemId, text) => {
    setLiabilityAcks(prev => ({ ...prev, [itemId]: { text, accepted_at: new Date().toISOString() } }));
  };

  // Pricing breakdown
  const breakdown = useMemo(() => {
    const baseRate = pricing.hourly_rate || 0;
    const baseTotal = baseRate * hours;

    let bundleModifier = 0;
    if (selectedBundle) {
      if (selectedBundle.price_modifier_type === 'percent') {
        bundleModifier = baseTotal * (selectedBundle.price_modifier / 100);
      } else {
        bundleModifier = selectedBundle.price_modifier || 0;
      }
    }

    const selectedEquipItems = equipment.filter(e => selectedEquipIds.includes(e.id));
    const equipmentTotal = selectedEquipItems.reduce((sum, e) => sum + (e.rental_price || 0), 0);
    const depositTotal = selectedEquipItems.filter(e => e.deposit_required).reduce((sum, e) => sum + (e.deposit_amount || 0), 0);
    const cleaningFee = pricing.cleaning_fee_enabled ? (pricing.cleaning_fee_amount || 0) : 0;

    return {
      base_rate: baseRate,
      base_rate_type: 'hourly',
      hours,
      bundle_modifier: bundleModifier,
      equipment_total: equipmentTotal,
      cleaning_fee: cleaningFee,
      deposit_total: depositTotal,
      grand_total: baseTotal + bundleModifier + equipmentTotal + cleaningFee,
      currency: pricing.currency || 'USD',
    };
  }, [selectedBundleId, selectedEquipIds, hours, pricing, equipment]);

  // Items requiring liability ack
  const liabilityRequired = useMemo(() => {
    const items = [];
    if (selectedBundle?.requires_liability_ack) {
      items.push({ id: `bundle_${selectedBundle.id}`, name: selectedBundle.name, text: selectedBundle.liability_text });
    }
    selectedEquipIds.forEach(id => {
      const eq = equipment.find(e => e.id === id);
      if (eq?.requires_liability_ack) {
        items.push({ id: `equip_${eq.id}`, name: eq.name, text: eq.liability_text });
      }
    });
    return items;
  }, [selectedBundle, selectedEquipIds, equipment]);

  const allLiabilityAcked = liabilityRequired.every(item => !!liabilityAcks[item.id]);

  // Push snapshot up on every change
  useEffect(() => {
    const snapshot = {
      property_id: property?.id,
      bundle_id: selectedBundleId,
      bundle_name: selectedBundle?.name || null,
      selected_equipment: selectedEquipIds.map(id => {
        const eq = equipment.find(e => e.id === id);
        return {
          equipment_id: id,
          name: eq?.name || '',
          quantity: eq?.quantity || 1,
          rental_price: eq?.rental_price || 0,
          deposit_amount: eq?.deposit_required ? (eq?.deposit_amount || 0) : 0,
          liability_ack: !!liabilityAcks[`equip_${id}`],
        };
      }),
      pricing_breakdown: breakdown,
      liability_acks: liabilityRequired.map(item => ({
        item_id: item.id,
        item_name: item.name,
        liability_text: item.text,
        accepted_at: liabilityAcks[item.id]?.accepted_at || null,
      })),
      buffers: {
        setup_buffer_hours: buffers.setup_buffer_hours || 0,
        teardown_buffer_hours: buffers.teardown_buffer_hours || 0,
        cleaning_buffer_hours: buffers.cleaning_buffer_hours || 0,
      },
      all_liability_acked: allLiabilityAcked,
    };
    onUpdate(snapshot);
  }, [selectedBundleId, selectedEquipIds, liabilityAcks, breakdown]);

  const hasContent = bundles.length > 0 || rentableEquipment.length > 0 || pricing.cleaning_fee_enabled;
  if (!hasContent) return null;

  return (
    <div className="space-y-5">

      {/* Bundles */}
      {bundles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[#E8EEF9] mb-2 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-[#FF2DAA]" /> Package
          </label>
          <div className="space-y-2">
            {bundles.map(bundle => (
              <button
                key={bundle.id}
                type="button"
                onClick={() => setSelectedBundleId(bundle.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedBundleId === bundle.id
                    ? 'border-[#FF2DAA] bg-[#FF2DAA]/10'
                    : 'border-[#263248] hover:border-[#3A4A6B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#E8EEF9]">{bundle.name}</p>
                  {bundle.price_modifier !== 0 && (
                    <span className={`text-xs font-semibold ${bundle.price_modifier > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}>
                      {bundle.price_modifier > 0 ? '+' : ''}{bundle.price_modifier_type === 'percent' ? `${bundle.price_modifier}%` : `$${bundle.price_modifier}`}
                    </span>
                  )}
                </div>
                {bundle.description && <p className="text-xs text-[#9AA6BC] mt-0.5">{bundle.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rentable equipment add-ons */}
      {rentableEquipment.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[#E8EEF9] mb-2 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-[#4F8CFF]" /> Equipment Add-ons
          </label>
          <div className="space-y-1.5">
            {rentableEquipment.map(eq => {
              const inBundle = bundleEquipIds.has(eq.id);
              const selected = selectedEquipIds.includes(eq.id);
              return (
                <label key={eq.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                  inBundle ? 'border-[#22C55E]/40 opacity-60 cursor-default' :
                  selected ? 'border-[#4F8CFF] bg-[#4F8CFF]/10' : 'border-[#263248] hover:border-[#3A4A6B]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      disabled={inBundle}
                      checked={inBundle || selected}
                      onChange={() => !inBundle && toggleEquip(eq.id)}
                    />
                    <div>
                      <p className="text-sm text-[#E8EEF9]">{eq.name || eq.category}</p>
                      {eq.notes && <p className="text-xs text-[#6B7A94]">{eq.notes}</p>}
                      {inBundle && <p className="text-xs text-[#22C55E]">Included in selected package</p>}
                    </div>
                  </div>
                  {!inBundle && eq.rental_price && (
                    <span className="text-sm font-semibold text-[#E8EEF9]">+${eq.rental_price}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Pricing breakdown */}
      <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#263248] space-y-1.5">
        <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2 flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" /> Pricing Breakdown
        </p>
        <Row label={`Space (${hours}h × $${breakdown.base_rate})`} value={`$${(breakdown.base_rate * hours).toFixed(2)}`} />
        {breakdown.bundle_modifier !== 0 && (
          <Row label="Package modifier" value={`${breakdown.bundle_modifier >= 0 ? '+' : ''}$${breakdown.bundle_modifier.toFixed(2)}`} accent={breakdown.bundle_modifier < 0 ? 'green' : 'amber'} />
        )}
        {breakdown.equipment_total > 0 && (
          <Row label="Equipment add-ons" value={`+$${breakdown.equipment_total.toFixed(2)}`} />
        )}
        {breakdown.cleaning_fee > 0 && (
          <Row label="Cleaning fee" value={`+$${breakdown.cleaning_fee.toFixed(2)}`} />
        )}
        {breakdown.deposit_total > 0 && (
          <Row label="Refundable deposit" value={`+$${breakdown.deposit_total.toFixed(2)}`} accent="amber" />
        )}
        <div className="border-t border-[#263248] pt-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#E8EEF9]">Estimated Total</span>
          <span className="text-sm font-bold text-[#4F8CFF]">${breakdown.grand_total.toFixed(2)}</span>
        </div>
      </div>

      {/* Liability acknowledgments */}
      {liabilityRequired.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#F59E0B] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Liability Acknowledgments Required
          </p>
          {liabilityRequired.map(item => (
            <div key={item.id} className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-[#E8EEF9] mb-1">{item.name}</p>
              <p className="text-xs text-[#9AA6BC] mb-2">{item.text}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={!!liabilityAcks[item.id]} onChange={e => e.target.checked && ackLiability(item.id, item.text)} className="mt-0.5" />
                <span className="text-xs text-[#E8EEF9]">I understand and accept this liability disclosure</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }) {
  const valueColor = accent === 'green' ? 'text-[#22C55E]' : accent === 'amber' ? 'text-[#F59E0B]' : 'text-[#E8EEF9]';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#9AA6BC]">{label}</span>
      <span className={`text-xs font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}