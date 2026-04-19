import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import { FileText, AlertTriangle, Database, Shield, Users, Network, Calendar, FileCheck, Lock, Activity, DollarSign, CheckCircle, Copy, Share2, Loader2, CheckCircle2 } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import EntityReferenceSection from '@/components/docs/EntityReference';
import ChangeGovernanceSection from '@/components/docs/ChangeGovernance';
import { BookingSystemSection, EarningsSection, CompletionSection, IdentitySafetySection } from '@/components/docs/DeveloperReadMeExtended';
import { AutomationsSection } from '@/components/docs/DeveloperReadMeAutomations';
import { RecentChangesSection } from '@/components/docs/DeveloperReadMeChangelog';
import { toast } from 'sonner';

// ─── Token Validation ──────────────────────────────────────────────────────────

function useReadMeAccess() {
  const [tokenState, setTokenState] = useState({ checked: false, valid: false, reason: null });

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me().catch(() => null),
  });

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isAdmin = profiles[0]?.is_admin || user?.role === 'admin';
  const isLoading = userLoading || profileLoading || !tokenState.checked;

  useEffect(() => {
    async function check() {
      // If admin — always allow
      if (!userLoading && !profileLoading) {
        if (isAdmin) {
          setTokenState({ checked: true, valid: true, reason: null });
          return;
        }
        // Check URL for access token
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('access_token');
        if (!token) {
          setTokenState({ checked: true, valid: false, reason: 'no_token' });
          return;
        }
        // Validate token via backend
        try {
          const res = await base44.functions.invoke('validateReadMeToken', { token });
          if (res?.data?.valid) {
            setTokenState({ checked: true, valid: true, reason: null });
          } else {
            setTokenState({ checked: true, valid: false, reason: res?.data?.reason || 'invalid_token' });
          }
        } catch {
          setTokenState({ checked: true, valid: false, reason: 'validation_error' });
        }
      }
    }
    check();
  }, [isAdmin, userLoading, profileLoading]);

  return { isLoading: userLoading || profileLoading || !tokenState.checked, isAllowed: tokenState.valid, isAdmin, reason: tokenState.reason };
}

// ─── Token Generator (admin only) ─────────────────────────────────────────────

function TokenGenerator() {
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateReadMeToken', {});
      if (res?.data?.share_url) {
        setShareUrl(res.data.share_url);
        toast.success('Share token generated — valid for 24 hours');
      } else {
        toast.error(res?.data?.error || 'Failed to generate token');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-[#0D1520] border border-[#263248] rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Share2 className="w-4 h-4 text-[#4F8CFF]" />
        <span className="text-sm font-semibold text-[#E8EEF9]">Share ReadMe Access</span>
      </div>
      <p className="text-xs text-[#9AA6BC] mb-3">Generate a 24-hour shareable link for non-admin developers.</p>
      {!shareUrl ? (
        <CCButton variant="outline" size="sm" loading={generating} icon={Share2} onClick={generate}>
          Generate Share Link
        </CCButton>
      ) : (
        <div className="flex gap-2 items-center">
          <input
            value={shareUrl}
            readOnly
            className="flex-1 text-xs bg-[#121824] border border-[#263248] rounded px-3 py-2 text-[#9AA6BC] font-mono"
          />
          <CCButton
            variant="primary"
            size="sm"
            icon={Copy}
            onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }}
          >
            Copy
          </CCButton>
        </div>
      )}
    </div>
  );
}

// ─── Blocked Screen ────────────────────────────────────────────────────────────

