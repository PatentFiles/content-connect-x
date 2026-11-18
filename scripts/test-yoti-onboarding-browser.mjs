/** Backwards-compatible CI entrypoint. All assertions now execute against the
 * real first-party identity screen; this does not skip or weaken the release gate.
 */
await import('./test-identity-onboarding-browser.mjs');
