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
  hosting_marketplace:     { value: false, value_type: 'boolean', label: 'Hosting Marketplace',   category: 'marketplace',  affects_nav: true,  nav_pages: ['HostingMarketplace', 'PropertyDetail', 'HostDashboard'] },
  solo_sessions:           { value: false, value_type: 'boolean', label: 'Solo Sessions',         category: 'marketplace',  affects_nav: true,  nav_pages: ['SoloSessionDetail'] },
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
  cancellation_policies:   { value: false, value_type: 'boolean', label: 'Cancellation Policies (host presets: flexible/moderate/strict/custom, refund windows, credit, no-show, deposit linkage)', category: 'marketplace', affects_nav: false },
  location_contract_clauses: { value: false, value_type: 'boolean', label: 'Location Contract Clauses (property rules, access, liability, damage deposit, cancellation injected at booking)', category: 'compliance', affects_nav: false },
  agreement_acceptance_log: { value: true,  value_type: 'boolean', label: 'Agreement Acceptance Log (immutable log of every acceptance event — sessions, bookings, property, collaborations)', category: 'compliance', affects_nav: false },
  external_participant_attestation: { value: false, value_type: 'boolean', label: 'External Participant Attestation (age/ID/consent attestation for off-platform talent — studios/productions)', category: 'safety', affects_nav: false },
  content_usage_tracking:  { value: false, value_type: 'boolean', label: 'Content Usage Tracking (log publish events, unauthorized use, takedown requests per session/collaboration)', category: 'compliance', affects_nav: false },

  // ── Numeric / text config ──
  max_messages_per_day:    { value: 100,   value_type: 'number',  label: 'Max Messages Per Day',  category: 'safety' },
  platform_policy_version: { value: '1.0', value_type: 'text',    label: 'Platform Policy Version', category: 'compliance' },
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