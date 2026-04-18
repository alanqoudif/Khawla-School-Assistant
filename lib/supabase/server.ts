import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseAnonKey, getSupabaseUrl } from "./env"

export async function createClient() {
  const cookieStore = await cookies()
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  if (!url || !key) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / anon or publishable key).")
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      },
    },
  })
}
