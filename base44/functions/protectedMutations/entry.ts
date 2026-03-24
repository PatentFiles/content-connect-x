/**
 * NOTE: This is a no-op stub. Mutation protection has been moved to protectedActions.js.
 * All sensitive mutations route through protectedActions.js which enforces ban/suspend checks.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  return Response.json(
    { error: 'Use protectedActions instead', redirect: '/protectedActions' },
    { status: 410 }
  );
});