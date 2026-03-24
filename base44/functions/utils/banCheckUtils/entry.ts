/**
 * NOTE: This file is a no-op placeholder.
 * Deno functions cannot import from other files.
 * Ban check logic is inlined directly into each function that needs it.
 * 
 * Do not import from this file.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  return Response.json({ message: 'This is an internal utility stub' }, { status: 200 });
});