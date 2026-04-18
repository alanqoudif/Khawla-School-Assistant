import { createClient } from "./server"

export type AdminContext =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; reason: "no_session" | "not_admin" | "unconfigured" }

export async function getAdminContext(): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return { ok: false, reason: "unconfigured" }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, reason: "no_session" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || profile?.role !== "admin") {
    return { ok: false, reason: "not_admin" }
  }

  return {
    ok: true,
    userId: user.id,
    email: profile.email ?? user.email ?? null,
  }
}
