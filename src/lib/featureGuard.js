/**
 * featureGuard.js — Pure utility functions for feature flag enforcement.
 * Use these in backend functions, guards, and non-React logic.
 * For React UI, use FeatureGate component or useFeatureFlag hook instead.
 */

/**
 * Returns true if the flag is enabled.
 * @param {string} flagKey
 * @param {Object} flags - the full flags map from useFeatureFlags()
 */
export function isFeatureEnabled(flagKey, flags) {
  return !!flags?.[flagKey];
}

/**
 * Returns true if the flag is disabled (i.e. feature should be blocked).
 * @param {string} flagKey
 * @param {Object} flags
 */
export function shouldBlockFeature(flagKey, flags) {
  return !isFeatureEnabled(flagKey, flags);
}

/**
 * Returns true if verification should be enforced for this user.
 * If the verification flag is OFF, always returns false (bypass enforcement).
 * @param {Object} user - user object with is_admin
 * @param {boolean} isVerified - whether the user has an approved verification record
 * @param {Object} flags - the full flags map
 */
export function shouldRequireVerification(user, isVerified, flags) {
  if (!flags?.verification) return false;
  if (user?.is_admin || user?.role === 'admin') return false;
  return !isVerified;
}