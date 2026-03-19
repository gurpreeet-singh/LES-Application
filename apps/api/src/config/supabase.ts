import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service role client — bypasses RLS, used for server-side operations
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Anon client — respects RLS, used with user's JWT
export function createSupabaseClient(accessToken?: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}
