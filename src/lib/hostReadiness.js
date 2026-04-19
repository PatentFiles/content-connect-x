/**
 * Host Readiness — Single Source of Truth
 *
 * canCreateProperty(profile) → boolean
 *
 * A host is eligible to create a property when:
 *   1. host_account_active === true
 *   2. host_terms_accepted_at is not null
 *
 * Use this everywhere — do NOT duplicate this logic in individual components.
 */
export function canCreateProperty(profile) {
  if (!profile) return false;
  return profile.host_account_active === true && !!profile.host_terms_accepted_at;
}

/**
 * Human-readable reason why host cannot create a property.
 * Returns null if eligible.
 */
export function getHostBlockReason(profile) {
  if (!profile) return 'Profile not loaded';
  if (!profile.host_account_active) return 'Host account not yet activated';
  if (!profile.host_terms_accepted_at) return 'Host terms not yet accepted';
  return null;
}