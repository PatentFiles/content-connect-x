/**
 * Freemium access policy. This controls presentation and navigation, NOT data
 * permissions. Every premium mutation must also be checked on the server.
 * Approved age verification is always free and required for member previews.
 */
export const PUBLIC_ROUTES = new Set(['/', '/Landing', '/Pricing', '/HowItWorks', '/FAQ', '/Contact', '/Terms', '/Privacy']);
export const AGE_VERIFICATION_ROUTES = new Set([...PUBLIC_ROUTES, '/Verification', '/Settings']);
export const FREE_MEMBER_ROUTES = new Set([...AGE_VERIFICATION_ROUTES, '/Dashboard', '/Profile', '/Discovery', '/Search', '/ViewProfile']);
export function normalizePath(path = '/') {
  const clean = String(path).split(/[?#]/)[0].replace(/\/+$/, '');
  return clean || '/';
}
export function isFreeMemberRoute(path) { return FREE_MEMBER_ROUTES.has(normalizePath(path)); }
export function isPreVerificationRoute(path) { return AGE_VERIFICATION_ROUTES.has(normalizePath(path)); }
export function hasPaidAccess(subscription) {
  return Boolean(subscription && ['active', 'trial'].includes(subscription.status) &&
    (!subscription.renews_at || Date.parse(subscription.renews_at) > Date.now() || subscription.status === 'active'));
}
