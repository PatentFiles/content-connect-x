/**
 * validateReadMeToken
 *
 * Validates a DeveloperReadMe access token.
 * Returns { valid: true } or { valid: false, reason: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOKEN_SECRET = Deno.env.get('README_TOKEN_SECRET') || Deno.env.get('BASE44_APP_ID') || 'cc-readme-default-secret';

async function hmacVerify(data, signature, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  // Decode base64url signature
  const b64 = signature.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
  const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', cryptoKey, sigBytes, msgData);
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
  return atob(padded);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return Response.json({ valid: false, reason: 'No token provided' });
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return Response.json({ valid: false, reason: 'Malformed token' });
    }

    const [payloadB64, signature] = parts;

    // Verify signature
    const isValid = await hmacVerify(payloadB64, signature, TOKEN_SECRET);
    if (!isValid) {
      return Response.json({ valid: false, reason: 'Invalid token signature' });
    }

    // Decode and check expiry
    let payload;
    try {
      payload = JSON.parse(b64urlDecode(payloadB64));
    } catch {
      return Response.json({ valid: false, reason: 'Malformed token payload' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return Response.json({ valid: false, reason: 'Token expired', expired_at: new Date(payload.exp * 1000).toISOString() });
    }

    if (payload.purpose !== 'readme_access') {
      return Response.json({ valid: false, reason: 'Invalid token purpose' });
    }

    return Response.json({
      valid: true,
      expires_at: new Date(payload.exp * 1000).toISOString(),
      issued_by: payload.issued_by || null,
    });

  } catch (error) {
    return Response.json({ valid: false, reason: 'Validation error: ' + error.message }, { status: 500 });
  }
});