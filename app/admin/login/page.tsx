"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/env"

function LoginForm() {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/admin"
  const errorParam = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage("لم يُضبط Supabase: أضف NEXT_PUBLIC_SUPABASE_URL ومفتاح anon أو publishable في البيئة.")
      return
    }
    if (errorParam === "forbidden") {
      setMessage("هذا الحساب ليس لديه صلاحية إدارية.")
    }
    if (errorParam === "config") {
      setMessage("إعدادات Supabase غير مكتملة.")
    }
  }, [errorParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!isSupabaseConfigured()) {
      setMessage("Supabase غير مُضبط.")
      return
    }
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: signData, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setMessage(error.message)
        return
      }
      const user = signData.user
      if (!user) {
        setMessage("تعذر إكمال تسجيل الدخول.")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      if (profile?.role !== "admin") {
        await supabase.auth.signOut()
        setMessage("هذا الحساب ليس لديه صلاحية إدارية.")
        return
      }
      const target = nextPath.startsWith("/admin") ? nextPath : "/admin"
      // Full navigation so middleware receives the session cookies (client transitions can miss them).
      window.location.assign(target)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "حدث خطأ غير متوقع")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-right">تسجيل دخول الإدارة</CardTitle>
          <CardDescription className="text-right">
            لوحة إدارة مدرسة خولة — دليل القبول الموحد
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2 text-right">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 text-right">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="text-left"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جاري الدخول..." : "دخول"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/" className="underline">
                العودة للموقع
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">...</div>}>
      <LoginForm />
    </Suspense>
  )
}
