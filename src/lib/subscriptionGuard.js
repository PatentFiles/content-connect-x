/**
 * Centralized subscription access control layer.
 * Single source of truth for subscription enforcement.
 */

export const SUBSCRIPTION_STATES = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  PAST_DUE: 'past_due',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  MISSING: 'missing',
};

/**
 * Check if a subscription is active and usable.
 * @param {object} subscription - Subscription record
 * @returns {boolean}
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  const status = subscription.status || SUBSCRIPTION_STATES.MISSING;
  return status === SUBSCRIPTION_STATES.ACTIVE || status === SUBSCRIPTION_STATES.TRIAL;
}

/**
 * Get the reason why a subscription blocks access.
 * @param {object} subscription - Subscription record
 * @returns {string|null} - Block reason or null if subscription is active
 */
export function getSubscriptionBlockReason(subscription) {
  if (!subscription) {
    return 'no_subscription';
  }
  const status = subscription.status || SUBSCRIPTION_STATES.MISSING;
  if (isSubscriptionActive(subscription)) {
    return null;
  }
  if (status === SUBSCRIPTION_STATES.PAST_DUE) {
    return 'past_due';
  }
  if (status === SUBSCRIPTION_STATES.EXPIRED) {
    return 'expired';
  }
  if (status === SUBSCRIPTION_STATES.CANCELLED) {
    return 'cancelled';
  }
  return 'inactive';
}

/**
 * Determine if a user should be blocked from platform access due to subscription.
 * Public marketing pages are NEVER blocked.
 * Authenticated platform pages require active subscription.
 * @param {object} user - User record
 * @param {object} subscription - Subscription record
 * @param {string} currentPagePath - Current route path for context (optional)
 * @returns {boolean}
 */
export function shouldBlockForSubscription(user, subscription, currentPagePath = '') {
  if (!user) return false; // Not authenticated — page-level auth handles it
  
  // Public marketing pages are never blocked by subscription
  const publicPages = ['/', '/Landing', '/Pricing', '/HowItWorks', '/FAQ', '/Terms', '/Privacy'];
  if (publicPages.includes(currentPagePath)) return false;
  
  // All other authenticated pages require active subscription
  return !isSubscriptionActive(subscription);
}

/**
 * Get a user-friendly block message.
 * @param {string} reason - Block reason from getSubscriptionBlockReason()
 * @returns {string}
 */
export function getSubscriptionBlockMessage(reason) {
  const messages = {
    no_subscription: 'You need an active subscription to access this feature.',
    past_due: 'Your subscription payment is past due. Please update your billing information.',
    expired: 'Your subscription has expired. Please renew to continue using the platform.',
    cancelled: 'Your subscription was cancelled. Please reactivate it to continue.',
    inactive: 'Your subscription is inactive. Please renew to continue.',
  };
  return messages[reason] || 'Your subscription is not active. Please renew to continue.';
}