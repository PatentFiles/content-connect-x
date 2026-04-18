/**
 * Communication Filter — Off-Platform Sharing Detection
 *
 * Feature flag: COMM_FILTER_ENABLED (default true)
 * To disable globally during rollout, set COMM_FILTER_ENABLED = false below.
 *
 * Detects:
 *   - Phone numbers (US/intl, common obfuscation)
 *   - Email addresses (and dot/at obfuscation)
 *   - External links (http/https/www, common shorteners, obfuscated)
 */

export const COMM_FILTER_ENABLED = true;

// ─── Detection Patterns ───────────────────────────────────────────────────────

// Phone: standard, intl prefix, dot/dash/space/parens separators, spelled-out "dot"
const PHONE_PATTERNS = [
  // Standard US: (555) 555-5555 / 555-555-5555 / 5555555555
  /\b(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,
  // International prefix patterns
  /\b\+\d{1,3}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}\b/,
  // Obfuscated: "5 5 5 1 2 3 4 5 6 7" or "five five five..."
  /\b(\d[\s.\-]){6,}\d\b/,
  // Spelled separators: "555 dot 555 dot 5555"
  /\d{3}\s*(dot|\.)\s*\d{3}\s*(dot|\.)\s*\d{4}/i,
];

// Email: standard + obfuscation (at, [at], (at), "dot", [dot])
const EMAIL_PATTERNS = [
  // Standard
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  // Obfuscated @: "user [at] domain dot com"
  /[a-zA-Z0-9._%+\-]+\s*[\[\(]?at[\]\)]?\s*[a-zA-Z0-9.\-]+\s*([\[\(]?dot[\]\)]?\s*)[a-zA-Z]{2,}/i,
  // "user at domain.com"
  /\b\w[\w.+\-]*\s+at\s+\w[\w.\-]*\.\w{2,}\b/i,
];

// External links: http/https, www, common shorteners, obfuscated
const LINK_PATTERNS = [
  // Standard URLs
  /https?:\/\/[^\s]+/i,
  // www. without protocol
  /\bwww\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}/i,
  // Common shorteners without protocol
  /\b(bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|buff\.ly|rb\.gy|short\.link|linktr\.ee|lnkd\.in|youtu\.be)\b/i,
  // Obfuscated: "site dot com", "site [dot] com"
  /\b[a-zA-Z0-9\-]{3,}\s*([\[\(]?dot[\]\)]?)\s*[a-zA-Z]{2,}\b/i,
  // Social handles signaling off-platform: "@user on ig/snap/telegram"
  /\b@[\w.]+\s+(on\s+)?(instagram|ig|snapchat|snap|telegram|tg|signal|whatsapp|wa|discord|twitter|tiktok|onlyfans|fansly)\b/i,
  // "find me on X" patterns
  /\b(find|add|message|dm|text|reach|contact|hit)\s+(me\s+)?(on|at|via|through)\s+(instagram|ig|snap|snapchat|telegram|signal|whatsapp|discord|twitter|tiktok|onlyfans|fansly)\b/i,
];

// ─── Detection Logic ──────────────────────────────────────────────────────────

/**
 * Detect off-platform sharing attempts in a message body.
 * Returns null if clean, or { type, matched } if violation found.
 */
export function detectCommViolation(text) {
  if (!COMM_FILTER_ENABLED) return null;
  if (!text || typeof text !== 'string') return null;

  const cleaned = text.trim();

  for (const p of PHONE_PATTERNS) {
    if (p.test(cleaned)) return { type: 'phone_number' };
  }
  for (const p of EMAIL_PATTERNS) {
    if (p.test(cleaned)) return { type: 'email_address' };
  }
  for (const p of LINK_PATTERNS) {
    if (p.test(cleaned)) return { type: 'external_link' };
  }

  return null;
}

/**
 * Get the escalation level based on prior violation count.
 * count 0 → 'warn'
 * count 1-2 → 'restrict'
 * count 3+ → 'flag_admin'
 */
export function getEscalationLevel(priorCount) {
  if (priorCount >= 3) return 'flag_admin';
  if (priorCount >= 1) return 'restrict';
  return 'warn';
}

/**
 * Human-readable label for a violation type.
 */
export function violationTypeLabel(type) {
  switch (type) {
    case 'phone_number': return 'phone number';
    case 'email_address': return 'email address';
    case 'external_link': return 'external link or social handle';
    case 'obfuscated_phone': return 'phone number (obfuscated)';
    case 'obfuscated_email': return 'email address (obfuscated)';
    case 'obfuscated_link': return 'external link (obfuscated)';
    default: return 'off-platform contact information';
  }
}