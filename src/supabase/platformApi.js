import { supabase } from '@/api/supabaseClient';

/**
 * Authenticated endpoint for migrated social, scheduling, feedback and feature
 * switches. The API validates the actual Supabase session on every request.
 * UI-level flags are purely hints; server authorization remains mandatory.
 */
export async function platformAction(action, data = {}) {
  const { data: result, error } = await supabase.functions.invoke('platform-extras', {
    body: { action, ...data },
  });
  if (error || result?.error) {
    let reason = result?.error || error?.message || 'This feature is temporarily unavailable';
    // The SDK returns generic FunctionsHttpError messages for 4xx responses.
    // When safe, read the server's explanatory error without leaking private data.
    if (error?.context?.json) {
      try {
        const body = await error.context.json();
        if (typeof body?.error === 'string') reason = body.error;
      } catch { /* use the original error */ }
    }
    throw new Error(reason);
  }
  return result;
}
