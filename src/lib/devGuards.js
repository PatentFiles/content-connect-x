/**
 * devGuards.js — Development-only regression safeguard.
 *
 * Identifies forbidden patterns that indicate scattered or legacy feature-flag
 * enforcement that should be handled by centralized guards instead.
 *
 * Usage (in browser console or a dev-only utility):
 *   import { checkForbiddenPatterns } from '@/lib/devGuards';
 *   checkForbiddenPatterns(sourceCodeString, 'pages/MyPage');
 *
 * This file has NO production side effects — it only exports pure functions.
 * It is never imported automatically; use it manually during code review or
 * CI linting to catch regressions early.
 */

// ─── Forbidden patterns ────────────────────────────────────────────────────────

export const FORBIDDEN_PATTERNS = [
  // Direct verification logic outside centralized guards
  { pattern: /\buser\.is_verified\b/,       reason: 'Use VerificationGate or useFeatureFlag("verification") instead of user.is_verified' },
  { pattern: /\!user\.is_verified\b/,       reason: 'Use VerificationGate instead of !user.is_verified' },
  { pattern: /\bisVerified\b(?!\s*=)/,      reason: 'isVerified variable should not exist in pages — use VerificationGate' },
  { pattern: /\brequireVerification\b/,     reason: 'Use VerificationGate or the centralized validateVerificationStatus backend function' },
  { pattern: /VerificationRequired/,        reason: 'Prefer VerificationGate over VerificationRequired in page-level guards' },

  // Inline feature-flag checks that should be FeatureGate
  { pattern: /\bfeatureEnabled\b(?!\s*=)(?!.*FeatureGate)/,
    reason: 'Inline featureEnabled checks in pages should use FeatureGate component instead' },
  { pattern: /\bverificationEnabled\b(?!\s*=)/,
    reason: 'verificationEnabled variable should not be scattered in pages — use FeatureGate or VerificationGate' },

  // Query enabled conditions gated on features
  { pattern: /enabled:\s*(isVerified|verificationEnabled|featureEnabled)/,
    reason: 'Query enabled conditions must be based on !!user or required IDs only, not feature flags' },
];

/**
 * Check a source code string for forbidden patterns.
 * Returns an array of violation objects { pattern, reason, line }.
 *
 * @param {string} source  - Raw source code string
 * @param {string} [file]  - Optional file path for labeling violations
 * @returns {{ file: string, pattern: string, reason: string, line: number }[]}
 */
export function checkForbiddenPatterns(source, file = 'unknown') {
  const lines = source.split('\n');
  const violations = [];

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    lines.forEach((line, index) => {
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (pattern.test(line)) {
        violations.push({
          file,
          pattern: pattern.toString(),
          reason,
          line: index + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  return violations;
}

/**
 * Log violations to console in a readable format.
 * No-op if no violations found.
 *
 * @param {{ file: string, pattern: string, reason: string, line: number }[]} violations
 */
export function reportViolations(violations) {
  if (!violations.length) {
    console.log('[devGuards] ✅ No forbidden patterns found.');
    return;
  }
  console.warn(`[devGuards] ⚠️  ${violations.length} violation(s) found:`);
  for (const v of violations) {
    console.warn(`  ${v.file}:${v.line} — ${v.reason}`);
    console.warn(`    └─ ${v.snippet}`);
  }
}

/**
 * Convenience: check and log in one call.
 *
 * @param {string} source
 * @param {string} [file]
 */
export function auditFile(source, file) {
  const violations = checkForbiddenPatterns(source, file);
  reportViolations(violations);
  return violations;
}