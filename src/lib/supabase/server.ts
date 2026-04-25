import { createClient } from "@supabase/supabase-js";

// Public client — for reading visible cached results.
// It respects Supabase RLS policies.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

// Admin client — for server-side writes and admin operations.
// It uses the service role key and bypasses RLS.
// Never use this client in client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}
