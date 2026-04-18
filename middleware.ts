import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env"

const ADMIN_ROOT = "/admin"
const ADMIN_LOGIN = "/admin/login"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminArea = pathname === ADMIN_ROOT || pathname.startsWith(`${ADMIN_ROOT}/`)
  if (!isAdminArea) {
    return NextResponse.next()
  }

  const isLoginRoute = pathname === ADMIN_LOGIN || pathname.startsWith(`${ADMIN_LOGIN}/`)

  if (!isSupabaseConfigured()) {
    if (isLoginRoute) {
      return NextResponse.next()
    }
    const login = new URL(ADMIN_LOGIN, request.url)
    login.searchParams.set("error", "config")
    return NextResponse.redirect(login)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(getSupabaseUrl()!, getSupabaseAnonKey()!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isLoginRoute) {
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (profile?.role === "admin") {
        return NextResponse.redirect(new URL(ADMIN_ROOT, request.url))
      }
    }
    return response
  }

  if (!user) {
    const login = new URL(ADMIN_LOGIN, request.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    const login = new URL(ADMIN_LOGIN, request.url)
    login.searchParams.set("error", "forbidden")
    return NextResponse.redirect(login)
  }

  return response
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
}
