import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { DollarSign, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, ArrowUp, ArrowDown } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';
import CCSelect from '../ui-custom/CCSelect';
import CCModal from '../ui-custom/CCModal';
import CCEmpty from '../ui-custom/CCEmpty';

const roleOptions = [
  { value: 'creator', label: 'Creator' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'video_editor', label: 'Video Editor' },
  { value: 'agent', label: 'Agent' },
  { value: 'studio', label: 'Studio' },
];

const tierOptions = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function PricingManager() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: () => base44.entities.PricingTier.list('sort_order'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PricingTier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingTiers'] });
      setIsCreating(false);
      setFormData({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PricingTier.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingTiers'] });
      setEditingPlan(null);
      setFormData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PricingTier.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingTiers'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.PricingTier.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingTiers'] });
    },
  });

  const handleSubmit = () => {
    const data = {
      ...formData,
      price_monthly: parseFloat(formData.price_monthly),
      price_yearly: parseFloat(formData.price_yearly),
      features: (formData.features || '').split('\n').filter(f => f.trim()),
      limits: formData.limits || {},
      is_active: formData.is_active !== false,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const startEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      ...plan,
      features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Pricing Plans</h3>
          <p className="text-sm text-[#6B7A94]">Manage subscription tiers and pricing</p>
        </div>
        <CCButton variant="primary" icon={Plus} onClick={() => setIsCreating(true)}>
          New Plan
        </CCButton>
      </div>

      {/* Plans Table */}
      {tiers.length === 0 ? (
        <CCEmpty
          icon={DollarSign}
          title="No pricing plans"
          description="Create your first pricing plan to get started."
        />
      ) : (
        <div className="space-y-3">
          {tiers.map((tier) => (
            <CCCard key={tier.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-[#E8EEF9]">{tier.name}</h4>
                      <CCBadge variant="outline" size="sm">{tier.tier}</CCBadge>
                      <CCBadge variant="accent" size="sm">{tier.role_type}</CCBadge>
                      {!tier.is_active && <CCBadge variant="danger" size="sm">Inactive</CCBadge>}
                    </div>
                    <p className="text-sm text-[#6B7A94] mt-1">
                      ${tier.price_monthly}/mo • ${tier.price_yearly}/yr
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={tier.is_active ? EyeOff : Eye}
                    onClick={() => toggleActiveMutation.mutate({ id: tier.id, isActive: tier.is_active })}
                  >
                    {tier.is_active ? 'Hide' : 'Show'}
                  </CCButton>
                  <CCButton variant="ghost" size="sm" icon={Edit2} onClick={() => startEdit(tier)}>
                    Edit
                  </CCButton>
                  <CCButton variant="ghost" size="sm" icon={Trash2} onClick={() => {
                    if (confirm('Delete this pricing plan?')) deleteMutation.mutate(tier.id);
                  }}>
                    Delete
                  </CCButton>
                </div>
              </div>
            </CCCard>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CCModal
        isOpen={isCreating || !!editingPlan}
        onClose={() => {
          setIsCreating(false);
          setEditingPlan(null);
          setFormData({});
        }}
        title={editingPlan ? 'Edit Plan' : 'Create New Plan'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Plan Name</label>
              <input
                type="text"
                placeholder="e.g., Creator Pro"
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Plan ID</label>
              <input
                type="text"
                placeholder="e.g., creator_pro"
                value={formData.plan_id || ''}
                onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
              <p className="text-xs text-[#6B7A94] mt-1">Unique identifier (lowercase, underscores)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CCSelect
              label="Role Type"
              options={roleOptions}
              value={formData.role_type || ''}
              onChange={(e) => setFormData({...formData, role_type: e.target.value})}
            />
            <CCSelect
              label="Tier"
              options={tierOptions}
              value={formData.tier || ''}
              onChange={(e) => setFormData({...formData, tier: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Monthly Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_monthly || ''}
                onChange={(e) => setFormData({...formData, price_monthly: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Yearly Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_yearly || ''}
                onChange={(e) => setFormData({...formData, price_yearly: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Description</label>
            <input
              type="text"
              placeholder="Short plan description..."
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Features</label>
            <textarea
              value={formData.features || ''}
              onChange={(e) => setFormData({...formData, features: e.target.value})}
              placeholder="One feature per line..."
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
            />
            <p className="text-xs text-[#6B7A94] mt-1">Enter each feature on a new line</p>
          </div>

          {/* Stripe Integration */}
          <div className="border border-[#263248] rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-[#E8EEF9] flex items-center gap-2">
              <span className="text-[#4F8CFF]">💳</span> Stripe Integration
            </p>
            <p className="text-xs text-[#6B7A94]">
              Add Stripe Payment Links (from your Stripe dashboard) to enable direct checkout. Users will be redirected to Stripe to complete payment securely.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Monthly Payment Link</label>
                <input
                  type="url"
                  placeholder="https://buy.stripe.com/..."
                  value={formData.stripe_payment_link_monthly || ''}
                  onChange={(e) => setFormData({...formData, stripe_payment_link_monthly: e.target.value})}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Yearly Payment Link</label>
                <input
                  type="url"
                  placeholder="https://buy.stripe.com/..."
                  value={formData.stripe_payment_link_yearly || ''}
                  onChange={(e) => setFormData({...formData, stripe_payment_link_yearly: e.target.value})}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Stripe Price ID (monthly) — for future Checkout Sessions</label>
                <input
                  type="text"
                  placeholder="price_1ABC..."
                  value={formData.stripe_price_id_monthly || ''}
                  onChange={(e) => setFormData({...formData, stripe_price_id_monthly: e.target.value})}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Stripe Price ID (yearly) — for future Checkout Sessions</label>
                <input
                  type="text"
                  placeholder="price_1XYZ..."
                  value={formData.stripe_price_id_yearly || ''}
                  onChange={(e) => setFormData({...formData, stripe_price_id_yearly: e.target.value})}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => {
              setIsCreating(false);
              setEditingPlan(null);
              setFormData({});
            }}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!formData.name || !formData.plan_id || !formData.role_type}
            >
              {editingPlan ? 'Update' : 'Create'}
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}