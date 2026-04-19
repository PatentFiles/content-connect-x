/**
 * Feature Flag System
 *
 * Architecture:
 *   1. DEFAULT_FLAGS defines the baseline for every flag (used before DB loads,
 *      and as a fallback if a flag is missing from the database).
 *   2. FeatureFlagProvider fetches PlatformFeatureFlag records and merges them
 *      on top of defaults — DB always wins.
 *   3. useFeatureFlag(key) → boolean | number | string
 *   4. useFeatureFlags() → full map for bulk checks
 *   5. <FeatureGate flag="key"> wraps conditional UI rendering.
 *
 * Adding a new flag:
 *   - Add it to DEFAULT_FLAGS below with its default value.
 *   - Admin can override it from the Feature Flags tab in AdminDashboard.
 *   - Reference it via useFeatureFlag('your_flag_key') anywhere in the app.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ─── Default flag definitions ──────────────────────────────────────────────────
// These are the in-code defaults. The DB can override any value at runtime.
// value_type drives how the DB value is read (bool_value / number_value / text_value).

export const DEFAULT_FLAGS = {
  // ── Core platform features ──
  messaging:               { value: true,  value_type: 'boolean', label: 'Messaging',            category: 'core',         affects_nav: true,  nav_pages: ['Messages'] },
  discovery:               { value: true,  value_type: 'boolean', label: 'Discovery',             category: 'core',         affects_nav: true,  nav_pages: ['Discovery'] },
  collaborations:          { value: true,  value_type: 'boolean', label: 'Collaborations',        category: 'core',         affects_nav: true,  nav_pages: ['Collaborations', 'CreateCollaboration', 'CollaborationDetail'] },
  contracts:               { value: true,  value_type: 'boolean', label: 'Contracts',             category: 'core',         affects_nav: true,  nav_pages: ['Contracts', 'ViewContract'] },
  favorites:               { value: true,  value_type: 'boolean', label: 'Favorites',             category: 'core',         affects_nav: true,  nav_pages: ['Favorites'] },
  connections:             { value: true,  value_type: 'boolean', label: 'Friends / Connections', category: 'core',         affects_nav: true,  nav_pages: ['Connections'] },
  portfolio:               { value: true,  value_type: 'boolean', label: 'Portfolio',             category: 'core',         affects_nav: true,  nav_pages: ['Portfolio'] },
  representations:         { value: true,  value_type: 'boolean', label: 'Agent Representations', category: 'core',         affects_nav: true,  nav_pages: ['Representations', 'RosterPortfolio', 'AgentManagement'] },
  verification:            { value: true,  value_type: 'boolean', label: 'ID Verification',       category: 'compliance',   affects_nav: true,  nav_pages: ['Verification'] },
  testing:                 { value: true,  value_type: 'boolean', label: 'Health Testing',        category: 'compliance',   affects_nav: true,  nav_pages: ['Testing'] },
  search:                  { value: true,  value_type: 'boolean', label: 'Search',                category: 'core',         affects_nav: true,  nav_pages: ['Search'] },
  availability_schedule:   { value: true,  value_type: 'boolean', label: 'Availability Schedule', category: 'core',         affects_nav: true,  nav_pages: ['AvailabilitySchedule'] },
  travel_schedule:         { value: true,  value_type: 'boolean', label: 'Travel Schedule',       category: 'core',         affects_nav: true,  nav_pages: ['TravelSchedule'] },
  notifications:           { value: true,  value_type: 'boolean', label: 'Notifications',         category: 'core',         affects_nav: true,  nav_pages: ['Notifications'] },

  // ── Safety & compliance features ──
  comm_filter:             { value: true,  value_type: 'boolean', label: 'Communication Filter (Off-Platform Sharing)', category: 'safety', affects_nav: false },
  safety_checkin:          { value: true,  value_type: 'boolean', label: 'Safety Check-In',       category: 'safety',       affects_nav: false },
  compliance_portal:       { value: true,  value_type: 'boolean', label: 'Compliance Portal',     category: 'compliance',   affects_nav: true,  nav_pages: ['CompliancePortal'] },
  moderation_flags:        { value: true,  value_type: 'boolean', label: 'Moderation Flags Page', category: 'compliance',   affects_nav: true,  nav_pages: ['ModerationFlags'] },

  // ── Marketplace / upcoming features ──
  hosting_marketplace:     { value: false, value_type: 'boolean', label: 'Hosting Marketplace',   category: 'marketplace',  affects_nav: true,  nav_pages: ['HostingMarketplace', 'PropertyDetail', 'HostDashboard', 'HostProfile', 'HostSettings'] },
  solo_sessions:           { value: false, value_type: 'boolean', label: 'Solo Sessions (booking sessions for location/service)', category: 'marketplace', affects_nav: true, nav_pages: ['SoloSessionDetail'] },
  payment_processing:      { value: false, value_type: 'boolean', label: 'Payment Processing (CCBill / provider integration)', category: 'marketplace', affects_nav: false },
  gps_checkin:             { value: false, value_type: 'boolean', label: 'GPS Check-In (property-level toggle, geofence enforcement)', category: 'safety', affects_nav: false },
  smart_lock_enabled:      { value: false, value_type: 'boolean', label: 'Smart Lock Integration (provider config + API-ready architecture)', category: 'marketplace', affects_nav: false },
  checkout_evidence_enabled: { value: false, value_type: 'boolean', label: 'Checkout Evidence (photo/video upload at checkout)', category: 'safety', affects_nav: false },
  pro_host_tier:           { value: false, value_type: 'boolean', label: 'Pro Host Tier',         category: 'marketplace',  affects_nav: false },
  equipment_rentals:       { value: false, value_type: 'boolean', label: 'Equipment Rentals (host inventory + guest add-ons)', category: 'marketplace', affects_nav: false },
  bundle_templates:        { value: false, value_type: 'boolean', label: 'Bundle Templates (space/production packages)',        category: 'marketplace', affects_nav: false },
  cleaning_fee:            { value: false, value_type: 'boolean', label: 'Cleaning Fee (host-controlled, shown in breakdown)',  category: 'marketplace', affects_nav: false },
  damage_deposits:         { value: false, value_type: 'boolean', label: 'Damage Deposits (host-configured, shown in pricing + booking flow)', category: 'marketplace', affects_nav: false },
  property_incidents:      { value: true,  value_type: 'boolean', label: 'Property Incidents (damage, no-show, safety — filed by host/guest)', category: 'safety', affects_nav: false },
  geo_risk_tagging:        { value: false, value_type: 'boolean', label: 'Geo Risk Tagging (admin-only: risk level, reserve %, ranking penalty)', category: 'safety', affects_nav: false },
  host_insurance_verification: { value: false, value_type: 'boolean', label: 'Host Insurance Verification (admin review + trust badge)', category: 'compliance', affects_nav: false },
  favorites_by_type:       { value: false, value_type: 'boolean', label: 'Favorites by Type',     category: 'experimental', affects_nav: false },
  // ── Hosting pricing system ──
  hosting_pricing_enabled: { value: true,  value_type: 'boolean', label: 'Hosting Pricing (fee disclosures + breakdowns)', category: 'marketplace', affects_nav: false },
  pro_host_enabled:        { value: false, value_type: 'boolean', label: 'Pro Host Tier (reduced fees, faster payouts, badge)', category: 'marketplace', affects_nav: false },
  reserve_system_enabled:  { value: false, value_type: 'boolean', label: 'Reserve System (hold % of payout for dispute protection)', category: 'marketplace', affects_nav: false },
  dynamic_payout_enabled:  { value: false, value_type: 'boolean', label: 'Dynamic Payout Timing (configurable delay per tier)', category: 'marketplace', affects_nav: false },

  // ── Hosting pricing numeric config ──
  hosting_booking_fee_pct:     { value: 20,  value_type: 'number', label: 'Standard Booking Fee %',       category: 'marketplace' },
  pro_host_booking_fee_pct:    { value: 12,  value_type: 'number', label: 'Pro Host Booking Fee %',        category: 'marketplace' },
  pro_host_subscription_price: { value: 25,  value_type: 'number', label: 'Pro Host Subscription $/mo',   category: 'marketplace' },
  reserve_pct_default:         { value: 10,  value_type: 'number', label: 'Default Reserve %',            category: 'marketplace' },
  reserve_pct_pro_host:        { value: 5,   value_type: 'number', label: 'Pro Host Reserve %',           category: 'marketplace' },
  payout_delay_hours_default:  { value: 24,  value_type: 'number', label: 'Default Payout Delay (hrs)',   category: 'marketplace' },
  payout_delay_hours_pro_host: { value: 12,  value_type: 'number', label: 'Pro Host Payout Delay (hrs)',  category: 'marketplace' },
  access_issue_sla_minutes:    { value: 30,  value_type: 'number', label: 'Access Issue SLA (min)',        category: 'marketplace' },

  cancellation_policies:   { value: false, value_type: 'boolean', label: 'Cancellation Policies (host presets: flexible/moderate/strict/custom, refund windows, credit, no-show, deposit linkage)', category: 'marketplace', affects_nav: false },
  location_contract_clauses: { value: false, value_type: 'boolean', label: 'Location Contract Clauses (property rules, access, liability, damage deposit, cancellation injected at booking)', category: 'compliance', affects_nav: false },
  agreement_acceptance_log: { value: true,  value_type: 'boolean', label: 'Agreement Acceptance Log (immutable log of every acceptance event — sessions, bookings, property, collaborations)', category: 'compliance', affects_nav: false },
  external_participant_attestation: { value: false, value_type: 'boolean', label: 'External Participant Attestation (age/ID/consent attestation for off-platform talent — studios/productions)', category: 'safety', affects_nav: false },
  content_usage_tracking:  { value: false, value_type: 'boolean', label: 'Content Usage Tracking (log publish events, unauthorized use, takedown requests per session/collaboration)', category: 'compliance', affects_nav: false },

  // ── Search & reviews ──
  search_ranking_enabled:  { value: false, value_type: 'boolean', label: 'Search Ranking Config (admin-configurable weights for title, city, description, role, boosts)', category: 'marketplace', affects_nav: false },
  property_reviews_enabled: { value: false, value_type: 'boolean', label: 'Property Reviews (verified reviews from completed bookings, rating aggregation, ranking signals)', category: 'marketplace', affects_nav: false },
  review_recency_enabled:  { value: false, value_type: 'boolean', label: 'Review Recency Weighting (recent reviews ranked higher in scoring)', category: 'marketplace', affects_nav: false },
  review_integrity_enabled: { value: false, value_type: 'boolean', label: 'Review Integrity Checks (detect + filter spam, weight by integrity score)', category: 'safety', affects_nav: false },
  ranking_boosts_enabled: { value: false, value_type: 'boolean', label: 'Ranking Monetization Boosts (featured, verified property boosts)', category: 'marketplace', affects_nav: false },
  review_rate_limit_enabled: { value: false, value_type: 'boolean', label: 'Review Rate Limiting (max submissions per 24h)', category: 'safety', affects_nav: false },

  // ── Review config ──
  review_max_submissions_per_24h: { value: 5, value_type: 'number', label: 'Max Reviews Per 24h', category: 'safety' },
  review_edit_window_hours: { value: 24, value_type: 'number', label: 'Review Edit Window (hours after creation)', category: 'marketplace' },
  recency_weight_7_days: { value: 1.5, value_type: 'number', label: 'Recency Multiplier: ≤7 days', category: 'marketplace' },
  recency_weight_30_days: { value: 1.2, value_type: 'number', label: 'Recency Multiplier: ≤30 days', category: 'marketplace' },
  recency_weight_90_days: { value: 1.0, value_type: 'number', label: 'Recency Multiplier: ≤90 days', category: 'marketplace' },
  recency_weight_default: { value: 0.7, value_type: 'number', label: 'Recency Multiplier: default (>90 days)', category: 'marketplace' },

  // ── Numeric / text config ──
  max_messages_per_day:    { value: 100,   value_type: 'number',  label: 'Max Messages Per Day',  category: 'safety' },
  platform_policy_version: { value: '1.0', value_type: 'text',    label: 'Platform Policy Version', category: 'compliance' },
  
  // ── Search ranking weights (numeric) ──
  search_ranking_title_weight: { value: 5,   value_type: 'number', label: 'Title Match Weight', category: 'marketplace' },
  search_ranking_city_weight: { value: 2,   value_type: 'number', label: 'City Match Weight', category: 'marketplace' },
  search_ranking_description_weight: { value: 1, value_type: 'number', label: 'Description Match Weight', category: 'marketplace' },
  search_ranking_role_weight: { value: 2,   value_type: 'number', label: 'Role Weight', category: 'marketplace' },
  search_ranking_exact_match_boost: { value: 5, value_type: 'number', label: 'Exact Match Boost', category: 'marketplace' },
  search_ranking_property_boost: { value: 0, value_type: 'number', label: 'Property Type Boost', category: 'marketplace' },
  search_ranking_profile_boost: { value: 0, value_type: 'number', label: 'Profile Type Boost', category: 'marketplace' },
  search_ranking_pro_host_boost: { value: 2, value_type: 'number', label: 'Pro Host Boost', category: 'marketplace' },
  search_ranking_high_reputation_boost: { value: 2, value_type: 'number', label: 'High Reputation Boost (4.5+)', category: 'marketplace' },
  search_ranking_rating_weight: { value: 1, value_type: 'number', label: 'Average Rating Weight', category: 'marketplace' },
  search_ranking_review_volume_weight: { value: 0.5, value_type: 'number', label: 'Review Volume Weight', category: 'marketplace' },

  // ── Monetization hooks ──
  search_ranking_featured_property_boost: { value: 5, value_type: 'number', label: 'Featured Property Boost (monetization hook)', category: 'marketplace' },
  search_ranking_verified_property_boost: { value: 3, value_type: 'number', label: 'Verified Property Boost (4.5+ rating, monetization hook)', category: 'marketplace' },
  search_ranking_freshness_boost: { value: 2, value_type: 'number', label: 'Freshness Boost (recent reviews, ≤30 days)', category: 'marketplace' },
  search_ranking_max_rating_score: { value: 10, value_type: 'number', label: 'Max Rating Contribution (cap)', category: 'marketplace' },
  search_ranking_max_volume_score: { value: 8, value_type: 'number', label: 'Max Volume Contribution (cap)', category: 'marketplace' },
  };

// ─── Context ───────────────────────────────────────────────────────────────────

const FeatureFlagContext = createContext({});

export function FeatureFlagProvider({ children }) {
  const { data: dbFlags = [] } = useQuery({
    queryKey: ['platformFeatureFlags'],
    queryFn: () => base44.entities.PlatformFeatureFlag.list(),
    staleTime: 60_000,      // Re-fetch at most once per minute
    refetchInterval: 120_000, // Background refresh every 2 min
  });

  const flags = useMemo(() => {
    // Start with defaults
    const merged = {};
    for (const [key, def] of Object.entries(DEFAULT_FLAGS)) {
      merged[key] = def.value;
    }
    // Overlay with DB values
    for (const record of dbFlags) {
      if (!record.flag_key) continue;
      if (record.value_type === 'number') {
        merged[record.flag_key] = record.number_value ?? merged[record.flag_key];
      } else if (record.value_type === 'text') {
        merged[record.flag_key] = record.text_value ?? merged[record.flag_key];
      } else {
        merged[record.flag_key] = record.bool_value ?? merged[record.flag_key];
      }
    }
    return merged;
  }, [dbFlags]);

  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the value (boolean/number/string) for a single flag. Falls back to DEFAULT_FLAGS default. */
export function useFeatureFlag(key) {
  const flags = useContext(FeatureFlagContext);
  if (key in flags) return flags[key];
  // Fallback to static default if provider not yet loaded
  return DEFAULT_FLAGS[key]?.value ?? true;
}

/** Returns the full flag map. */
export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

/**
 * Returns a filtered list of nav items, removing any pages whose controlling
 * flag is disabled.  Pass in the full nav items array from roleNavConfig.
 */
export function useFilteredNav(navItems) {
  const flags = useFeatureFlags();
  return useMemo(() => {
    // Build a set of hidden pages from disabled flags
    const hiddenPages = new Set();
    for (const [key, def] of Object.entries(DEFAULT_FLAGS)) {
      if (def.affects_nav && def.nav_pages && flags[key] === false) {
        def.nav_pages.forEach(p => hiddenPages.add(p));
      }
    }
    return navItems.filter(item => !hiddenPages.has(item.path));
  }, [flags, navItems]);
}