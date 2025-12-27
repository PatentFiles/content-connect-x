import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, CheckCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

export default function TemplateContractGenerator({ collaborationId, onContractCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tokenValues, setTokenValues] = useState({});
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['contractTemplates'],
    queryFn: () => base44.entities.ContractTemplate.filter({ is_active: true }),
  });

  // Fetch collaboration details
  const { data: collaboration } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: () => base44.entities.Collaboration.filter({ id: collaborationId }),
    enabled: !!collaborationId && isOpen,
    select: (data) => data[0],
  });

  // Generate contract mutation
  const generateMutation = useMutation({
    mutationFn: async (data) => {
      // Step 1: Validate contract initiation
      const validation = await base44.functions.invoke('validateContractInitiation', {
        collaboration_id: collaborationId
      });

      if (!validation.data.can_initiate) {
        throw new Error(
          `Cannot initiate contract: ${validation.data.validation_errors.map(e => e.message).join(', ')}`
        );
      }

      // Step 2: Create immutable snapshot
      const snapshotResult = await base44.functions.invoke('createContractSnapshot', {
        collaboration_id: collaborationId
      });

      const snapshot = snapshotResult.data.snapshot;

      // Step 2.5: Validate studio revenue splits for exclusive creators
      const splitValidation = await base44.functions.invoke('validateContractStudioSplit', {
        collaboration_id: collaborationId,
        contract_snapshot: snapshot
      });

      if (!splitValidation.data.can_finalize) {
        throw new Error(
          `Studio revenue split required: ${splitValidation.data.validation_errors.map(e => e.message).join(', ')}`
        );
      }

      // Step 3: Replace tokens in template content
      let generatedContent = selectedTemplate.content;
      Object.keys(tokenValues).forEach(token => {
        const regex = new RegExp(`{{${token}}}`, 'g');
        generatedContent = generatedContent.replace(regex, tokenValues[token] || '');
      });

      // Step 4: Create contract with snapshot reference
      const contract = await base44.entities.Contract.create({
        collaboration_id: collaborationId,
        template_id: selectedTemplate.id,
        template_type: selectedTemplate.category,
        title: tokenValues.contract_title || `${selectedTemplate.name} - Contract`,
        status: 'generated',
        content: { 
          generated_content: generatedContent,
          snapshot_id: `snapshot_${Date.now()}`,
          immutable_snapshot: snapshot
        },
        created_by: data.userEmail,
      });

      // Step 5: Create initial version with full snapshot
      const initialVersion = await base44.entities.ContractVersion.create({
        contract_id: contract.id,
        version_number: 1,
        body_html: generatedContent,
        body_markdown: generatedContent,
        created_by: data.userEmail,
        structured_snapshot: snapshot,
      });

      // Step 6: Update contract with version reference
      await base44.entities.Contract.update(contract.id, {
        current_version_id: initialVersion.id,
        version: 1
      });

      // Step 7: Log audit entry
      await base44.entities.ContractAuditLog.create({
        contract_id: contract.id,
        version_id: initialVersion.id,
        action: 'CONTRACT_CREATED',
        user_id: data.userEmail,
        details: {
          template_id: selectedTemplate.id,
          snapshot_created: true,
          validation_passed: true
        }
      });

      // Save to Google Drive as backup
      try {
        await base44.functions.invoke('saveContractToGoogleDrive', {
          contractId: contract.id,
          title: contract.title,
          content: generatedContent,
          userEmail: data.userEmail,
        });
      } catch (error) {
        console.error('Failed to backup to Google Drive:', error);
        // Don't fail the contract creation if backup fails
      }

      return contract;
    },
    onSuccess: (contract) => {
      queryClient.invalidateQueries(['contracts']);
      toast.success('Contract generated successfully');
      setIsOpen(false);
      setSelectedTemplate(null);
      setTokenValues({});
      onContractCreated?.(contract);
    },
    onError: (error) => {
      toast.error('Failed to generate contract');
      console.error(error);
    },
  });

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template);
    
    // Initialize token values from schema
    if (template?.token_schema) {
      const initialValues = {};
      Object.keys(template.token_schema).forEach(key => {
        initialValues[key] = '';
      });
      setTokenValues(initialValues);
    }
  };

  const handleGenerate = async () => {
    const user = await base44.auth.me();
    generateMutation.mutate({ userEmail: user.email });
  };

  return (
    <>
      <CCButton
        variant="primary"
        icon={Plus}
        onClick={() => setIsOpen(true)}
      >
        Generate from Template
      </CCButton>

      <CCModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setSelectedTemplate(null);
          setTokenValues({});
        }}
        title="Generate Contract from Template"
        size="lg"
      >
        <div className="space-y-6">
          {!selectedTemplate ? (
            <div className="space-y-4">
              <p className="text-sm text-[#9AA6BC]">
                Select a template to generate a contract for this collaboration.
              </p>
              <div className="grid gap-3">
                {templates.map(template => (
                  <CCCard
                    key={template.id}
                    clickable
                    hover
                    onClick={() => handleTemplateSelect(template.id)}
                    className="p-4"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-[#4F8CFF] mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-[#E8EEF9]">{template.name}</h4>
                        <p className="text-sm text-[#9AA6BC] mt-1">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-[#6B7A94] bg-[#121824] px-2 py-1 rounded">
                            {template.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CCCard>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-[#E8EEF9]">{selectedTemplate.name}</h3>
                  <p className="text-sm text-[#9AA6BC] mt-1">{selectedTemplate.description}</p>
                </div>
                <CCButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTokenValues({});
                  }}
                >
                  Change Template
                </CCButton>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-[#E8EEF9]">Fill in Contract Details</h4>
                
                {selectedTemplate.token_schema && Object.entries(selectedTemplate.token_schema).map(([key, schema]) => (
                  <div key={key}>
                    {schema.type === 'string' && !schema.enum ? (
                      <CCInput
                        label={schema.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={tokenValues[key] || ''}
                        onChange={(e) => setTokenValues({...tokenValues, [key]: e.target.value})}
                        placeholder={schema.placeholder || `Enter ${key}`}
                        required={schema.required}
                      />
                    ) : schema.enum ? (
                      <CCSelect
                        label={schema.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={tokenValues[key] || ''}
                        onChange={(e) => setTokenValues({...tokenValues, [key]: e.target.value})}
                        required={schema.required}
                      >
                        <option value="">Select {key}</option>
                        {schema.enum.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </CCSelect>
                    ) : (
                      <CCInput
                        label={schema.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={tokenValues[key] || ''}
                        onChange={(e) => setTokenValues({...tokenValues, [key]: e.target.value})}
                        placeholder={schema.placeholder || `Enter ${key}`}
                        required={schema.required}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#263248]">
                <CCButton
                  variant="outline"
                  fullWidth
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </CCButton>
                <CCButton
                  variant="primary"
                  fullWidth
                  icon={CheckCircle}
                  loading={generateMutation.isPending}
                  onClick={handleGenerate}
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