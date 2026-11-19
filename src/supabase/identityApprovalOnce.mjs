/** UI callback deduplication only; never grants verification or admission.
 * The server-owned verified session status remains the sole approval signal.
 * A failed navigation callback can be retried on a later status check.
 */
export function createIdentityApprovalGate() {
  const seen = new Set();
  return async function notify(session, callback) {
    if (session?.status !== 'approved' || typeof session.id !== 'string' || !session.id || typeof callback !== 'function') return false;
    if (seen.has(session.id)) return false;
    // Claim synchronously before awaiting, so concurrent refreshes cannot duplicate callbacks.
    seen.add(session.id);
    try {
      await callback();
      return true;
    } catch (error) {
      seen.delete(session.id);
      throw error;
    }
  };
}
