// Minimal HTML sanitizer for user-authored rich text.
// Strips script-capable elements and attributes before the markup reaches
// a dangerouslySetInnerHTML sink.

const BLOCKED_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select',
  'svg', 'math', 'template', 'noscript',
]);

const BLOCKED_ATTRS = new Set([
  'srcdoc', 'formaction', 'action', 'xlink:href', 'http-equiv', 'target',
]);

const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:text/html', 'data:application'];

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.body.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      // Strip control/whitespace chars before protocol inspection so payloads
      // like "java\nscript:" are still caught.
      const value = (attr.value || '').replace(/[\s\u0000-\u001F]/g, '').toLowerCase();
      if (
        name.startsWith('on') ||
        BLOCKED_ATTRS.has(name) ||
        DANGEROUS_PROTOCOLS.some((p) => value.startsWith(p))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default sanitizeHtml;