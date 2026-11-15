/**
 * AIContractBuilder — AI-Assisted Contract Draft UI
 *
 * Flow:
 *  1. Optionally collect extra_provisions / special_notes
 *  2. Call generateAIContract backend → get structured draft (sections + key_terms)
 *  3. Show editable draft section-by-section
 *  4. On "Commit Draft" → call existing createContractSnapshot → Contract → ContractVersion → ContractAuditLog pipeline
 *  5. Draft enters normal review/send/sign flow
 *
 * Does NOT bypass any existing contract infrastructure.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, ChevronDown, ChevronUp, Edit2, AlertTriangle,
  CheckCircle, RotateCcw, Info
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

// Renders a single editable contract section
function DraftSection({ section, index, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content);

  const save = () => { onChange(index, draft); setEditing(false); };
  const cancel = () => { setDraft(section.content); setEditing(false); };

  return (
    <div className="border border-[#263248] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1520]">
        <span className="text-sm font-semibold text-[#E8EEF9]">{section.title}</span>
        {section.editable !== false && (
          <button onClick={() => setEditing(!editing)} className="text-[#6B7A94] hover:text-[#4F8CFF] p-1">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <textarea
            className="w-full bg-[#121824] border border-[#4F8CFF]/40 rounded-lg px-3 py-2 text-sm text-[#E8EEF9] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[120px]"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <CCButton size="sm" variant="primary" onClick={save}>Save</CCButton>
            <CCButton size="sm" variant="ghost" onClick={cancel}>Cancel</CCButton>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-[#9AA6BC] leading-relaxed whitespace-pre-wrap">
          {section.content}
        </div>
      )}
    </div>
  );
}

export default function AIContractBuilder({ collaborationId, user, profiles, onContractCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('input'); // input | generating | review | committing
  const [extraProvisions, setExtraProvisions] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [draftData, setDraftData] = useState(null);
  const [editedSections, setEditedSections] = useState([]);
  const [showKeyTerms, setShowKeyTerms] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setIsOpen(false);
    setStep('input');
    setDraftData(null);
    setEditedSections([]);
    setExtraProvisions('');
    setSpecialNotes('');
  };

  // Step 1: Generate AI draft
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generateAIContract', {
        collaboration_id: collaborationId,
        extra_provisions: extraProvisions,
        special_notes: specialNotes,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      setDraftData(data);
      setEditedSections(data.draft?.sections || []);
      setStep('review');
    },
    onError: (e) => {
      toast.error(e.message || 'AI draft generation failed');
      setStep('input');
    },
  });

  // Step 2: Commit draft to contract pipeline
  const commitMutation = useMutation({
    mutationFn: async () => {
      // Build full contract text from edited sections
      const bodyHtml = editedSections
        .map(s => `<h3>${s.title}</h3>\n<p>${s.content.replace(/\n/g, '<br/>')}</p>`)
        .join('\n\n');

      const bodyText = editedSections
        .map(s => `== ${s.title} ==\n\n${s.content}`)
        .join('\n\n---\n\n');

      const title = draftData.draft?.contract_title || `AI Draft — ${new Date().toLocaleDateString()}`;

      // Step A: snapshot (existing pipeline)
      const snapshotResult = await base44.functions.invoke('createContractSnapshot', {
        collaboration_id: collaborationId,
      });
      const snapshot = snapshotResult.data.snapshot;

      // Step B: validate initiation (existing pipeline)
      const validation = await base44.functions.invoke('validateContractInitiation', {
        collaboration_id: collaborationId,
      });
      // Non-blocking: AI drafts can exist pre-verification; show warning but don't block
      const validationWarnings = validation.data?.can_initiate === false
        ? (validation.data?.validation_errors || []).map(e => e.message)
        : [];

      // Step C: studio split check
      const splitCheck = await base44.functions.invoke('validateContractStudioSplit', {
        collaboration_id: collaborationId,
        contract_snapshot: snapshot,
      });
      if (splitCheck.data?.can_finalize === false) {
        throw new Error(
          `Studio split required: ${(splitCheck.data.validation_errors || []).map(e => e.message).join(', ')}`
        );
      }

      // Step D: Create Contract record
      const contract = await base44.entities.Contract.create({
        collaboration_id: collaborationId,
        title,
        template_type: draftData.draft?.collaboration_type || 'custom',
        template_id: draftData.metadata?.template_used?.id || null,
        status: 'draft',
        content: {
          generated_content: bodyHtml,
          sections: editedSections,
          key_terms: draftData.draft?.key_terms || {},
          parties_summary: draftData.draft?.parties_summary || '',
          ai_notes: draftData.draft?.ai_notes || '',
          ai_assisted: true,
          ai_model: draftData.metadata?.model || 'claude_sonnet_4_6',
          template_used: draftData.metadata?.template_used?.name || 'none',
          generated_at: draftData.metadata?.generated_at,
          immutable_snapshot: snapshot,
        },
        created_by: user.email,
        signatories: (profiles || []).map(p => ({
          user_id: p.user_id,
          name: p.display_name || p.user_id,
          signed: false,
        })),
      });

      // Step E: ContractVersion
      const version = await base44.entities.ContractVersion.create({
        contract_id: contract.id,
        version_number: 1,
        body_html: bodyHtml,
        body_markdown: bodyText,
        created_by: user.email,
        structured_snapshot: snapshot,
      });

      await base44.entities.Contract.update(contract.id, {
        current_version_id: version.id,
        version: 1,
      });

      // Step F: ContractAuditLog
      await base44.entities.ContractAuditLog.create({
        contract_id: contract.id,
        version_id: version.id,
        action: 'AI_CONTRACT_DRAFT_COMMITTED',
        user_id: user.email,
        details: {
          ai_assisted: true,
          model: draftData.metadata?.model,
          template_used: draftData.metadata?.template_used?.name || 'none',
          template_id: draftData.metadata?.template_used?.id || null,
          sections_count: editedSections.length,
          validation_warnings: validationWarnings,
          generated_at: draftData.metadata?.generated_at,
          collaboration_type: draftData.draft?.collaboration_type,
          snapshot_created: true,
        },
      });

      // Step G: Google Drive backup (non-blocking)
      base44.functions.invoke('saveContractToGoogleDrive', {
        contractId: contract.id,
        title: contract.title,
        content: bodyHtml,
        userEmail: user.email,
      }).catch(() => {});

      return { contract, validationWarnings };
    },
    onSuccess: ({ contract, validationWarnings }) => {
      queryClient.invalidateQueries({ queryKey: ['collaborationContracts', collaborationId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      if (validationWarnings.length > 0) {
        toast.warning(`Draft saved — review warnings: ${validationWarnings.join('; ')}`);
      } else {
        toast.success('AI contract draft committed — ready for review and signatures');
      }
      handleClose();
      onContractCreated?.(contract);
    },
    onError: (e) => {
      toast.error(e.message || 'Failed to commit draft');
      setStep('review');
    },
  });

  const handleSectionChange = (index, newContent) => {
    setEditedSections(prev => prev.map((s, i) => i === index ? { ...s, content: newContent } : s));
  };

  // Full assembled contract text for preview
  const fullText = useMemo(() =>
    editedSections.map(s => `== ${s.title} ==\n\n${s.content}`).join('\n\n---\n\n'),
    [editedSections]
  );

  return (
    <>
      <CCButton variant="accent" icon={Sparkles} onClick={() => setIsOpen(true)}>
        AI Contract Builder
      </CCButton>

      <CCModal
        isOpen={isOpen}
        onClose={handleClose}
        title={
          step === 'input' ? 'AI Contract Builder' :
          step === 'generating' ? 'Generating Draft…' :
          'Review AI Draft'
        }
        size="2xl"
      >
        {/* ── STEP: INPUT ── */}
        {step === 'input' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-[#4F8CFF] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#9AA6BC]">
                The AI will read your collaboration details — participants, schedule, compensation, deliverables, usage rights, and representation — and draft a complete, structured contract for your review. You can edit every section before committing.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#E8EEF9]">
                Special Provisions <span className="text-[#6B7A94] font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
                placeholder="Any custom clauses, non-standard terms, or specific provisions to include…"
                value={extraProvisions}
                onChange={e => setExtraProvisions(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#E8EEF9]">
                Notes for AI <span className="text-[#6B7A94] font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[60px]"
                placeholder="e.g. 'This is a trade shoot', 'Include NDA clause', 'Photographer retains watermarked copies'…"
                value={specialNotes}
                onChange={e => setSpecialNotes(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#9AA6BC]">
                <strong className="text-[#E8EEF9]">AI drafts are not legal advice.</strong> Review every clause carefully before sending for signatures. This draft uses your collaboration data — verify all details are accurate.
              </p>
            </div>

            <div className="flex gap-3 pt-2 border-t border-[#263248]">
              <CCButton variant="outline" fullWidth onClick={handleClose}>Cancel</CCButton>
              <CCButton
                variant="accent"
                fullWidth
                icon={Sparkles}
                loading={generateMutation.isPending}
                onClick={() => { setStep('generating'); generateMutation.mutate(); }}
              >
                Generate Draft
              </CCButton>
            </div>
          </div>
        )}

        {/* ── STEP: GENERATING ── */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#4F8CFF] border-t-transparent animate-spin" />
            <p className="text-[#9AA6BC] text-sm">Drafting your contract with AI…</p>
            <p className="text-[#6B7A94] text-xs">This uses Claude and takes 10–20 seconds.</p>
          </div>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === 'review' && draftData && (
          <div className="space-y-5">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2">
              <CCBadge variant="accent"><Sparkles className="w-3 h-3 mr-1 inline" />AI-Assisted Draft</CCBadge>
              <CCBadge variant="outline">{draftData.draft?.collaboration_type?.replace(/_/g, ' ')}</CCBadge>
              {draftData.metadata?.template_used && (
                <CCBadge variant="primary">Based on: {draftData.metadata.template_used.name}</CCBadge>
              )}
              <CCBadge variant="default">{editedSections.length} sections</CCBadge>
            </div>

            {/* Parties summary */}
            {draftData.draft?.parties_summary && (
              <CCCard padding="md" className="bg-[#0D1520]">
                <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-1">Parties</p>
                <p className="text-sm text-[#E8EEF9]">{draftData.draft.parties_summary}</p>
              </CCCard>
            )}

            {/* Key terms accordion */}
            {draftData.draft?.key_terms && (
              <div>
                <button
                  className="flex items-center gap-2 text-sm font-medium text-[#9AA6BC] hover:text-[#E8EEF9] w-full"
                  onClick={() => setShowKeyTerms(!showKeyTerms)}
                >
                  {showKeyTerms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Key Terms Summary
                </button>
                {showKeyTerms && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Object.entries(draftData.draft.key_terms).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="p-2 bg-[#0D1520] rounded-lg">
                        <p className="text-xs text-[#6B7A94] capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-[#E8EEF9] mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI notes */}
            {draftData.draft?.ai_notes && (
              <div className="flex items-start gap-2 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/20 rounded-lg">
                <Info className="w-4 h-4 text-[#4F8CFF] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#4F8CFF] mb-1">AI Review Notes</p>
                  <p className="text-xs text-[#9AA6BC]">{draftData.draft.ai_notes}</p>
                </div>
              </div>
            )}

            {/* Editable sections */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {editedSections.map((section, i) => (
                <DraftSection
                  key={i}
                  section={section}
                  index={i}
                  onChange={handleSectionChange}
                />
              ))}
            </div>

            {/* Legal disclaimer */}
            <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#9AA6BC]">
                <strong className="text-[#E8EEF9]">Review before committing.</strong> This AI draft will be saved as a version 1 contract draft. You can still edit it further before sending for signatures. It is clearly labeled as AI-assisted in the audit log.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-[#263248]">
              <CCButton
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onClick={() => setStep('input')}
                disabled={commitMutation.isPending}
              >
                Regenerate
              </CCButton>
              <CCButton variant="outline" fullWidth onClick={handleClose}>
                Cancel
              </CCButton>
              <CCButton
                variant="primary"
                fullWidth
                icon={CheckCircle}
                loading={commitMutation.isPending}
                onClick={() => { setStep('committing'); commitMutation.mutate(); }}
              >
                Commit Draft
              </CCButton>
            </div>
          </div>
        )}

        {/* ── STEP: COMMITTING ── */}
        {step === 'committing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#22C55E] border-t-transparent animate-spin" />
            <p className="text-[#9AA6BC] text-sm">Committing draft to contract pipeline…</p>
          </div>
        )}
      </CCModal>
    </>
  );
}