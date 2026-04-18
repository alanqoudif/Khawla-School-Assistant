"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AdminSignOutButtonProps = {
  /** e.g. sidebar (teal) vs mobile footer (light) */
  tone?: "onDark" | "onLight"
}

export function AdminSignOutButton({ tone = "onDark" }: AdminSignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full justify-start",
        tone === "onDark" && "text-white hover:bg-white/10 hover:text-white",
        tone === "onLight" && "text-slate-800 hover:bg-slate-200",
      )}
      onClick={handleSignOut}
    >
      <LogOut className="ml-2 h-4 w-4" />
      تسجيل الخروج
    </Button>
  )
}
