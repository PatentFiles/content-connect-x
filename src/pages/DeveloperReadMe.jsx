import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertTriangle, Database, Shield, Users, Network, Calendar, FileCheck, Lock, Activity, DollarSign, CheckCircle, Copy, Share2, Loader2, CheckCircle2, CreditCard, Flag, Home, Search, Star, Code, Settings, Key } from 'lucide-react';
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

  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
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
              { id: 'access-control', title: '2. Access Control Architecture', icon: Shield },
              { id: 'roles', title: '3. Role System', icon: Users },
              { id: 'subscription', title: '4. Subscription System', icon: CreditCard },
              { id: 'feature-flags', title: '5. Feature Flag System', icon: Flag },
              { id: 'directory', title: '6. Complete Directory Structure', icon: FileText },
              { id: 'entities', title: '7. Core Entities', icon: Database },
              { id: 'hosting', title: '8. Hosting Marketplace System', icon: Home },
              { id: 'solo-sessions', title: '9. Solo Session System', icon: Calendar },
              { id: 'search', title: '10. Unified Search & Ranking', icon: Search },
              { id: 'reviews', title: '11. Reviews & Integrity Scoring', icon: Star },
              { id: 'enforcement', title: '12. Enforcement Matrix', icon: Shield },
              { id: 'backend-functions', title: '13. Backend Functions Reference', icon: Code },
              { id: 'admin', title: '14. Admin Systems', icon: Settings },
              { id: 'smart-lock', title: '15. Smart Lock Architecture', icon: Lock },
              { id: 'payments', title: '16. Payment System Architecture', icon: DollarSign },
              { id: 'readme-access', title: '17. README Access Security', icon: Key },
              { id: 'limitations', title: '18. Known Limitations', icon: AlertTriangle },
              { id: 'governance', title: '19. Change Governance', icon: Shield },
              { id: 'backend-checklist', title: '20. Backend Deployment Checklist', icon: Database },
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
                Content Connect is a verified, subscription-based platform for adult content creators, photographers, 
                videographers, agents, studios, and hosts. It provides two interconnected systems:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] mb-3">
                <li><strong>Collaboration Network:</strong> Verified users coordinate creative projects with immutable contracts, health testing enforcement, and consent management.</li>
                <li><strong>Hosting Marketplace:</strong> Photographers/videographers list properties (studios, locations) for booking-based sessions with access control, booking management, and review systems.</li>
              </ul>
              <p className="text-[#9AA6BC]">
                Both systems are feature-flag controlled, subscription-gated, and admin-observable. All access control is centralized via <code className="text-xs bg-[#0B0F14] px-1 py-0.5 rounded">AuthContext</code> for consistency.
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

        {/* 2. Access Control Architecture */}
        <section id="access-control" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
            2. Access Control Architecture
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Three-Layer Access Control</h3>
              <div className="space-y-3 text-sm text-[#9AA6BC]">
                <div className="border-l-2 border-[#4F8CFF] pl-3">
                  <p className="font-semibold text-[#E8EEF9]">Layer 1: Global Authentication</p>
                  <p className="text-xs mt-1"><code>AuthContext</code> — handles login state, subscription status, account blocks (ban/suspension)</p>
                </div>
                <div className="border-l-2 border-[#FF2DAA] pl-3">
                  <p className="font-semibold text-[#E8EEF9]">Layer 2: Feature Gating</p>
                  <p className="text-xs mt-1"><code>FeatureRouteGuard</code> — blocks entire routes when feature flags are OFF. Non-admins see 404. Admins bypass.</p>
                </div>
                <div className="border-l-2 border-[#22C55E] pl-3">
                  <p className="font-semibold text-[#E8EEF9]">Layer 3: Feature-Specific Gates</p>
                  <p className="text-xs mt-1"><code>VerificationGate</code>, <code>AccessGate</code> — enforce verification/subscription per feature (only when flag=ON)</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Subscription Enforcement</h3>
              <p className="text-xs text-[#9AA6BC] mb-2">Global subscription blocking is centralized in <code>App.jsx</code>:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li>Statuses: <code>active</code>, <code>trial</code> → full access</li>
                <li>Statuses: <code>past_due</code>, <code>expired</code>, <code>cancelled</code> → all routes blocked except /Settings, /Pricing, /Billing</li>
                <li><strong>Admin Bypass:</strong> Admins NEVER see subscription block (checked: <code>user?.role === 'admin' || user?.role_type === 'admin'</code>)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Admin Role Detection</h3>
              <p className="text-xs text-[#9AA6BC] mb-2">Standardized across entire codebase:</p>
              <pre className="bg-[#0B0F14] p-2 rounded text-xs text-[#9AA6BC] overflow-x-auto">
{`const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';

// Admin bypasses:
// - subscription blocking
// - verification gating
// - feature flags
// - all access control`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">View-As Mode</h3>
              <p className="text-xs text-[#9AA6BC]">Admins can simulate any role (creator, agent, studio, etc.) via <code>AdminRoleViewSwitcher</code> in Sidebar. When viewing-as, <code>AdminContextBanner</code> shows at top and <code>FeatureFlagsPanel</code> is available for real-time flag testing.</p>
            </div>
          </CCCard>
        </section>

        {/* 4. Role System */}
        <section id="roles" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F8CFF]" />
            4. Role System
          </h2>
          <CCCard className="space-y-4">
            {[
              { role: 'Creator', desc: 'Adult content performer. Can create collaborations, upload testing docs, set agent representation, revoke consent.' },
              { role: 'Agent', desc: 'Represents creators professionally. Negotiates contracts, signs on behalf of creators, manages creator visibility.' },
              { role: 'Studio', desc: 'Content production company. Auto-added as RepObserver to collaborations. Enforces revenue splits via contracts.' },
              { role: 'Photographer', desc: 'Still photography specialist. Lists properties (studios/locations), manages bookings, collects reviews.' },
              { role: 'Videographer', desc: 'Video capture specialist. Same capabilities as Photographer — properties, bookings, ratings.' },
              { role: 'Video Editor', desc: 'Post-production specialist. Same role capabilities as Photographer/Videographer.' },
              { role: 'Admin', desc: 'Platform governance (role="admin" OR role_type="admin"). Full feature access, admin panels, View-As simulation, all actions logged.' },
              { role: 'Host (Derived)', desc: 'NOT a role_type. Determined by host_account_active=true + host_terms_accepted_at set. Access /HostDashboard, /HostSettings, property management.' },
            ].map(({ role, desc }) => (
              <div key={role}>
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-1">{role}</h3>
                <p className="text-sm text-[#9AA6BC]">{desc}</p>
              </div>
            ))}
          </CCCard>
        </section>

        {/* 5. Complete Directory Structure */}
        <section id="directory" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#4F8CFF]" />
            5. Complete Directory Structure
          </h2>
          <CCCard>
            <div className="space-y-4">
              <p className="text-xs text-[#9AA6BC] mb-2"><strong>Full project directory with purposes:</strong></p>
              <pre className="bg-[#0B0F14] p-3 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto whitespace-pre-wrap max-h-96">
{`src/
├── pages/                          # Route components
│   ├── Dashboard.jsx               # Home for all roles (dispatches to role dashboards)
│   ├── Discovery.jsx               # Unified discovery (profiles + properties)
│   ├── Search.jsx                  # Unified search backend
│   ├── HostingMarketplace.jsx      # Property listing gallery
│   ├── PropertyDetail.jsx           # Single property details + booking
│   ├── SoloSessionDetail.jsx        # Session management + booking access
│   ├── HostDashboard.jsx           # Host earnings/properties/bookings
│   ├── HostProfile.jsx             # Public host profile
│   ├── HostSettings.jsx            # Host onboarding + settings
│   ├── Collaborations.jsx          # Creator collaboration list
│   ├── CreateCollaboration.jsx      # Multi-step collab builder
│   ├── ViewCollaboration.jsx        # Collab detail + contract
│   ├── Messages.jsx                # Messaging + moderation
│   ├── Portfolio.jsx               # Media gallery management
│   ├── Profile.jsx                 # User profile editor
│   ├── ViewProfile.jsx             # Public profile viewer
│   ├── Settings.jsx                # Account settings
│   ├── Verification.jsx            # Verification flow
│   ├── Testing.jsx                 # Health test tracking
│   ├── DeveloperReadMe.jsx         # Admin + token docs (THIS FILE)
│   ├── AdminDashboard.jsx          # Admin home
│   ├── ModerationFlags.jsx         # User moderation disputes
│   ├── Representations.jsx         # Agent/creator partnerships
│   ├── RosterPortfolio.jsx         # Studio roster
│   ├── Landing.jsx                 # Public homepage
│   ├── Pricing.jsx                 # Public pricing page
│   └── ... (FAQs, Terms, Privacy, etc.)
│
├── components/                     # Reusable UI components
│   ├── auth/
│   │   ├── AccessGate.jsx          # Feature access gate
│   │   ├── AccountBlockedScreen.jsx # Ban/suspension screen
│   │   ├── SubscriptionBlockedScreen.jsx # Subscription block
│   │   ├── VerificationGate.jsx    # Verification enforcement
│   │   └── useVerificationCheck.js # Verification hook
│   ├── feature/
│   │   ├── FeatureRouteGuard.jsx   # Route-level feature gate
│   │   └── FeatureGate.jsx         # Inline feature gate
│   ├── hosting/
│   │   ├── PropertyForm.jsx        # Property create/edit form
│   │   ├── PropertyCard.jsx        # Property gallery card
│   │   ├── PropertyFilters.jsx     # Search filters
│   │   ├── PropertyBookingPanel.jsx # Booking UI
│   │   ├── PropertyAccessSettings.jsx # Smart lock config
│   │   ├── PropertyBundleManager.jsx # Equipment bundles
│   │   ├── PropertyEquipmentManager.jsx # Equipment list
│   │   ├── PropertyRulesManager.jsx # Rules config
│   │   ├── BookingAccessWidget.jsx # Access code UI
│   │   ├── PropertyIncidentWidget.jsx # Damage/issues
│   │   └── ProHostSubscriptionPanel.jsx # Pro features
│   ├── sessions/
│   │   ├── SoloSessionsInbox.jsx   # Booking requests
│   │   ├── SoloSessionCard.jsx     # Session card
│   │   ├── SoloSessionBookingModal.jsx # Booking flow
│   │   └── ExternalParticipantAttestationModal.jsx # External attestation
│   ├── admin/
│   │   ├── FeatureFlagsPanel.jsx   # Feature toggle UI
│   │   ├── SearchRankingConfigPanel.jsx # Ranking weights
│   │   ├── SuspiciousReviewsPanel.jsx # Review integrity
│   │   ├── HostingPricingPanel.jsx # Pricing admin
│   │   ├── PaymentProvidersPanel.jsx # Payment config
│   │   ├── UserModerationPanel.jsx # User actions
│   │   ├── PropertyIncidentsPanel.jsx # Incident review
│   │   └── ... (15+ more admin tools)
│   ├── layout/
│   │   ├── NavBar.jsx              # Top nav
│   │   ├── Sidebar.jsx             # Left sidebar + View-As
│   │   ├── BottomNav.jsx           # Mobile bottom nav
│   │   ├── MobileHeader.jsx        # Mobile header
│   │   ├── MobileNavMenu.jsx       # Mobile menu
│   │   └── PageTransition.jsx      # Page animations
│   ├── ui-custom/                  # Design system components
│   │   ├── CCButton.jsx
│   │   ├── CCCard.jsx
│   │   ├── CCInput.jsx
│   │   ├── CCSelect.jsx
│   │   ├── CCBadge.jsx
│   │   ├── CCModal.jsx
│   │   ├── CCLoading.jsx
│   │   ├── CCAvatars.jsx
│   │   ├── CCEmpty.jsx
│   │   ├── CCTabs.jsx
│   │   ├── BottomSheetSelect.jsx
│   │   └── BottomSheet.jsx
│   ├── profiles/
│   │   ├── ProfileCard.jsx         # User card (discovery)
│   │   └── SaveToFavoritesModal.jsx # Favorites
│   ├── collaboration/
│   │   ├── ContractManager.jsx     # Contract UI
│   │   ├── TestingStatusBanner.jsx # Health test status
│   │   ├── ActivityFeed.jsx        # Collab activity
│   │   └── ... (10+ more collab tools)
│   ├── property/
│   │   └── PropertyReviewsSection.jsx # Reviews display
│   └── ... (40+ more component subdirs)
│
├── lib/                            # Utilities & core logic
│   ├── AuthContext.jsx             # Global auth + subscription
│   ├── featureFlags.jsx            # Feature flag provider
│   ├── MobileNavContext.jsx        # Mobile nav state
│   ├── NavigationTracker.jsx       # Page tracking
│   ├── subscriptionGuard.js        # Subscription helpers
│   ├── featureGuard.js             # Feature flag helpers
│   ├── smartLockAdapters/
│   │   ├── genericAdapter.js       # Base interface
│   │   ├── manualAdapter.js        # Code-based
│   │   ├── augustAdapter.js        # August API
│   │   ├── nukiAdapter.js          # Nuki API
│   │   ├── remoteLockAdapter.js    # RemoteLock API
│   │   ├── yaleAdapter.js          # Yale (B2B)
│   │   ├── schlageAdapter.js       # Schlage (B2B)
│   │   └── igloohomeAdapter.js     # igloohome API
│   ├── payments/
│   │   ├── paymentProvider.js      # Provider base class
│   │   ├── ccbillProvider.js       # CCBill impl
│   │   └── providerRegistry.js     # Multi-provider registry
│   ├── utils.js                    # Misc helpers
│   ├── query-client.js             # React Query config
│   └── ... (10+ more files)
│
├── functions/                      # Backend functions (Deno)
│   ├── manageSoloSession.js        # Booking + session lifecycle
│   ├── manageBookingAccess.js      # Access codes + GPS check-in
│   ├── manageProperty.js           # Property CRUD + onboarding
│   ├── managePropertyReview.js     # Review creation + aggregation
│   ├── extendedSearch.js           # Unified search (profiles + properties)
│   ├── validateVerificationStatus.js # Verification check
│   ├── validateContractInitiation.js # Contract validation
│   ├── validateCollaborationFriendGate.js # Friend check
│   ├── paymentWebhookHandler.js    # CCBill webhooks
│   ├── generateReadMeToken.js      # Admin: token gen
│   ├── validateReadMeToken.js      # Token validation
│   ├── startConversation.js        # Message threading
│   ├── adminModerationAction.js    # Admin actions
│   ├── protectedActions.js         # Common mutations (ban check)
│   ├── activateHostAccount.js      # Host onboarding
│   └── ... (40+ more functions)
│
├── entities/                       # Data schemas
│   ├── Property.json               # Property + pricing + rules
│   ├── PropertyReview.json         # Reviews with integrity scoring
│   ├── SoloSession.json            # Booking sessions
│   ├── BookingRequest.json         # Booking inquiries
│   ├── BookingAccessEvent.json     # Access logs (audit)
│   ├── Collaboration.json          # Creative projects
│   ├── Contract.json               # Contracts
│   ├── UserProfile.json            # Extended user data
│   ├── PlatformFeatureFlag.json    # Feature toggles
│   ├── Subscription.json           # Subscription state
│   ├── Conversation.json           # Messages
│   └── ... (50+ total entities)
│
├── agents/                         # AI system agents
│   └── compliance_safety_agent.json # Agent config
│
├── api/
│   └── base44Client.js             # SDK initialization
│
├── hooks/                          # Custom React hooks
│   ├── useProtectedMutation.js     # Ban-checked mutations
│   ├── useMobilePageSetup.js       # Mobile setup
│   └── use-mobile.jsx              # Breakpoint detection
│
├── App.jsx                         # Root router + global access control
├── Layout.jsx (in pages/)          # Optional layout wrapper
├── main.jsx                        # Entry point
├── index.html                      # HTML template
├── index.css                       # Global styles
└── tailwind.config.js              # Design tokens`}
              </pre>
            </div>
          </CCCard>
        </section>

        {/* 4. Subscription System */}
        <section id="subscription" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#4F8CFF]" />
            4. Subscription System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Subscription Statuses</h3>
              <div className="grid grid-cols-2 gap-2">
                {['active', 'trial', 'past_due', 'expired', 'cancelled'].map(s => (
                  <code key={s} className="text-xs bg-[#0B0F14] border border-[#263248] px-2 py-1 rounded text-[#9AA6BC]">{s}</code>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Access Rules</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>active</code> or <code>trial</code> → Full platform access</li>
                <li><code>past_due</code>, <code>expired</code>, <code>cancelled</code> → Global block (except /Settings, /Pricing, /Billing)</li>
                <li><strong>Admin Bypass:</strong> Admins never see subscription block</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Enforcement Location</h3>
              <p className="text-xs text-[#9AA6BC]">Centralized in <code>App.jsx</code> lines 49-57. <code>AuthContext</code> loads subscription status from backend on mount and during session.</p>
            </div>
          </CCCard>
        </section>

        {/* 5. Feature Flag System */}
        <section id="feature-flags" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Flag className="w-6 h-6 text-[#4F8CFF]" />
            5. Feature Flag System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Core Files</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>lib/featureFlags.jsx</code> — FeatureFlagProvider + useFeatureFlag hook</li>
                <li><code>components/feature/FeatureRouteGuard.jsx</code> — Route-level enforcement</li>
                <li><code>lib/marketingFeatureMap.js</code> — Marketing visibility sync</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Key Flags</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>collaborations</code> — Collab creation/viewing</li>
                <li><code>hosting_marketplace</code> — Property listings + bookings</li>
                <li><code>solo_sessions</code> — Solo session creation (independent)</li>
                <li><code>verification</code> — Verification enforcement (when ON, VerificationGate active)</li>
                <li><code>messaging</code> — Messages feature</li>
                <li><code>property_reviews_enabled</code> — Property review system</li>
                <li><code>gps_checkin</code> — GPS-based access verification</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Behavior</h3>
              <p className="text-xs text-[#9AA6BC] mb-1"><strong>Route Blocking:</strong> When flag=OFF, <code>FeatureRouteGuard</code> blocks page access. Non-admins see 404. Admins bypass.</p>
              <p className="text-xs text-[#9AA6BC]"><strong>Marketing Sync:</strong> Disabled features are hidden from Landing/Pricing pages via <code>marketingFeatureMap</code>.</p>
            </div>
          </CCCard>
        </section>

        {/* 6. Core Entities */}
        <section id="entities" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Database className="w-6 h-6 text-[#4F8CFF]" />
            7. Core Entities
          </h2>
          <CCCard className="space-y-3">
            {[
              { entity: 'Property', desc: 'Physical location (studio/room/outdoor). Host-managed pricing, bundles, rules, smart lock config.' },
              { entity: 'PropertyReview', desc: 'Guest ratings after booking. Integrity scoring + recency weighting for ranking.' },
              { entity: 'SoloSession', desc: 'Booking session (property rental). Lifecycle: draft → pending → confirmed → active → completed.' },
              { entity: 'BookingRequest', desc: 'Guest inquiry for property/date. Host accepts/declines → creates SoloSession.' },
              { entity: 'BookingAccessEvent', desc: 'Immutable audit log. Check-ins, access codes, GPS events, checkout evidence.' },
              { entity: 'PlatformFeatureFlag', desc: 'Admin-controlled toggles. Controls route access + marketing visibility.' },
              { entity: 'UserProfile', desc: 'Extended user data (role_type, verification, bio, settings, host eligibility).' },
              { entity: 'Subscription', desc: 'User subscription state + payment provider references.' },
              { entity: 'Collaboration', desc: 'Creative project (collab marketplace system). Not directly related to hosting.' },
              { entity: 'Contract', desc: 'Binding agreement. Versioned, timestamped, immutable snapshots at signing.' },
            ].map(({ entity, desc }) => (
              <div key={entity} className="border-b border-[#263248] pb-2 last:border-b-0">
                <h3 className="text-xs font-semibold text-[#E8EEF9]">{entity}</h3>
                <p className="text-xs text-[#9AA6BC] mt-0.5">{desc}</p>
              </div>
            ))}
          </CCCard>
        </section>

        {/* 8. Hosting System */}
        <section id="hosting" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Home className="w-6 h-6 text-[#4F8CFF]" />
            8. Hosting Marketplace System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Host Onboarding</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>host_account_active</code> — User has completed host onboarding</li>
                <li><code>host_terms_accepted_at</code> — Timestamp of terms acceptance</li>
                <li>Activation: <code>activateHostAccount()</code> backend function</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Pages & Dashboards</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>/HostingMarketplace</code> — Browse all properties</li>
                <li><code>/PropertyDetail</code> — Single property + booking form</li>
                <li><code>/HostDashboard</code> — Host earnings/bookings/revenue</li>
                <li><code>/HostProfile</code> — Public host profile (verified status, reviews)</li>
                <li><code>/HostSettings</code> — Host onboarding + host-specific settings</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Property Management</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>PropertyForm</code> — Create/edit property</li>
                <li><code>PropertyAccessSettings</code> — Smart lock + access code config</li>
                <li><code>PropertyBundleManager</code> — Equipment packages</li>
                <li><code>PropertyRulesManager</code> — House rules editor</li>
                <li><code>manageProperty()</code> backend function</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Booking Flow</h3>
              <p className="text-xs text-[#9AA6BC] mb-1">1. Guest views property → 2. Submits BookingRequest → 3. Host reviews → 4. Host creates SoloSession → 5. Guest accesses via code/GPS/smart lock → 6. Session completes → 7. Guest rates in PropertyReview</p>
            </div>
          </CCCard>
        </section>

        {/* 9. Solo Sessions */}
        <section id="solo-sessions" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#4F8CFF]" />
            9. Solo Session System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">What is a Solo Session?</h3>
              <p className="text-xs text-[#9AA6BC]">A property booking. Host provides access to location; guest pays for time. Independent from collaborations. Feature-flagged by <code>solo_sessions</code> flag.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Session Lifecycle</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>draft</code> — Initial state</li>
                <li><code>pending_host</code> → <code>confirmed</code> — Host accepts/confirms</li>
                <li><code>active</code> — Guest checked in</li>
                <li><code>completed</code> → Guest leaves, can review</li>
                <li><code>cancelled</code> — Either party cancels</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Key Functions</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>manageSoloSession()</code> — Create/update session, lifecycle transitions</li>
                <li><code>manageBookingAccess()</code> — Check-ins (GPS/manual/smart lock), code generation</li>
                <li><code>SoloSessionDetail</code> page — Host/guest management UI</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 10. Search & Ranking */}
        <section id="search" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Search className="w-6 h-6 text-[#4F8CFF]" />
            10. Unified Search & Ranking
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Unified Search Backend</h3>
              <p className="text-xs text-[#9AA6BC]"><code>extendedSearch()</code> function returns combined results: creator profiles + properties. Single search box powers /Discovery, /Search, /HostingMarketplace.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Ranking Weights</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li>Verification status (if verified=high boost)</li>
                <li>Reviews (rating + recency)</li>
                <li>Reputation score</li>
                <li>Location distance</li>
                <li>Admin penalties (geo_risk.ranking_penalty)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Admin Control</h3>
              <p className="text-xs text-[#9AA6BC]"><code>SearchRankingConfigPanel</code> (admin only) allows adjusting weight multipliers in real-time.</p>
            </div>
          </CCCard>
        </section>

        {/* 11. Reviews System */}
        <section id="reviews" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Star className="w-6 h-6 text-[#4F8CFF]" />
            11. Reviews & Integrity Scoring
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">PropertyReview Entity</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li>Created after SoloSession completion</li>
                <li>Rating: 1-5 stars</li>
                <li><code>review_integrity_score</code> — 0-1.0 (1.0=trusted, 0.0=ignore)</li>
                <li><code>integrity_flags</code> — auto-detected anomalies (rapid review burst, abnormal ratings, etc.)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Aggregation</h3>
              <p className="text-xs text-[#9AA6BC] mb-1"><code>Property.average_rating</code> — weighted average of active reviews, weighted by integrity_score and recency.</p>
              <p className="text-xs text-[#9AA6BC]"><code>Property.recent_review_count</code> — reviews within last 30 days (freshness signal).</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Admin Tools</h3>
              <p className="text-xs text-[#9AA6BC]"><code>SuspiciousReviewsPanel</code> — flag integrity issues, adjust scores manually.</p>
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
            12. Enforcement Matrix
          </h2>
          <CCCard>
            <div className="mb-4 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg">
              <p className="text-sm text-[#4F8CFF] font-semibold">⚠ GLOBAL VERIFICATION ENFORCEMENT (HARD LOCK)</p>
              <ul className="text-xs text-[#9AA6BC] mt-1 list-disc ml-4 space-y-1">
                <li><strong>All Features Require Verification</strong>: When <code>verification</code> flag=ON, ALL non-admin users MUST be verified. No exceptions.</li>
                <li><strong>Messaging Locked</strong>: <code>send_message</code> + <code>start_conversation</code> now enforce verification (backend + frontend).</li>
                <li><strong>Admin Bypass</strong>: <code>user?.role === 'admin' || user?.role_type === 'admin'</code> bypasses verification, subscription, and all feature flags.</li>
                <li><strong>Backend Enforcement</strong>: <code>protectedActions.send_message</code>, <code>startConversation</code>, and all mutations check verification status.</li>
                <li><strong>Frontend Gates</strong>: VerificationGate + AccessGate enforce verification globally before any feature access.</li>
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
                    ['Send Message', 'Verification + Ban check', 'protectedActions.send_message', 'messaging=ON + verification=ON'],
                    ['Start Conversation', 'Verification + Ban check', 'startConversation', 'verification=ON'],
                    ['Create Collaboration', 'Verification + Friend gate', 'validateCollaborationFriendGate', 'collaborations=ON + verification=ON'],
                    ['Submit Report', 'Verification + Ban check', 'protectedActions.submit_report', 'verification=ON'],
                    ['View Profile', 'VerificationGate', 'validateVerificationStatus', 'verification=ON'],
                    ['Book Property', 'Verification', 'manageSoloSession', 'hosting_marketplace=ON + verification=ON'],
                    ['Access Code', 'Within booking window', 'manageBookingAccess', 'hosting_marketplace=ON'],
                    ['GPS Check-In', 'Within geofence', 'manageBookingAccess', 'gps_checkin=ON'],
                    ['Admin Dashboard', 'Admin only (bypass all)', 'adminModerationAction', 'Always enforced'],
                    ['DeveloperReadMe', 'Admin OR signed token', 'validateReadMeToken', 'Always enforced'],
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

        {/* Backend Functions Reference */}
        <section id="backend-functions" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Code className="w-6 h-6 text-[#4F8CFF]" />
            13. Backend Functions Reference
          </h2>
          <CCCard className="space-y-3">
            <p className="text-xs text-[#9AA6BC]"><strong>All functions use @base44/sdk@0.8.25. Listed by category:</strong></p>
            <div className="space-y-3">
              <div className="border-l-2 border-[#4F8CFF] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Hosting & Bookings</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>manageProperty()</code> — Property CRUD, onboarding, host eligibility</li>
                  <li><code>manageSoloSession()</code> — Booking lifecycle (draft→completed), contract creation</li>
                  <li><code>manageBookingAccess()</code> — Check-in (GPS/manual), access code gen, smart lock</li>
                  <li><code>managePropertyReview()</code> — Review creation, aggregation, integrity scoring</li>
                  <li><code>activateHostAccount()</code> — Enable host account after onboarding</li>
                </ul>
              </div>
              <div className="border-l-2 border-[#FF2DAA] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Search & Discovery</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>extendedSearch()</code> — Unified results (profiles + properties) with ranking</li>
                </ul>
              </div>
              <div className="border-l-2 border-[#22C55E] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Access Control</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>validateVerificationStatus()</code> — Check verification before feature access</li>
                  <li><code>protectedActions()</code> — Common mutations (ban checks, user-scoped operations)</li>
                </ul>
              </div>
              <div className="border-l-2 border-[#F59E0B] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Payments</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>paymentWebhookHandler()</code> — CCBill webhooks → Subscription status updates</li>
                </ul>
              </div>
              <div className="border-l-2 border-[#EC4899] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Admin & Security</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>adminModerationAction()</code> — Admin suspensions, bans, warnings</li>
                  <li><code>generateReadMeToken()</code> — Admin-only: 24h README access token</li>
                  <li><code>validateReadMeToken()</code> — Token validation (HMAC-SHA256)</li>
                </ul>
              </div>
              <div className="border-l-2 border-[#06B6D4] pl-3">
                <p className="text-xs font-semibold text-[#E8EEF9]">Messaging & Social</p>
                <ul className="list-disc list-inside text-xs text-[#9AA6BC] mt-1">
                  <li><code>startConversation()</code> — Thread creation + moderation</li>
                  <li><code>sendFriendRequest()</code>, <code>respondToFriendRequest()</code>, <code>cancelFriendRequest()</code></li>
                </ul>
              </div>
            </div>
          </CCCard>
        </section>

        <AutomationsSection />

        {/* Admin Systems */}
        <section id="admin" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#4F8CFF]" />
            14. Admin Systems
          </h2>
          <CCCard className="space-y-3">
            <p className="text-xs text-[#9AA6BC] mb-2"><strong>Admin Panels (in /AdminDashboard):</strong></p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { panel: 'FeatureFlagsPanel', purpose: 'Toggle feature flags in real-time + View-As mode' },
                { panel: 'SearchRankingConfigPanel', purpose: 'Adjust search ranking weights' },
                { panel: 'SuspiciousReviewsPanel', purpose: 'Review integrity audit + override scores' },
                { panel: 'HostingPricingPanel', purpose: 'Platform-wide pricing overrides' },
                { panel: 'PaymentProvidersPanel', purpose: 'Payment provider credentials config' },
                { panel: 'UserModerationPanel', purpose: 'Ban/suspend/warn users + create incidents' },
                { panel: 'PropertyIncidentsPanel', purpose: 'Damage reports + enforcement' },
                { panel: 'VerificationReviewQueue', purpose: 'ID verification decisions' },
              ].map(({ panel, purpose }) => (
                <div key={panel} className="text-xs">
                  <span className="font-semibold text-[#E8EEF9]">{panel}</span> — {purpose}
                </div>
              ))}
            </div>
          </CCCard>
        </section>

        {/* README Access Security */}
        <section id="readme-access" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Key className="w-6 h-6 text-[#4F8CFF]" />
            17. README Access Security
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Access Control</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><strong>Admin:</strong> Full access via <code>user?.role === 'admin' || user?.role_type === 'admin'</code></li>
                <li><strong>Non-Admin:</strong> Requires valid 24h signed token via URL param <code>?access_token=...</code></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Token Generation</h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#9AA6BC]">
                <li><code>generateReadMeToken()</code> — Admin function, returns 24h signed JWT</li>
                <li>Signature: HMAC-SHA256 with <code>README_TOKEN_SECRET</code> env var (required)</li>
                <li>Claim: exp set to current time + 86400 seconds (24 hours)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-2">Token Validation</h3>
              <p className="text-xs text-[#9AA6BC]"><code>validateReadMeToken()</code> — Verifies signature + expiry. Invalid/expired → block page, show access error.</p>
            </div>
          </CCCard>
        </section>

        {/* Smart Lock System */}
        <section id="smart-lock" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#4F8CFF]" />
            15. Smart Lock Architecture
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
            16. Payment System Architecture
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

        {/* 18. Known Limitations */}
        <section id="limitations" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
            18. Known Limitations
          </h2>
          <CCCard className="space-y-3">
            <div className="border-l-2 border-[#F59E0B] pl-3">
              <p className="text-xs font-semibold text-[#E8EEF9]">Smart Lock Integration</p>
              <p className="text-xs text-[#9AA6BC] mt-1">Architecture is ready and tested. External provider credentials (August API keys, Nuki tokens, etc.) are not configured in demo. Activation requires provider registration + secret setup.</p>
            </div>
            <div className="border-l-2 border-[#F59E0B] pl-3">
              <p className="text-xs font-semibold text-[#E8EEF9]">Payment Provider Credentials</p>
              <p className="text-xs text-[#9AA6BC] mt-1">CCBill provider structure is implemented. Merchant credentials (merchantId, flexFormId, etc.) are not pre-configured. Required for production: register with CCBill, configure in <code>PaymentProvidersPanel</code> or environment.</p>
            </div>
            <div className="border-l-2 border-[#F59E0B] pl-3">
              <p className="text-xs font-semibold text-[#E8EEF9]">Email Notifications</p>
              <p className="text-xs text-[#9AA6BC] mt-1">System uses <code>SendEmail</code> integration. Template system is not implemented yet — email bodies are hardcoded in function logic.</p>
            </div>
            <div className="border-l-2 border-[#F59E0B] pl-3">
              <p className="text-xs font-semibold text-[#E8EEF9]">No Real-Time Collaboration Tools</p>
              <p className="text-xs text-[#9AA6BC] mt-1">Collaborations are asynchronous (contracts, messages). No live co-editing, real-time calendars, or video calls in-app.</p>
            </div>
          </CCCard>
        </section>

        <ChangeGovernanceSection />
        <RecentChangesSection />

        {/* 20. Backend Deployment Checklist */}
        <section id="backend-checklist" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Database className="w-6 h-6 text-[#4F8CFF]" />
            20. Backend Deployment Checklist
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
  );
}