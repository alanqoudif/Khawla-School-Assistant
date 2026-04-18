"use client"

import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseUrl } from "./env"

export function createBrowserSupabaseClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  if (!url || !key) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / anon or publishable key).")
  }
  return createBrowserClient(url, key)
}
