/**
 * TemplateManager — Admin UI for managing Smart Deal Templates
 * 
 * Features:
 * - List all templates with status, category, role applicability
 * - Create new templates with token schema builder
 * - Edit existing templates (content + schema)
 * - Activate / deactivate templates
 * - Token schema management (add/remove tokens, mark required)
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Edit2, ToggleLeft, ToggleRight, Trash2,
  ChevronDown, ChevronUp, Hash, Save, X, AlertTriangle, Eye
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'creator_to_creator', label: 'Creator ↔ Creator' },
  { value: 'studio_contract', label: 'Studio Contract' },
  { value: 'photographer_contract', label: 'Photographer' },
  { value: 'videographer_contract', label: 'Videographer' },
  { value: 'agent_managed', label: 'Agent-Managed' },
  { value: 'custom', label: 'Custom' },
];

const ROLE_OPTIONS = [
  { value: 'creator_to_creator', label: 'Creator ↔ Creator' },
  { value: 'studio_contract', label: 'With Studio' },
  { value: 'photographer_contract', label: 'With Photographer' },
  { value: 'videographer_contract', label: 'With Videographer' },
  { value: 'agent_managed', label: 'Agent-Managed' },
];

// Common auto-resolvable tokens for hint display
const AUTO_TOKENS = [
  'collaboration_name', 'effective_date', 'shoot_date', 'location', 'creator_names',
  'creator_1_name', 'creator_2_name', 'studio_name', 'agent_name', 'photographer_name',
  'videographer_name', 'compensation_type', 'compensation_amount', 'revenue_split',
  'deliverables', 'delivery_timeline', 'platforms', 'exclusivity', 'exclusivity_period',
  'resale_allowed', 'credit_rules', 'scene_types', 'acts_agreed', 'hard_limits',
  'soft_limits', 'aftercare_required', 'ownership_model', 'ai_use_policy', 'takedown_policy',
];

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'custom',
  applicable_roles: [],
  is_active: true,
  is_default: false,
  content: '',
  token_schema: {},
  version: 1,
};

function TokenSchemaEditor({ schema, onChange }) {
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newHint, setNewHint] = useState('');

  const addToken = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    onChange({ ...schema, [key]: { label: newLabel || key, required: newRequired, hint: newHint, type: 'string' } });
    setNewKey(''); setNewLabel(''); setNewRequired(false); setNewHint('');
  };

  const removeToken = (key) => {
    const updated = { ...schema };
    delete updated[key];
    onChange(updated);
  };

  const toggleRequired = (key) => {
    onChange({ ...schema, [key]: { ...schema[key], required: !schema[key].required } });
  };

  const isAutoToken = (key) => AUTO_TOKENS.includes(key);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-4 h-4 text-[#4F8CFF]" />
        <span className="text-sm font-semibold text-[#E8EEF9]">Token Schema</span>
        <span className="text-xs text-[#6B7A94]">(use {'{{'} token_name {'}}' } in content)</span>
      </div>

      {/* Existing tokens */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {Object.entries(schema || {}).map(([key, def]) => (
          <div key={key} className="flex items-center gap-2 p-2 bg-[#0D1520] border border-[#263248] rounded-lg">
            <code className="text-xs text-[#4F8CFF] flex-shrink-0">{`{{${key}}}`}</code>
            <span className="text-xs text-[#9AA6BC] flex-1 truncate">{def.label || key}</span>
            {isAutoToken(key) && <CCBadge variant="success" size="sm">Auto</CCBadge>}
            {def.required && <CCBadge variant="warning" size="sm">Required</CCBadge>}
            <button onClick={() => toggleRequired(key)} className="text-[#6B7A94] hover:text-[#F59E0B] p-1">
              <span className="text-xs">{def.required ? 'Req' : 'Opt'}</span>
            </button>
            <button onClick={() => removeToken(key)} className="text-[#6B7A94] hover:text-[#EF4444] p-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {Object.keys(schema || {}).length === 0 && (
          <p className="text-xs text-[#6B7A94] italic">No tokens defined. Add tokens below.</p>
        )}
      </div>

      {/* Add token */}
      <div className="border border-[#263248] rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-[#9AA6BC]">Add Token</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="bg-[#121824] border border-[#263248] rounded px-2 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
            placeholder="token_key"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
          />
          <input
            className="bg-[#121824] border border-[#263248] rounded px-2 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
            placeholder="Display Label"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
          />
        </div>
        <input
          className="w-full bg-[#121824] border border-[#263248] rounded px-2 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
          placeholder="Hint text (optional)"
          value={newHint}
          onChange={e => setNewHint(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[#9AA6BC] cursor-pointer">
            <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="w-4 h-4" />
            Required field
          </label>
          <CCButton size="sm" variant="primary" onClick={addToken} disabled={!newKey.trim()}>
            Add Token
          </CCButton>
        </div>
      </div>

      {/* Auto-token reference */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[#6B7A94] hover:text-[#9AA6BC]">
          View all auto-populated tokens (no manual input needed)
        </summary>
        <div className="mt-2 flex flex-wrap gap-1">
          {AUTO_TOKENS.map(t => (
            <code key={t} className="px-1.5 py-0.5 bg-[#0D1520] border border-[#22C55E]/20 rounded text-[#22C55E]">{`{{${t}}}`}</code>
          ))}
        </div>
      </details>
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel, currentUser }) {
  const [form, setForm] = useState(template || { ...EMPTY_FORM, created_by: currentUser?.email });
  const [previewContent, setPreviewContent] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const toggleRole = (role) => {
    const current = form.applicable_roles || [];
    set('applicable_roles', current.includes(role) ? current.filter(r => r !== role) : [...current, role]);
  };

  return (
    <div className="space-y-5">
      <CCInput label="Template Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Standard Creator Deal" />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#E8EEF9]">Description</label>
        <textarea
          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[60px]"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Brief description of when to use this template"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#E8EEF9]">Category</label>
        <select
          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          value={form.category}
          onChange={e => set('category', e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#E8EEF9]">Applicable Collaboration Types</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => toggleRole(r.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                (form.applicable_roles || []).includes(r.value)
                  ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white'
                  : 'bg-transparent border-[#263248] text-[#9AA6BC] hover:border-[#4F8CFF]/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#6B7A94]">Leave empty to show for all collaboration types.</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-[#E8EEF9]">Template Content *</label>
          <button onClick={() => setPreviewContent(!previewContent)} className="text-xs text-[#4F8CFF] flex items-center gap-1">
            <Eye className="w-3 h-3" /> {previewContent ? 'Edit' : 'Preview'}
          </button>
        </div>
        {previewContent ? (
          <pre className="w-full bg-[#0D1520] border border-[#263248] rounded-lg p-3 text-xs text-[#9AA6BC] whitespace-pre-wrap font-mono min-h-[200px] overflow-y-auto">
            {form.content || '(empty)'}
          </pre>
        ) : (
          <textarea
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] font-mono focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[200px]"
            value={form.content}
            onChange={e => set('content', e.target.value)}
            placeholder={`CONTRACT AGREEMENT\n\nThis agreement is entered into as of {{effective_date}}\n\nBetween: {{creator_names}}\n\nProject: {{collaboration_name}}\nDate: {{shoot_date}}\nLocation: {{location}}\n\nCompensation: {{compensation_amount}}\nDeliverables: {{deliverables}}\n\n...`}
          />
        )}
        <p className="text-xs text-[#6B7A94]">Use {'{{'} token_name {'}}' } for dynamic values. Auto-populated tokens require no user input.</p>
      </div>

      <TokenSchemaEditor schema={form.token_schema || {}} onChange={val => set('token_schema', val)} />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[#9AA6BC] cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
          Active (visible to users)
        </label>
        <label className="flex items-center gap-2 text-sm text-[#9AA6BC] cursor-pointer">
          <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} className="w-4 h-4" />
          Platform default
        </label>
      </div>

      <div className="flex gap-3 pt-4 border-t border-[#263248]">
        <CCButton variant="outline" fullWidth onClick={onCancel}>Cancel</CCButton>
        <CCButton
          variant="primary"
          fullWidth
          icon={Save}
          disabled={!form.name.trim() || !form.content.trim()}
          onClick={() => onSave(form)}
        >
          {template ? 'Save Changes' : 'Create Template'}
        </CCButton>
      </div>
    </div>
  );
}

export default function TemplateManager() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['allContractTemplates'],
    queryFn: () => base44.entities.ContractTemplate.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (form.id) {
        return base44.entities.ContractTemplate.update(form.id, form);
      } else {
        return base44.entities.ContractTemplate.create({ ...form, created_by: user?.email, version: 1 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allContractTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['contractTemplates'] });
      toast.success(editingTemplate ? 'Template updated' : 'Template created');
      setEditingTemplate(null);
      setCreating(false);
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.ContractTemplate.update(id, { is_active: !is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allContractTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['contractTemplates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allContractTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['contractTemplates'] });
      toast.success('Template deleted');
    },
  });

  if (creating || editingTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CCButton variant="ghost" size="sm" icon={X} onClick={() => { setCreating(false); setEditingTemplate(null); }}>
            Back to Templates
          </CCButton>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">
            {editingTemplate ? `Edit: ${editingTemplate.name}` : 'New Template'}
          </h3>
        </div>
        <TemplateForm
          template={editingTemplate}
          onSave={(form) => saveMutation.mutate(form)}
          onCancel={() => { setCreating(false); setEditingTemplate(null); }}
          currentUser={user}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#E8EEF9]">Smart Deal Templates</h2>
          <p className="text-sm text-[#6B7A94] mt-1">
            Manage contract templates. Token values are auto-populated from collaboration data.
          </p>
        </div>
        <CCButton variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          New Template
        </CCButton>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <CCBadge variant="success">{templates.filter(t => t.is_active).length} Active</CCBadge>
        <CCBadge variant="default">{templates.filter(t => !t.is_active).length} Inactive</CCBadge>
        <CCBadge variant="primary">{templates.filter(t => t.is_default).length} Platform Defaults</CCBadge>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[#9AA6BC]">Loading templates...</div>
      ) : templates.length === 0 ? (
        <CCEmpty
          icon={FileText}
          title="No templates yet"
          description="Create your first smart deal template. Token values will be auto-populated from collaboration data."
          action={() => setCreating(true)}
          actionLabel="Create Template"
        />
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const isExpanded = expandedId === t.id;
            const tokenCount = Object.keys(t.token_schema || {}).length;
            return (
              <CCCard key={t.id} padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex items-start gap-3 flex-1 cursor-pointer min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${t.is_active ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-[#E8EEF9]">{t.name}</span>
                        {t.is_active
                          ? <CCBadge variant="success" size="sm">Active</CCBadge>
                          : <CCBadge variant="default" size="sm">Inactive</CCBadge>
                        }
                        {t.is_default && <CCBadge variant="primary" size="sm">Default</CCBadge>}
                        <CCBadge variant="outline" size="sm">
                          {CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                        </CCBadge>
                      </div>
                      <p className="text-sm text-[#9AA6BC]">{t.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7A94]">
                        <span>{tokenCount} token{tokenCount !== 1 ? 's' : ''}</span>
                        {(t.applicable_roles || []).length > 0 && (
                          <span>Roles: {t.applicable_roles.join(', ')}</span>
                        )}
                        <span>v{t.version || 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: t.is_active })}
                      className="text-[#6B7A94] hover:text-[#E8EEF9] p-1"
                      title={t.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {t.is_active
                        ? <ToggleRight className="w-5 h-5 text-[#22C55E]" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      onClick={() => setEditingTemplate(t)}
                    />
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        if (confirm(`Delete "${t.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(t.id);
                        }
                      }}
                    />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#263248] space-y-3">
                    {tokenCount > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Token Schema</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(t.token_schema || {}).map(([key, def]) => (
                            <div key={key} className="flex items-center gap-1 px-2 py-1 bg-[#0D1520] border border-[#263248] rounded text-xs">
                              <code className="text-[#4F8CFF]">{`{{${key}}}`}</code>
                              {def.required && <span className="text-[#F59E0B]">*</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Content Preview</p>
                      <pre className="text-xs text-[#6B7A94] bg-[#0D1520] rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                        {(t.content || '').substring(0, 500)}{t.content?.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                )}
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}