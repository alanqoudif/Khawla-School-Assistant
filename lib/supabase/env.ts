/** يفضّل `SUPABASE_URL` على الخادم؛ المتصفح يعتمد `NEXT_PUBLIC_SUPABASE_URL`. */
export function getSupabaseUrl(): string | undefined {
  const server = process.env.SUPABASE_URL?.trim()
  if (server) return server
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
}

/** Prefer legacy anon key; publishable key is supported for newer Supabase projects. */
export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}
