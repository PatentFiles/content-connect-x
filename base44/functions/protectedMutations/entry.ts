/**
 * DEPRECATED — protectedMutations.js
 *
 * This function is a NO-OP stub. All protected mutations have been consolidated
 * into protectedActions.js. This file exists only to prevent 404 errors if any
 * legacy code still calls it.
 *
 * DO NOT USE. Route all mutations through protectedActions.js
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // Warn in logs so we can identify any legacy callers
  console.warn('[DEPRECATED] protectedMutations was called. All mutations should use protectedActions instead.');

  return Response.json(
    {
      error: 'DEPRECATED: Use protectedActions instead',
      redirect: '/protectedActions',
      message: 'This endpoint has been deprecated. All protected mutations route through protectedActions.js.',
    },
    { status: 410 }
  );
});