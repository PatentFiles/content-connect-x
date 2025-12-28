import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, Image, Check, X, Trash2, AlertCircle, Loader2, Shield, Calendar } from 'lucide-react';
import CCCard, { CCCardHeader, CCCardTitle, CCCardDescription, CCCardContent } from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCLoadingScreen from '@/components/ui-custom/CCLoading';
import VerificationRequired from '@/components/auth/VerificationRequired';
import { format } from 'date-fns';

export default function Testing() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Fetch current user and verification status
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: testingCredentials = [] } = useQuery({
    queryKey: ['myTestingCredentials', user?.email],
    queryFn: () => base44.entities.TestingCredential.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: testingDocuments = [] } = useQuery({
    queryKey: ['myTestingDocuments', user?.email],
    queryFn: () => base44.entities.TestingDocument.filter({ user_id: user?.email, is_active: true }),
    enabled: !!user?.email,
  });

  const isVerified = verifications[0]?.status === 'approved';
  const activeCredential = testingCredentials.find(tc => tc.status_badge === 'valid');

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadPrivateFile({ file });
      
      // Create testing document record
      const doc = await base44.entities.TestingDocument.create({
        user_id: user.email,
        file_url,
        file_name: file.name,
        file_type: file.name.split('.').pop().toLowerCase(),
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
        status: 'pending',
        is_active: true,
      });

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTestingDocuments'] });
      toast.success('Lab results uploaded successfully');
      setUploading(false);
    },
    onError: (error) => {
      toast.error('Failed to upload: ' + error.message);
      setUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId) => {
      await base44.entities.TestingDocument.update(docId, { is_active: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTestingDocuments'] });
      toast.success('Document removed');
    },
    onError: (error) => {
      toast.error('Failed to remove document: ' + error.message);
    },
  });

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/heic'];
    const fileType = file.type || `image/${file.name.split('.').pop().toLowerCase()}`;

    if (!validTypes.includes(fileType)) {
      toast.error('Invalid file type. Please upload PDF, PNG, or JPG files.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    uploadMutation.mutate(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { variant: 'warning', icon: AlertCircle, label: 'Pending Review' },
      verified: { variant: 'success', icon: Check, label: 'Verified' },
      rejected: { variant: 'danger', icon: X, label: 'Rejected' },
    };
    const { variant, icon: Icon, label } = config[status] || config.pending;
    return <CCBadge variant={variant} icon={Icon}>{label}</CCBadge>;
  };

  const getFileIcon = (type) => {
    if (type === 'pdf') return FileText;
    return Image;
  };

  if (userLoading) {
    return <CCLoadingScreen />;
  }

  if (!isVerified) {
    return <VerificationRequired />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E8EEF9] mb-2">Health Testing</h1>
          <p className="text-[#9AA6BC]">Upload and manage your lab results</p>
        </div>

        {/* Current Status */}
        {activeCredential && (
          <CCCard className="border-[#22C55E]/30 bg-[#22C55E]/5">
            <CCCardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#22C55E] mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-[#E8EEF9] mb-1">Current Testing Status: Valid</h3>
                  <div className="text-sm text-[#9AA6BC] space-y-1">
                    {activeCredential.tested_at && (
                      <p>Tested: {format(new Date(activeCredential.tested_at), 'MMM d, yyyy')}</p>
                    )}
                    {activeCredential.expires_at && (
                      <p>Expires: {format(new Date(activeCredential.expires_at), 'MMM d, yyyy')}</p>
                    )}
                  </div>
                </div>
              </div>
            </CCCardContent>
          </CCCard>
        )}

        {/* Upload Section */}
        <CCCard>
          <CCCardHeader className="text-center">
            <CCCardTitle>Upload Lab Results</CCCardTitle>
            <CCCardDescription>
              Upload your latest testing documents. Accepted formats: PDF, PNG, JPG (max 10MB)
            </CCCardDescription>
          </CCCardHeader>
          <CCCardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-[#4F8CFF] bg-[#4F8CFF]/5'
                  : 'border-[#263248] hover:border-[#3A4A6B] hover:bg-[#1A2438]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.heic"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-[#4F8CFF] animate-spin" />
                  <p className="text-[#9AA6BC]">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-[#9AA6BC] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">
                    Drag & drop your lab results here
                  </h3>
                  <p className="text-sm text-[#9AA6BC] mb-4">or</p>
                  <CCButton
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </CCButton>
                  <p className="text-xs text-[#6B7A94] mt-4">
                    PDF, PNG, JPG up to 10MB
                  </p>
                </>
              )}
            </div>
          </CCCardContent>
        </CCCard>

        {/* Uploaded Documents */}
        <CCCard>
          <CCCardHeader className="text-center">
            <CCCardTitle>Uploaded Documents</CCCardTitle>
            <CCCardDescription>
              Your testing documents are reviewed by administrators before verification
            </CCCardDescription>
          </CCCardHeader>
          <CCCardContent>
            {testingDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
                <p className="text-[#9AA6BC]">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testingDocuments.map((doc) => {
                  const FileIcon = getFileIcon(doc.file_type);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 bg-[#121824] border border-[#263248] rounded-lg hover:border-[#3A4A6B] transition-all"
                    >
                      <div className="p-2 bg-[#151D2B] rounded-lg">
                        <FileIcon className="w-5 h-5 text-[#4F8CFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#E8EEF9] truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-[#6B7A94] mt-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                          {doc.file_size && (
                            <span>• {(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.status)}
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="text-[#EF4444] hover:text-[#DC2626]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CCCardContent>
        </CCCard>

        {/* Info Section */}
        <CCCard>
          <CCCardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              <div className="text-sm text-[#9AA6BC] space-y-2">
                <p className="font-medium text-[#E8EEF9]">Important Information</p>
                <ul className="list-none space-y-1">
                  <li>Documents are reviewed by platform administrators</li>
                  <li>Verification typically takes 1-2 business days</li>
                  <li>Keep your testing current to maintain verified status</li>
                  <li>Documents are stored securely and shared only per your visibility settings</li>
                </ul>
              </div>
            </div>
          </CCCardContent>
        </CCCard>
      </div>
    </div>
  );
}