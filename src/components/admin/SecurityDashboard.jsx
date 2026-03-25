/**
 * SecurityDashboard — Admin panel for running security checks and audits
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Play, CheckCircle, XCircle, AlertTriangle, Search, Loader2 } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function SecurityDashboard() {
  const [securityResults, setSecurityResults] = useState(null);
  const [legacyResults, setLegacyResults] = useState(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [loadingLegacy, setLoadingLegacy] = useState(false);

  const runSecurityChecks = async () => {
    setLoadingSecurity(true);
    try {
      const res = await base44.functions.invoke('runSecurityChecks', {});
      setSecurityResults(res?.data);
    } catch (e) {
      setSecurityResults({ error: e.message });
    } finally {
      setLoadingSecurity(false);
    }
  };

  const runLegacyAudit = async () => {
    setLoadingLegacy(true);
    try {
      const res = await base44.functions.invoke('flagLegacyPublicFiles', { dry_run: true });
      setLegacyResults(res?.data);
    } catch (e) {
      setLegacyResults({ error: e.message });
    } finally {
      setLoadingLegacy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-1">Security & Compliance Dashboard</h2>
        <p className="text-sm text-[#6B7A94]">Run automated security validation and pre-launch compliance audits</p>
      </div>

      {/* Security Checks */}
      <CCCard padding="lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#E8EEF9]">Security Validation Suite</h3>
              <p className="text-xs text-[#6B7A94]">Verifies ban enforcement, legal holds, moderation, file security, and evidence preservation</p>
            </div>
          </div>
          <CCButton
            variant="primary"
            size="sm"
            icon={loadingSecurity ? Loader2 : Play}
            onClick={runSecurityChecks}
            loading={loadingSecurity}
          >
            Run Checks
          </CCButton>
        </div>

        {securityResults && (
          <div className="space-y-3">
            {securityResults.error ? (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-sm text-[#EF4444]">
                Error: {securityResults.error}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121824]">
                  <CCBadge
                    variant={securityResults.summary?.failed === 0 ? 'success' : 'danger'}
                    icon={securityResults.summary?.failed === 0 ? CheckCircle : XCircle}
                  >
                    {securityResults.summary?.verdict}
                  </CCBadge>
                  <span className="text-sm text-[#9AA6BC]">
                    {securityResults.summary?.passed}/{securityResults.summary?.total} checks passed
                  </span>
                  <span className="text-xs text-[#6B7A94]">
                    Run at {securityResults.run_at ? new Date(securityResults.run_at).toLocaleTimeString() : '—'}
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(securityResults.results || []).map((r, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                      r.status === 'PASS' ? 'bg-[#22C55E]/5 border border-[#22C55E]/20' : 'bg-[#EF4444]/5 border border-[#EF4444]/20'
                    }`}>
                      {r.status === 'PASS'
                        ? <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className={`font-medium ${r.status === 'PASS' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          {r.check.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[#9AA6BC] text-xs mt-0.5">{r.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CCCard>

      {/* Legacy File Audit */}
      <CCCard padding="lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#E8EEF9]">Legacy Public File Audit</h3>
              <p className="text-xs text-[#6B7A94]">Scans VerificationRecord, TestingDocument, TestingCredential for public URLs in sensitive file fields</p>
            </div>
          </div>
          <CCButton
            variant="warning"
            size="sm"
            icon={loadingLegacy ? Loader2 : Search}
            onClick={runLegacyAudit}
            loading={loadingLegacy}
          >
            Audit Files
          </CCButton>
        </div>

        {legacyResults && (
          <div className="space-y-3">
            {legacyResults.error ? (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-sm text-[#EF4444]">
                Error: {legacyResults.error}
              </div>
            ) : (
              <>
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  legacyResults.total_findings === 0
                    ? 'bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]'
                    : 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'
                }`}>
                  {legacyResults.verdict}
                </div>
                {legacyResults.total_findings > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(legacyResults.findings || []).map((f, i) => (
                      <div key={i} className="p-3 bg-[#121824] rounded-lg text-xs text-[#9AA6BC]">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                          <span className="font-medium text-[#E8EEF9]">{f.entity}</span>
                          <CCBadge variant={f.severity === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                            {f.severity}
                          </CCBadge>
                        </div>
                        <p>ID: {f.id} | Field: {f.field || f.fields?.join(', ')}</p>
                        {f.value_preview && <p className="text-[#6B7A94] mt-0.5">{f.value_preview}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {legacyResults.next_steps && legacyResults.next_steps.length > 0 && legacyResults.total_findings > 0 && (
                  <div className="p-3 bg-[#151D2B] rounded-lg">
                    <p className="text-xs font-semibold text-[#E8EEF9] mb-2">Remediation Steps:</p>
                    <ul className="text-xs text-[#9AA6BC] space-y-1">
                      {legacyResults.next_steps.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CCCard>
    </div>
  );
}