function ReadMeBlocked({ reason }) {
  const messages = {
    no_token: 'This page is restricted to admin users. If you have a shared access link, please use it.',
    invalid_token: 'Your access token is invalid. Please request a new link from an admin.',
    expired: 'Your access token has expired. Please request a new link from an admin.',
    validation_error: 'Could not validate your access token. Please try again.',
  };
  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-[#EF4444]" />
        </div>
        <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">Access Restricted</h1>
        <p className="text-[#9AA6BC] mb-6">{messages[reason] || messages.no_token}</p>
        <a href="/Dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white rounded-lg font-medium transition-colors">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DeveloperReadMe() {
  const { isLoading, isAllowed, isAdmin, reason } = useReadMeAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F8CFF]" />
      </div>
    );
  }

  if (!isAllowed) {
    return <ReadMeBlocked reason={reason} />;
  }

  return (
    <FeatureRouteGuard flag="core" requiresSubscription={false}>
    <div className="min-h-screen bg-[#0B0F14] pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-8 h-8 text-[#4F8CFF]" />
            <h1 className="text-3xl font-bold text-[#E8EEF9]">Developer ReadMe</h1>
          </div>
          <p className="text-[#9AA6BC]">
            Authoritative technical documentation for Content Connect. This document covers architecture, 
            enforcement rules, entity relationships, and system guarantees.
          </p>
          <div className="mt-4 p-4 bg-[#FF2DAA]/10 border border-[#FF2DAA]/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FF2DAA] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#FF2DAA]">
                <strong>Critical:</strong> This documentation represents the source of truth for how the platform 
                enforces consent, verification, testing, and contractual obligations. Any changes to enforcement 
                logic must be reflected here.
              </div>
            </div>
          </div>
        </div>

        {/* Admin-only: Token Generator */}
        {isAdmin && <TokenGenerator />}

        {/* Table of Contents */}
        <CCCard className="mb-8">
          <h2 className="text-xl font-bold text-[#E8EEF9] mb-4">Table of Contents</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { id: 'overview', title: '1. Platform Overview', icon: Network },
              { id: 'roles', title: '2. Role System', icon: Users },
              { id: 'directory', title: '3. Directory Tree', icon: FileText },
              { id: 'entities', title: '4. Entity Reference', icon: Database },
              { id: 'enforcement', title: '5. Enforcement Matrix', icon: Shield },
              { id: 'automations', title: '5f. Automations & Scheduled Jobs', icon: Activity },
              { id: 'collaboration', title: '6. Collaboration Lifecycle', icon: Activity },
              { id: 'scheduling', title: '7. Scheduling & Availability', icon: Calendar },
              { id: 'testing', title: '8. Health, Testing & Compliance', icon: FileCheck },
              { id: 'representation', title: '9. Representation & Exclusivity', icon: Users },
              { id: 'friends', title: '10. Friends & Trust System', icon: Users },
              { id: 'discovery', title: '11. Discovery & Matching', icon: Network },
              { id: 'notifications', title: '12. Notifications System', icon: Activity },
              { id: 'admin', title: '13. Admin Systems', icon: Shield },
              { id: 'audit', title: '14. Audit & Legal Defensibility', icon: Lock },
              { id: 'agents', title: '15. System Agents', icon: Activity },
              { id: 'deployment', title: '16. Deployment & Production', icon: Database },
              { id: 'governance', title: '17. Change Governance', icon: Shield },
              { id: 'recent-changes', title: '18. Recent Changes & Updates', icon: Activity },
              { id: 'backend-checklist', title: '19. Backend Deployment Checklist', icon: Database },
            ].map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#151D2B] text-[#9AA6BC] hover:text-[#E8EEF9] transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.title}</span>
              </a>
            ))}
          </div>
        </CCCard>

        {/* 1. Platform Overview */}
        <section id="overview" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Network className="w-6 h-6 text-[#4F8CFF]" />
            1. Platform Overview
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Content Connect Is</h3>
              <p className="text-[#9AA6BC] mb-3">
                Content Connect is a verified collaboration platform for adult content creators, photographers, 
                videographers, agents, and studios. It solves the problem of unsafe, unverified, and undocumented 
                collaboration arrangements in the adult content industry.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Core Problems Solved</h3>
              <ul className="list-disc list-inside space-y-2 text-[#9AA6BC]">
                <li><strong>Identity Fraud:</strong> Every member must complete age/identity verification</li>
                <li><strong>Unsafe Collaboration:</strong> Health testing requirements are enforced before contracts</li>
                <li><strong>Consent Violations:</strong> All contracts are versioned, timestamped, and immutable</li>
                <li><strong>Undocumented Agreements:</strong> Contract snapshots are stored at signing for legal defensibility</li>
                <li><strong>Representation Opacity:</strong> Agent/studio relationships are declared and enforced</li>
                <li><strong>Post-Scene Disputes:</strong> Consent revocation and dispute resolution are built-in</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Core Architecture Principles</h3>
              <ul className="list-disc list-inside space-y-2 text-[#9AA6BC]">
                <li><strong>Feature Flags = Single Source of Truth:</strong> All feature gating is controlled by PlatformFeatureFlag DB records, not hardcoded logic</li>
                <li><strong>Centralized Guards:</strong> FeatureGate, VerificationGate, AccessGate — no scattered inline enforcement</li>
                <li><strong>Ban/Suspension Enforced Everywhere:</strong> Every backend function checks banned/suspended before executing</li>
                <li><strong>Immutable Audit Logs:</strong> AdminActionLog, CollaborationActivityLog, ContractAuditLog — cannot be deleted</li>
                <li><strong>Smart Lock Adapter Pattern:</strong> Provider-agnostic architecture supports August, Yale, Schlage, Nuki, RemoteLock, igloohome via lib/smartLockAdapters/</li>
                <li><strong>Payment Provider Registry:</strong> Modular payment system via lib/payments/ — CCBill-ready, provider-swappable</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 2. Role System */}
        <section id="roles" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F8CFF]" />
            2. Role System
          </h2>
          <CCCard className="space-y-4">
            {[
              { role: 'Creator', desc: 'Adult content performer. Can create collabs, upload testing, set representation, revoke consent.' },
              { role: 'Agent', desc: 'Represents creators. Permissions: can_negotiate, can_sign_contracts, can_message, can_view_private_gallery.' },
              { role: 'Studio', desc: 'Produces content. Auto-added as RepObserver to collaborations. Can enforce revenue splits.' },
              { role: 'Photographer', desc: 'Captures images. Maintains rates/packages in ServiceDetails. Can list properties.' },
              { role: 'Videographer', desc: 'Captures video. Same structure as Photographer.' },
              { role: 'Video Editor', desc: 'Post-production. Same structure as Photographer.' },
              { role: 'Admin', desc: 'Platform governance. is_admin=true. All admin actions logged in AdminActionLog.' },
              { role: 'Host (Nav View)', desc: 'NOT a UserProfile.role_type value. host_account_active + host_terms_accepted_at determine host eligibility.' },
            ].map(({ role, desc }) => (
              <div key={role}>
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-1">{role}</h3>
                <p className="text-sm text-[#9AA6BC]">{desc}</p>
              </div>
            ))}
          </CCCard>
        </section>

        {/* 3. Directory Tree */}
        <section id="directory" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#4F8CFF]" />
            3. Directory Tree
          </h2>
          <CCCard>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">New Systems (Added in Hardening Pass)</h3>
                <pre className="bg-[#0B0F14] p-4 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto whitespace-pre-wrap">
{`pages/
├── SoloSessionDetail.jsx          - Session management (fixes broken notification links)

components/
├── feature/
│   └── FeatureRouteGuard.jsx      - Route-level feature flag gate
├── payments/
│   └── ResubscribeModal.jsx       - Subscription expired modal

lib/
├── smartLockAdapters/
│   ├── genericAdapter.js          - Base interface + ManualCodeAdapter + getSmartLockAdapter factory
│   ├── augustAdapter.js           - August API adapter
│   ├── nukiAdapter.js             - Nuki Web API adapter
│   ├── remoteLockAdapter.js       - RemoteLock API adapter
│   ├── yaleAdapter.js             - Yale adapter (B2B required)
│   ├── schlageAdapter.js          - Schlage adapter (Allegion required)
│   └── igloohomeAdapter.js        - igloohome Bridge API adapter
└── payments/
    ├── paymentProvider.js         - Base interface + constants
    ├── ccbillProvider.js          - CCBill payment implementation
    └── providerRegistry.js        - Multi-provider registry

functions/
├── paymentWebhookHandler.js       - CCBill + generic payment webhook handler
├── generateReadMeToken.js         - Admin-only: generate 24h shared README token
├── validateReadMeToken.js         - Validate README access token (HMAC-SHA256)`}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">SDK Version Standardization</h3>
                <pre className="bg-[#0B0F14] p-4 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto">
{`All backend functions now use: npm:@base44/sdk@0.8.25

Updated:
- logVerificationBlock.js (was 0.8.6)
- protectedProfileActions.js (was 0.8.23)
- acceptBookingRequest.js (was 0.8.23)
- protectedMutations.js (deprecated stub — returns 410)

Deprecated:
- protectedMutations → All mutations use protectedActions`}
                </pre>
              </div>
            </div>
          </CCCard>
        </section>

        <EntityReferenceSection />
        <BookingSystemSection />
        <EarningsSection />
        <CompletionSection />
        <IdentitySafetySection />

        {/* Enforcement Matrix */}
        <section id="enforcement" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
            5. Enforcement Matrix
          </h2>
          <CCCard>
            <div className="mb-4 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg">
              <p className="text-sm text-[#4F8CFF] font-semibold">⚠ Post-Hardening Changes</p>
              <ul className="text-xs text-[#9AA6BC] mt-1 list-disc ml-4 space-y-1">
                <li><strong>Send Message</strong>: No longer requires verification. Only requires <code>messaging</code> flag=ON + no ban/suspension.</li>
                <li><strong>All verification gates</strong>: Only enforced when <code>verification</code> flag=ON. When flag=OFF, all users pass through.</li>
                <li><strong>Feature flags are single source of truth</strong>: Disabling a flag blocks the feature globally in both frontend and backend.</li>
                <li><strong>DeveloperReadMe</strong>: Now requires admin OR valid 24h signed token. No direct URL bypass.</li>
              </ul>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#263248]">
                  <tr className="text-left text-[#E8EEF9]">
                    <th className="p-2">Action</th>
                    <th className="p-2">Guard</th>
                    <th className="p-2">Function</th>
                    <th className="p-2">Flag Condition</th>
                  </tr>
                </thead>
                <tbody className="text-[#9AA6BC]">
                  {[
                    ['Send Message', 'Ban check only', 'protectedActions.send_message', 'messaging=ON'],
                    ['View Profile', 'VerificationGate (when flag=ON)', 'validateVerificationStatus', 'verification=ON'],
                    ['Create Collaboration', 'VerificationGate + FriendGate', 'validateCollaborationFriendGate', 'collaborations=ON'],
                    ['Initiate Contract', 'Testing requirements', 'validateContractInitiation', 'contracts=ON'],
                    ['Book Property', 'Host eligibility', 'manageSoloSession', 'hosting_marketplace=ON'],
                    ['Access Code', 'Within booking window', 'manageBookingAccess', 'hosting_marketplace=ON'],
                    ['GPS Check-In', 'Within geofence', 'manageBookingAccess', 'gps_checkin=ON'],
                    ['Review Property', 'Session completed', 'managePropertyReview', 'property_reviews_enabled=ON'],
                    ['DeveloperReadMe', 'Admin OR signed token', 'validateReadMeToken', 'Always enforced'],
                    ['Upgrade Collaboration', 'Participant only', 'manageSoloSession', 'solo_sessions=ON'],
                  ].map(([action, guard, fn, flag]) => (
                    <tr key={action} className="border-b border-[#263248]">
                      <td className="p-2 font-medium">{action}</td>
                      <td className="p-2">{guard}</td>
                      <td className="p-2 font-mono text-xs">{fn}</td>
                      <td className="p-2"><code className="text-xs bg-[#0B0F14] px-1 py-0.5 rounded">{flag}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CCCard>
        </section>

        <AutomationsSection />

        {/* Smart Lock System */}
        <section id="smart-lock" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#4F8CFF]" />
            Smart Lock Architecture
          </h2>
          <CCCard className="space-y-4">
            <p className="text-sm text-[#9AA6BC]">Provider-agnostic adapter pattern. New providers can be added by implementing the SmartLockAdapter base class in lib/smartLockAdapters/.</p>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Implemented Adapters</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Manual/Code:</strong> Default — no API, uses generated 6-digit code</li>
                <li><strong>August:</strong> August Connect API (device_id + access_token)</li>
                <li><strong>Nuki:</strong> Nuki Web API Bearer token</li>
                <li><strong>RemoteLock:</strong> RemoteLock REST API OAuth</li>
                <li><strong>igloohome:</strong> igloohome Bridge API (generates pin codes)</li>
                <li><strong>Yale:</strong> Architecture ready — requires Yale B2B partner access</li>
                <li><strong>Schlage:</strong> Architecture ready — requires Allegion developer credentials</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Usage Pattern</h3>
              <pre className="bg-[#0B0F14] p-3 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto">
{`import { getSmartLockAdapter } from '@/lib/smartLockAdapters/genericAdapter';

const adapter = await getSmartLockAdapter(
  property.access_settings.smart_lock_provider,  // e.g. 'august'
  property.access_settings.smart_lock_config      // { device_id, api_key, account_ref }
);

const result = await adapter.unlock();
// { success: true, message: '...', provider: 'august' }`}
              </pre>
            </div>
          </CCCard>
        </section>

        {/* Payment System */}
        <section id="payments" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#4F8CFF]" />
            Payment System Architecture
          </h2>
          <CCCard className="space-y-4">
            <p className="text-sm text-[#9AA6BC]">Modular payment provider system in lib/payments/. CCBill is the primary provider (adult content industry standard).</p>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Provider Registry</h3>
              <pre className="bg-[#0B0F14] p-3 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto">
{`import { registerProvider, getProvider } from '@/lib/payments/providerRegistry';

// Register CCBill (from admin config)
registerProvider('ccbill', {
  merchantId: '...',
  subAccountId: '...',
  flexFormId: '...',
  dataLinkUsername: '...',
  dataLinkPassword: '...',
});

const ccbill = getProvider('ccbill');
const url = ccbill.getSubscriptionUrl({ pricePoint: '9.99', customerId: user.email });`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Webhook Handler</h3>
              <ul className="list-disc list-inside text-sm text-[#9AA6BC] space-y-1">
                <li>Function: <code className="text-xs">paymentWebhookHandler</code></li>
                <li>Handles CCBill URLEncoded form-data webhooks</li>
                <li>Maps events → Subscription.status updates</li>
                <li>Sends in-app notifications on status changes</li>
                <li>Creates AdminActionLog entries for audit trail</li>
                <li>Returns 200 even on error (prevents retry loops)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Subscription States</h3>
              <div className="flex flex-wrap gap-2">
                {['active', 'past_due', 'cancelled', 'expired', 'trial'].map(s => (
                  <code key={s} className="text-xs bg-[#0B0F14] border border-[#263248] px-2 py-1 rounded text-[#9AA6BC]">{s}</code>
                ))}
              </div>
            </div>
          </CCCard>
        </section>

        <ChangeGovernanceSection />
        <RecentChangesSection />

        {/* 19. Backend Deployment Checklist */}
        <section id="backend-checklist" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Database className="w-6 h-6 text-[#4F8CFF]" />
            19. Backend Deployment Checklist
          </h2>
          <CCCard className="space-y-5">
            {[
              { step: 1, color: 'bg-[#EF4444]', title: 'Upgrade to Builder+', items: ['Go to base44.com → Account Settings → Upgrade to Builder+'] },
              { step: 2, color: 'bg-[#F59E0B]', title: 'Critical Backend Functions', items: [
                'startConversation, sendFriendRequest, respondToFriendRequest, cancelFriendRequest',
                'validateContractInitiation + validateTestingRequirements',
                'createContractSnapshot (CRITICAL — fires on all-signed)',
                'triggerConsentRevocation (immutable, idempotent)',
                'autoAddStudioObserver, lockCollaborationBooking, releaseCollaborationBooking',
                'manageSoloSession, manageBookingAccess, manageProperty, activateHostAccount',
                'managePropertyReview, extendedSearch, adminModerationAction',
                'generateReadMeToken, validateReadMeToken (README access control)',
                'paymentWebhookHandler (CCBill subscription lifecycle)',
              ]},
              { step: 3, color: 'bg-[#F59E0B]', title: 'Scheduled Automations', items: [
                'checkTestingDeadlines → Daily 6am UTC',
                'checkTestingDeadlineWarnings → Daily 7am UTC',
                'executeAgentScan → Weekly off-peak',
                'generateMatches → Daily or on-demand',
              ]},
              { step: 4, color: 'bg-[#22C55E]', title: 'CCBill Payment Setup', items: [
                'Register at CCBill merchant portal',
                'Create FlexForm for subscription checkout',
                'Set webhook URL to /paymentWebhookHandler',
                'Test: NewSaleSuccess → Subscription.status="active"',
                'Test: Cancellation → Subscription.status="cancelled"',
              ]},
              { step: 5, color: 'bg-[#22C55E]', title: 'Smart Lock Config (Optional)', items: [
                'August: Get API key from August developer portal',
                'Nuki: Get Bearer token from Nuki Web',
                'RemoteLock: OAuth token from RemoteLock API',
                'Yale: Register at developer.allegion.com',
                'igloohome: API key from developer.igloohome.co',
                'Store credentials in Property.access_settings.smart_lock_config (PRIVATE)',
              ]},
              { step: 6, color: 'bg-[#4F8CFF]', title: 'Security Verification', items: [
                'DeveloperReadMe blocked for non-admins without token',
                'SoloSessionDetail notification links resolve correctly',
                'Feature flag route guards block all flagged pages',
                'protectedMutations returns 410 (no legacy callers)',
                'All backend functions use sdk@0.8.25',
              ]},
            ].map(({ step, color, title, items }) => (
              <div key={step}>
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2 flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{step}</span>
                  {title}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC] ml-7">
                  {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}
          </CCCard>
        </section>

        <div className="mt-8 p-4 bg-[#151D2B] border border-[#263248] rounded-lg text-center text-sm text-[#6B7A94]">
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">This documentation is the canonical source of truth for Content Connect's architecture.</p>
        </div>
      </div>
    </div>
    </FeatureRouteGuard>
  );
}