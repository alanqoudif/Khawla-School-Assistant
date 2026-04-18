import type React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LayoutDashboard, FileText, BarChart3, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { AdminSignOutButton } from "@/components/admin-sign-out-button"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/admin/guide", label: "محتوى الدليل", icon: FileText },
  { href: "/admin/analytics", label: "الإحصائيات", icon: BarChart3 },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
]

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/admin/login")
  }
  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    redirect("/admin/login?error=forbidden")
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="border-b md:border-b-0 md:border-l border-slate-200 bg-teal-900 text-white md:w-56 shrink-0">
        <div className="p-4 border-b border-teal-800">
          <p className="font-bold text-lg">لوحة الإدارة</p>
          <p className="text-xs text-teal-200 truncate" title={profile.email ?? undefined}>
            {profile.email ?? user.email}
          </p>
        </div>
        <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-visible">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10 whitespace-nowrap",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 mt-auto hidden md:block">
          <AdminSignOutButton tone="onDark" />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3">
          <h1 className="text-xl font-semibold text-slate-900">مدرسة خولة — إدارة الموقع</h1>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
        <footer className="md:hidden p-2 border-t bg-slate-100">
          <AdminSignOutButton tone="onLight" />
        </footer>
        <footer className="hidden md:block bg-slate-100 text-slate-600 py-2 px-6 text-center text-xs border-t">
          © {new Date().getFullYear()} مدرسة خولة
        </footer>
      </div>
    </div>
  )
}
