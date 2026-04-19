import React, { useState } from 'react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Ticket, Plus, Copy, Eye, EyeOff, Edit2, Trash2, Sparkles, CheckCircle } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';
import CCSelect from '../ui-custom/CCSelect';
import CCModal from '../ui-custom/CCModal';
import CCEmpty from '../ui-custom/CCEmpty';
import { toast } from 'sonner';

const discountTypes = [
  { value: 'PERCENT', label: 'Percentage Off' },
  { value: 'FIXED', label: 'Fixed Amount Off' },
  { value: 'FREE_MONTHS', label: 'Free Months' },
];

const roleOptions = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'creator', label: 'Creator' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'agent', label: 'Agent' },
  { value: 'studio', label: 'Studio' },
];

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export default function CouponManager({ user }) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    applies_to_role_types: ['ALL'],
    applies_to_plan_ids: ['ALL'],
  });
  const queryClient = useQueryClient();

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => base44.entities.Coupon.list('-created_date'),
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['redemptions'],
    queryFn: () => base44.entities.CouponRedemption.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Coupon.create({
      ...data,
      created_by_admin_id: user.email,
      redeemed_count: 0,
      is_active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['coupons']);
      setIsCreating(false);
      setFormData({ applies_to_role_types: ['ALL'], applies_to_plan_ids: ['ALL'] });
      toast.success('Coupon created successfully');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.Coupon.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['coupons']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Coupon.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['coupons']);
    },
  });

  const handleSubmit = () => {
    const data = {
      code: formData.code?.toUpperCase(),
      description: formData.description,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      applies_to_role_types: formData.applies_to_role_types,
      applies_to_plan_ids: formData.applies_to_plan_ids,
      max_redemptions_total: formData.max_redemptions_total ? parseInt(formData.max_redemptions_total) : null,
      max_redemptions_per_user: formData.max_redemptions_per_user ? parseInt(formData.max_redemptions_per_user) : null,
      starts_at: formData.starts_at || null,
      expires_at: formData.expires_at || null,
    };
    createMutation.mutate(data);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  };

  const getRedemptionsForCoupon = (couponId) => {
    return redemptions.filter(r => r.coupon_id === couponId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Coupon Codes</h3>
          <p className="text-sm text-[#6B7A94]">Generate and manage discount coupons</p>
        </div>
        <CCButton variant="accent" icon={Plus} onClick={() => setIsCreating(true)}>
          Generate Coupon
        </CCButton>
      </div>

      {/* Coupons Table */}
      {coupons.length === 0 ? (
        <CCEmpty
          icon={Ticket}
          title="No coupons yet"
          description="Generate coupon codes to offer discounts to users."
        />
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => {
            const redemptions = getRedemptionsForCoupon(coupon.id);
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isMaxed = coupon.max_redemptions_total && coupon.redeemed_count >= coupon.max_redemptions_total;

            return (
              <CCCard key={coupon.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-lg font-mono font-bold text-[#4F8CFF]">{coupon.code}</code>
                      <CCButton variant="ghost" size="sm" icon={Copy} onClick={() => copyCode(coupon.code)}>
                        Copy
                      </CCButton>
                      <CCBadge variant={
                        coupon.discount_type === 'PERCENT' ? 'warning' : 
                        coupon.discount_type === 'FIXED' ? 'success' : 
                        'primary'
                      }>
                        {coupon.discount_type === 'PERCENT' && `${coupon.discount_value}% OFF`}
                        {coupon.discount_type === 'FIXED' && `$${coupon.discount_value} OFF`}
                        {coupon.discount_type === 'FREE_MONTHS' && `${coupon.discount_value} FREE MONTHS`}
                      </CCBadge>
                      {!coupon.is_active && <CCBadge variant="danger">Inactive</CCBadge>}
                      {isExpired && <CCBadge variant="danger">Expired</CCBadge>}
                      {isMaxed && <CCBadge variant="warning">Max Uses Reached</CCBadge>}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-[#9AA6BC]">
                      {coupon.description && <span>{coupon.description}</span>}
                      <span>Used: {coupon.redeemed_count}{coupon.max_redemptions_total ? `/${coupon.max_redemptions_total}` : ''}</span>
                      {coupon.expires_at && (
                        <span>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</span>
                      )}
                      <span>For: {coupon.applies_to_role_types?.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={coupon.is_active ? EyeOff : Eye}
                      onClick={() => toggleActiveMutation.mutate({ id: coupon.id, isActive: coupon.is_active })}
                    >
                      {coupon.is_active ? 'Deactivate' : 'Activate'}
                    </CCButton>
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        if (confirm(`Delete coupon ${coupon.code}?`)) deleteMutation.mutate(coupon.id);
                      }}
                    >
                      Delete
                    </CCButton>
                  </div>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CCModal
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false);
          setFormData({ applies_to_role_types: ['ALL'], applies_to_plan_ids: ['ALL'] });
        }}
        title="Generate Coupon Code"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Coupon Code</label>
              <input
                type="text"
                placeholder="SUMMER2024"
                value={formData.code || ''}
                onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
            <div className="flex items-end">
              <CCButton
                variant="outline"
                icon={Sparkles}
                onClick={() => setFormData({...formData, code: generateCode()})}
              >
                Generate
              </CCButton>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Description (optional)</label>
            <input
              type="text"
              placeholder="Summer promotion"
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CCSelect
              label="Discount Type"
              options={discountTypes}
              value={formData.discount_type || ''}
              onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
            />
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                {formData.discount_type === 'PERCENT' ? 'Percentage (%)' :
                formData.discount_type === 'FIXED' ? 'Amount ($)' :
                formData.discount_type === 'FREE_MONTHS' ? 'Free Months' :
                'Value'}
              </label>
              <input
                type="number"
                step={formData.discount_type === 'PERCENT' ? '1' : '0.01'}
                value={formData.discount_value || ''}
                onChange={(e) => setFormData({...formData, discount_value: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Start Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.starts_at || ''}
                onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Expiration Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.expires_at || ''}
                onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Max Total Uses (optional)</label>
              <input
                type="number"
                placeholder="Unlimited"
                value={formData.max_redemptions_total || ''}
                onChange={(e) => setFormData({...formData, max_redemptions_total: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Max Uses Per User (optional)</label>
              <input
                type="number"
                placeholder="Unlimited"
                value={formData.max_redemptions_per_user || ''}
                onChange={(e) => setFormData({...formData, max_redemptions_per_user: e.target.value})}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="accent"
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!formData.code || !formData.discount_type || !formData.discount_value}
            >
              Create Coupon
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}