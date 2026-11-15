/**
 * Shared, dependency-free Yoti return-URL policy.
 * Imported by the Deno Edge Function and tested by Node's test runner.
 *
 * An age-check response is never used as proof of performer identity.
 * The provider redirect is navigational only: every actual result is fetched
 * from Yoti server-to-server against the stored session/reference IDs.
 */
export function trustedYotiOrigin(value) {
  if (typeof value !== 'string' || value.length > 240 || !value.trim()) return null;
  try {
    const candidate = new URL(value);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password ||
        candidate.search || candidate.hash || candidate.pathname !== '/' ||
        (candidate.port && candidate.port !== '443') ||
        !candidate.hostname.includes('.') || candidate.hostname === 'localhost') {
      return null;
    }
    return candidate.origin;
  } catch {
    return null;
  }
}

/** Never substitute Content Connect X for an unconfigured OnlyHost return URL. */
export function getYotiReturnOrigin(settings, brand) {
  const candidate = brand === 'onlyhost'
    ? settings?.secondary_origin
    : settings?.callback_origin;
  return trustedYotiOrigin(candidate);
}

/** A UI status must never say 'configured' for credentials alone. */
export function isYotiConfigured({ enabled, token, sdk, callback_origin } = {}) {
  return Boolean(enabled === true && token && sdk && trustedYotiOrigin(callback_origin));
}
