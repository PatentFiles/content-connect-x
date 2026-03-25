/**
 * TemplateContractGenerator — Smart Deal Template UI
 *
 * - Auto-populates tokens from collaboration data via templateTokenResolver
 * - Shows auto-filled fields (read-only with override option) vs required manual fields
 * - Filters templates by role/context applicability
 * - Validates before generating
 * - Uses existing contract/version/audit/snapshot pipeline unchanged
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, CheckCircle, ChevronDown, ChevronUp,
  Zap, AlertTriangle, Lock, Edit2, Info, Eye
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCModal from '@/components/ui-custom/CCModal';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import {
  resolveTokensFromCollaboration,
  classifyTokens,
  isTemplateApplicable,
  applyTokensToContent,
} from '@/lib/templateTokenResolver';

const CATEGORY_LABELS = {
  creator_to_creator: 'Creator ↔ Creator',
  studio_contract: 'Studio Contract',
  photographer_contract: 'Photographer',
  videographer_contract: 'Videographer',
  agent_managed: 'Agent-Managed',
  custom: 'Custom',
};

function AutoFilledField({ label, value, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState(value);

  if (editing) {
    return (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#9AA6BC]">{label}</label>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#121824] border border-[#4F8CFF]/40 rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            value={override}
            onChange={e => setOverride(e.target.value)}
          />
          <CCButton size="sm" variant="primary" onClick={() => { onOverride(override); setEditing(false); }}>Save</CCButton>
          <CCButton size="sm" variant="ghost" onClick={() => { setOverride(value); setEditing(false); }}>Cancel</CCButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-3 bg-[#0D1520] border border-[#22C55E]/20 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <Zap className="w-3 h-3 text-[#22C55E] flex-shrink-0" />
        <span className="text-xs text-[#9AA6BC] flex-shrink-0">{label}:</span>
        <span className="text-sm text-[#E8EEF9] truncate">{value || <em className="text-[#6B7A94]">empty</em>}</span>
      </div>
      <button onClick={() => setEditing(true)} className="text-[#6B7A94] hover:text-[#9AA6BC] flex-shrink-0">
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function TemplateContractGenerator({ collaborationId, onContractCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [manualValues, setManualValues] = useState({});
  const [overrides, setOverrides] = useState({});
  const [showAutoFilled, setShowAutoFilled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['contractTemplates'],
    queryFn: () => base44.entities.ContractTemplate.filter({ is_active: true }),
  });

  const { data: collaboration } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: () => base44.entities.Collaboration.filter({ id: collaborationId }),
    enabled: !!collaborationId && isOpen,
    select: d => d[0],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['allProfilesForTemplate'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: isOpen,
  });

  // Auto-resolve tokens from collaboration data
  const { autoFilled } = useMemo(
    () => resolveTokensFromCollaboration({ collaboration, profiles }),
    [collaboration, profiles]
  );

  // Merge: autoFilled → overrides → manual values form the final token map
  const resolvedTokens = useMemo(() => ({ ...autoFilled, ...overrides }), [autoFilled, overrides]);

  // Classify tokens for selected template
  const { required: requiredTokens, optional: optionalTokens } = useMemo(() => {
    if (!selectedTemplate?.token_schema) return { required: [], optional: [] };
    return classifyTokens(selectedTemplate.token_schema, resolvedTokens);
  }, [selectedTemplate, resolvedTokens]);

  // Auto-filled tokens that exist in the schema
  const autoFilledInSchema = useMemo(() => {
    if (!selectedTemplate?.token_schema) return [];
    return Object.entries(selectedTemplate.token_schema)
      .filter(([key]) => resolvedTokens[key] !== undefined && resolvedTokens[key] !== '')
      .map(([key, schema]) => ({ key, schema, value: overrides[key] ?? resolvedTokens[key] }));
  }, [selectedTemplate, resolvedTokens, overrides]);

  // Validation: required fields must have values
  const allTokenValues = useMemo(() => ({
    ...resolvedTokens,
    ...manualValues,
  }), [resolvedTokens, manualValues]);

  const missingRequired = requiredTokens.filter(t => !allTokenValues[t.key] && !manualValues[t.key]);

  // Template applicability check
  const getApplicability = (template) => isTemplateApplicable(template, collaboration);

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template);
    setManualValues({});
    setOverrides({});
    setShowPreview(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTemplate(null);
    setManualValues({});
    setOverrides({});
    setShowPreview(false);
  };

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return applyTokensToContent(selectedTemplate.content, { ...allTokenValues, ...manualValues });
  }, [selectedTemplate, allTokenValues, manualValues]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const finalTokens = { ...allTokenValues, ...manualValues };

      // Step 1: Validate contract initiation (existing pipeline)
      const validation = await base44.functions.invoke('validateContractInitiation', {
        collaboration_id: collaborationId,
      });
      if (!validation.data.can_initiate) {
        throw new Error(
          `Cannot initiate contract: ${(validation.data.validation_errors || []).map(e => e.message).join(', ')}`
        );
      }

      // Step 2: Snapshot
      const snapshotResult = await base44.functions.invoke('createContractSnapshot', {
        collaboration_id: collaborationId,
      });
      const snapshot = snapshotResult.data.snapshot;

      // Step 3: Studio split validation
      const splitValidation = await base44.functions.invoke('validateContractStudioSplit', {
        collaboration_id: collaborationId,
        contract_snapshot: snapshot,
      });
      if (!splitValidation.data.can_finalize) {
        throw new Error(
          `Studio split required: ${(splitValidation.data.validation_errors || []).map(e => e.message).join(', ')}`
        );
      }

      // Step 4: Apply tokens to template content
      const generatedContent = applyTokensToContent(selectedTemplate.content, finalTokens);

      // Step 5: Create Contract
      const contract = await base44.entities.Contract.create({
        collaboration_id: collaborationId,
        template_id: selectedTemplate.id,
        template_type: selectedTemplate.category,
        title: finalTokens.collaboration_name
          ? `${selectedTemplate.name} — ${finalTokens.collaboration_name}`
          : `${selectedTemplate.name} — Contract`,
        status: 'generated',
        content: {
          generated_content: generatedContent,
          token_values: finalTokens,
          auto_filled_keys: Object.keys(autoFilled),
          template_version: selectedTemplate.version || 1,
          immutable_snapshot: snapshot,
        },
        created_by: user.email,
      });

      // Step 6: Version
      const version = await base44.entities.ContractVersion.create({
        contract_id: contract.id,
        version_number: 1,
        body_html: generatedContent,
        body_markdown: generatedContent,
        created_by: user.email,
        structured_snapshot: snapshot,
      });

      await base44.entities.Contract.update(contract.id, {
        current_version_id: version.id,
        version: 1,
      });

      // Step 7: Audit log
      await base44.entities.ContractAuditLog.create({
        contract_id: contract.id,
        version_id: version.id,
        action: 'CONTRACT_CREATED',
        user_id: user.email,
        details: {
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          auto_filled_count: Object.keys(autoFilled).filter(k => autoFilled[k]).length,
          manual_fields_count: Object.keys(manualValues).length,
          snapshot_created: true,
          validation_passed: true,
        },
      });

      // Step 8: Google Drive backup (non-blocking)
      base44.functions.invoke('saveContractToGoogleDrive', {
        contractId: contract.id,
        title: contract.title,
        content: generatedContent,
        userEmail: user.email,
      }).catch(() => {});

      return contract;
    },
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Smart contract generated successfully');
      handleClose();
      onContractCreated?.(contract);
    },
    onError: (e) => toast.error(e.message || 'Generation failed'),
  });

  // Sort templates: applicable first
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aOk = getApplicability(a).applicable ? 0 : 1;
      const bOk = getApplicability(b).applicable ? 0 : 1;
      return aOk - bOk;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, collaboration]);

  return (
    <>
      <CCButton variant="primary" icon={Plus} onClick={() => setIsOpen(true)}>
        Generate from Template
      </CCButton>

      <CCModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Smart Deal Template"
        size="2xl"
      >
        <div className="space-y-5">
          {!selectedTemplate ? (
            /* ── Template Selection ── */
            <div className="space-y-4">
              <p className="text-sm text-[#9AA6BC]">
                Select a template — token values will be automatically populated from your collaboration data.
              </p>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-[#6B7A94] text-sm">
                  No active templates. Ask an admin to create templates in the Admin Dashboard.
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedTemplates.map(template => {
                    const { applicable, reason } = getApplicability(template);
                    return (
                      <CCCard
                        key={template.id}
                        clickable
                        hover
                        onClick={() => handleTemplateSelect(template.id)}
                        padding="md"
                        className={applicable ? '' : 'opacity-60'}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${applicable ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-medium text-[#E8EEF9]">{template.name}</h4>
                              {applicable
                                ? <CCBadge variant="success" size="sm">Recommended</CCBadge>
                                : <CCBadge variant="default" size="sm">Different context</CCBadge>
                              }
                              <CCBadge variant="outline" size="sm">{CATEGORY_LABELS[template.category] || template.category}</CCBadge>
                            </div>
                            <p className="text-sm text-[#9AA6BC]">{template.description}</p>
                            <p className="text-xs text-[#6B7A94] mt-1">{reason}</p>
                          </div>
                        </div>
                      </CCCard>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Token Fill + Preview ── */
            <div className="space-y-5">
              {/* Template header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-[#E8EEF9]">{selectedTemplate.name}</h3>
                    <CCBadge variant="outline" size="sm">{CATEGORY_LABELS[selectedTemplate.category] || selectedTemplate.category}</CCBadge>
                  </div>
                  <p className="text-sm text-[#9AA6BC]">{selectedTemplate.description}</p>
                </div>
                <CCButton variant="ghost" size="sm" onClick={() => { setSelectedTemplate(null); setManualValues({}); }}>
                  Change
                </CCButton>
              </div>

              {/* Auto-fill summary banner */}
              {autoFilledInSchema.length > 0 && (
                <div className="bg-[#0D1520] border border-[#22C55E]/20 rounded-lg p-3">
                  <button
                    className="flex items-center justify-between w-full"
                    onClick={() => setShowAutoFilled(!showAutoFilled)}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#22C55E]" />
                      <span className="text-sm font-medium text-[#22C55E]">
                        {autoFilledInSchema.length} fields auto-populated from collaboration
                      </span>
                    </div>
                    {showAutoFilled ? <ChevronUp className="w-4 h-4 text-[#22C55E]" /> : <ChevronDown className="w-4 h-4 text-[#22C55E]" />}
                  </button>

                  {showAutoFilled && (
                    <div className="mt-3 space-y-2">
                      {autoFilledInSchema.map(({ key, schema, value }) => (
                        <AutoFilledField
                          key={key}
                          label={schema.label || key.replace(/_/g, ' ')}
                          value={overrides[key] ?? value}
                          onOverride={(v) => setOverrides(prev => ({ ...prev, [key]: v }))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Required manual fields */}
              {requiredTokens.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h4 className="text-sm font-semibold text-[#E8EEF9]">
                      Required fields ({requiredTokens.length})
                    </h4>
                  </div>
                  {requiredTokens.map(({ key, schema }) => (
                    <div key={key}>
                      {schema.type === 'select' || schema.enum ? (
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-[#E8EEF9]">
                            {schema.label || key.replace(/_/g, ' ')} <span className="text-[#FF2DAA]">*</span>
                          </label>
                          <select
                            value={manualValues[key] || ''}
                            onChange={e => setManualValues(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          >
                            <option value="">Select…</option>
                            {(schema.enum || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      ) : (
                        <CCInput
                          label={<>{schema.label || key.replace(/_/g, ' ')} <span className="text-[#FF2DAA]">*</span></>}
                          value={manualValues[key] || ''}
                          onChange={e => setManualValues(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={schema.placeholder || `Enter ${key.replace(/_/g, ' ')}`}
                          hint={schema.hint}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Optional manual fields */}
              {optionalTokens.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-[#6B7A94] hover:text-[#9AA6BC] flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    {optionalTokens.length} optional fields (leave blank to skip)
                  </summary>
                  <div className="mt-3 space-y-3 pl-2">
                    {optionalTokens.map(({ key, schema }) => (
                      <CCInput
                        key={key}
                        label={schema.label || key.replace(/_/g, ' ')}
                        value={manualValues[key] || ''}
                        onChange={e => setManualValues(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={schema.placeholder || `Enter ${key.replace(/_/g, ' ')}`}
                        hint={schema.hint}
                      />
                    ))}
                  </div>
                </details>
              )}

              {/* Validation errors */}
              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-[#EF4444]">
                    Fill required fields: {missingRequired.map(t => t.schema.label || t.key).join(', ')}
                  </div>
                </div>
              )}

              {/* Preview toggle */}
              <div>
                <CCButton
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Hide Preview' : 'Preview Contract'}
                </CCButton>
                {showPreview && (
                  <div className="mt-3 bg-[#0D1520] border border-[#263248] rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-[#9AA6BC] whitespace-pre-wrap font-mono leading-relaxed">
                      {previewContent}
                    </pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#263248]">
                <CCButton variant="outline" fullWidth onClick={handleClose}>
                  Cancel
                </CCButton>
                <CCButton
                  variant="primary"
                  fullWidth
                  icon={CheckCircle}
                  loading={generateMutation.isPending}
                  disabled={missingRequired.length > 0}
                  onClick={() => generateMutation.mutate()}
                >
                  Generate Contract
                </CCButton>
              </div>
            </div>
          )}
        </div>
      </CCModal>
    </>
  );
}