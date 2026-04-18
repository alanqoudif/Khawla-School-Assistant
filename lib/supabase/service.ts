import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "./env"

/** Server-only client that bypasses RLS. Returns null if not configured. */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
