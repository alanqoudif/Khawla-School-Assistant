"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

const KEYS = {
  guidePdf: "guide_pdf_path",
  amendmentPdf: "amendment_pdf_path",
} as const

function readPath(value: unknown): string {
  if (value && typeof value === "object" && "path" in value && typeof (value as { path: unknown }).path === "string") {
    return (value as { path: string }).path
  }
  return ""
}

export function SettingsForm() {
  const router = useRouter()
  const [guidePath, setGuidePath] = useState("/student-guide.pdf")
  const [amendmentPath, setAmendmentPath] = useState("/amendment2025.pdf")
  const [pineconeAssistantId, setPineconeAssistantId] = useState("")
  const [pineconeApiKeyInput, setPineconeApiKeyInput] = useState("")
  const [clearPineconeApiKey, setClearPineconeApiKey] = useState(false)
  const [dashRemainingUsd, setDashRemainingUsd] = useState("")
  const [dashTrialStart, setDashTrialStart] = useState("")
  const [dashTrialBudget, setDashTrialBudget] = useState("300")
  const [dashTrialDays, setDashTrialDays] = useState("21")
  const [pineconeMeta, setPineconeMeta] = useState<{
    hasApiKey: boolean
    apiKeyStoredInDatabase: boolean
    envProvidesApiKey: boolean
    serverCanReadDbSecrets: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const [pdfRes, pineRes] = await Promise.all([
          supabase.from("site_settings").select("key, value").in("key", [KEYS.guidePdf, KEYS.amendmentPdf]),
          fetch("/api/admin/pinecone-settings", { credentials: "include" }),
        ])

        if (cancelled) return

        if (pdfRes.error) {
          toast({ title: "تعذر تحميل مسارات PDF", description: pdfRes.error.message, variant: "destructive" })
        } else {
          for (const row of pdfRes.data ?? []) {
            if (row.key === KEYS.guidePdf) {
              const p = readPath(row.value)
              if (p) setGuidePath(p)
            }
            if (row.key === KEYS.amendmentPdf) {
              const p = readPath(row.value)
              if (p) setAmendmentPath(p)
            }
          }
        }

        if (pineRes.ok) {
          const j = (await pineRes.json()) as {
            assistantId?: string
            hasApiKey?: boolean
            apiKeyStoredInDatabase?: boolean
            envProvidesApiKey?: boolean
            serverCanReadDbSecrets?: boolean
            dashboardBilling?: {
              remainingUsd: number | null
              trialStartDate: string | null
              trialBudgetUsd: number | null
              trialDays: number | null
            } | null
          }
          setPineconeAssistantId(typeof j.assistantId === "string" ? j.assistantId : "")
          setPineconeMeta({
            hasApiKey: Boolean(j.hasApiKey),
            apiKeyStoredInDatabase: Boolean(j.apiKeyStoredInDatabase),
            envProvidesApiKey: Boolean(j.envProvidesApiKey),
            serverCanReadDbSecrets: Boolean(j.serverCanReadDbSecrets),
          })
          const b = j.dashboardBilling
          if (b) {
            setDashRemainingUsd(b.remainingUsd != null && Number.isFinite(b.remainingUsd) ? String(b.remainingUsd) : "")
            setDashTrialStart(b.trialStartDate?.trim() ?? "")
            if (b.trialBudgetUsd != null && Number.isFinite(b.trialBudgetUsd)) setDashTrialBudget(String(b.trialBudgetUsd))
            if (b.trialDays != null && Number.isFinite(b.trialDays)) setDashTrialDays(String(b.trialDays))
          }
        } else if (pineRes.status === 401 || pineRes.status === 403) {
          toast({ title: "تعذر تحميل إعدادات Pinecone", description: "غير مصرح", variant: "destructive" })
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "خطأ",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const upsertPath = async (key: string, path: string) => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("لا توجد جلسة")

    const { error } = await supabase.from("site_settings").upsert(
      {
        key,
        value: { path: path.trim() },
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" },
    )
    if (error) throw error
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertPath(KEYS.guidePdf, guidePath)
      await upsertPath(KEYS.amendmentPdf, amendmentPath)

      let remainingParsed: number | null = null
      if (dashRemainingUsd.trim() !== "") {
        const n = Number(dashRemainingUsd.trim().replace(",", "."))
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("الرصيد المتبقي: أدخل رقماً صالحاً أو اتركه فارغاً")
        }
        remainingParsed = n
      }
      const budgetParsed = Number(dashTrialBudget.trim().replace(",", "."))
      const daysParsed = Number(dashTrialDays.trim().replace(",", "."))
      if (!Number.isFinite(budgetParsed) || budgetParsed <= 0) {
        throw new Error("إجمالي رصيد التجربة بالدولار: رقم أكبر من صفر")
      }
      if (!Number.isFinite(daysParsed) || daysParsed <= 0) {
        throw new Error("مدة التجربة: عدد أيام صالح")
      }

      const pineBody: Record<string, unknown> = {
        assistantId: pineconeAssistantId.trim(),
        dashboardBilling: {
          remainingUsd: remainingParsed,
          trialStartDate: dashTrialStart.trim() === "" ? null : dashTrialStart.trim(),
          trialBudgetUsd: budgetParsed,
          trialDays: Math.floor(daysParsed),
        },
      }
      if (clearPineconeApiKey) {
        pineBody.clearPineconeApiKey = true
      } else if (pineconeApiKeyInput.trim()) {
        pineBody.pineconeApiKey = pineconeApiKeyInput.trim()
      }

      const pineRes = await fetch("/api/admin/pinecone-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pineBody),
      })
      const pineJson = (await pineRes.json().catch(() => ({}))) as { error?: string }
      if (!pineRes.ok) {
        throw new Error(pineJson.error || `Pinecone: HTTP ${pineRes.status}`)
      }

      setPineconeApiKeyInput("")
      setClearPineconeApiKey(false)
      const metaRes = await fetch("/api/admin/pinecone-settings", { credentials: "include" })
      if (metaRes.ok) {
        const j = (await metaRes.json()) as {
          assistantId?: string
          hasApiKey?: boolean
          apiKeyStoredInDatabase?: boolean
          envProvidesApiKey?: boolean
          serverCanReadDbSecrets?: boolean
          dashboardBilling?: {
            remainingUsd: number | null
            trialStartDate: string | null
            trialBudgetUsd: number | null
            trialDays: number | null
          } | null
        }
        setPineconeAssistantId(typeof j.assistantId === "string" ? j.assistantId : "")
        setPineconeMeta({
          hasApiKey: Boolean(j.hasApiKey),
          apiKeyStoredInDatabase: Boolean(j.apiKeyStoredInDatabase),
          envProvidesApiKey: Boolean(j.envProvidesApiKey),
          serverCanReadDbSecrets: Boolean(j.serverCanReadDbSecrets),
        })
        const b = j.dashboardBilling
        if (b) {
          setDashRemainingUsd(b.remainingUsd != null && Number.isFinite(b.remainingUsd) ? String(b.remainingUsd) : "")
          setDashTrialStart(b.trialStartDate?.trim() ?? "")
          if (b.trialBudgetUsd != null && Number.isFinite(b.trialBudgetUsd)) setDashTrialBudget(String(b.trialBudgetUsd))
          if (b.trialDays != null && Number.isFinite(b.trialDays)) setDashTrialDays(String(b.trialDays))
        }
      }

      toast({ title: "تم الحفظ", description: "تم تحديث الإعدادات في قاعدة البيانات." })
      router.refresh()
    } catch (e) {
      toast({
        title: "فشل الحفظ",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">جاري التحميل...</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">إعدادات الموقع</CardTitle>
        <p className="text-sm text-muted-foreground text-right">
          مسارات PDF وتكامل Pinecone. يُفضّل عدم وضع مفتاح Pinecone في المتغيرات على الإنتاج إن أمكن، واستخدام
          الحقول أدناه بعد ضبط Service Role في الخادم.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 max-w-2xl mr-auto">
        <div className="space-y-2 text-right">
          <Label htmlFor="guidePdf">مسار دليل الطالب</Label>
          <Input
            id="guidePdf"
            dir="ltr"
            className="text-left"
            value={guidePath}
            onChange={(e) => setGuidePath(e.target.value)}
          />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="amendmentPdf">مسار ملحق الدليل</Label>
          <Input
            id="amendmentPdf"
            dir="ltr"
            className="text-left"
            value={amendmentPath}
            onChange={(e) => setAmendmentPath(e.target.value)}
          />
        </div>

        <Separator />

        <div className="space-y-3 text-right">
          <h3 className="font-semibold text-slate-900">Pinecone (المساعد)</h3>
          {pineconeMeta && !pineconeMeta.serverCanReadDbSecrets && (
            <Alert variant="destructive" dir="rtl">
              <AlertTitle>الخادم لا يقرأ إعدادات القاعدة</AlertTitle>
              <AlertDescription>
                أضف <code className="rounded bg-black/10 px-1" dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> في{" "}
                <code className="rounded bg-black/10 px-1">.env.local</code> ثم أعد تشغيل{" "}
                <code className="rounded bg-black/10 px-1">npm run dev</code>. بدون ذلك لن يستخدم{" "}
                <code className="rounded bg-black/10 px-1">/api/chat</code> المفتاح المحفوظ من لوحة التحكم، ولن
                يتحدث المحادثة فور الحفظ.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">
            القيم المحفوظة هنا تتجاوز متغيرات البيئة عند التوفر. مفتاح API لا يُعرض بعد الحفظ؛ أدخل مفتاحاً
            جديداً فقط عند التغيير.
          </p>
          {pineconeMeta && (
            <p className="text-xs text-slate-600">
              حالة المفتاح:{" "}
              {pineconeMeta.hasApiKey
                ? "مهيأ (من قاعدة البيانات أو البيئة)"
                : "غير مهيأ — أضف مفتاحاً هنا أو في البيئة"}
              {pineconeMeta.apiKeyStoredInDatabase ? " · مخزّن في قاعدة البيانات" : ""}
              {pineconeMeta.envProvidesApiKey && !pineconeMeta.apiKeyStoredInDatabase ? " · من البيئة فقط" : ""}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="pineconeAssistantId">معرّف المساعد (Assistant ID)</Label>
            <Input
              id="pineconeAssistantId"
              dir="ltr"
              className="text-left font-mono text-sm"
              value={pineconeAssistantId}
              onChange={(e) => setPineconeAssistantId(e.target.value)}
              placeholder="مثال: asst_..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pineconeApiKey">مفتاح API (اختياري عند التحديث)</Label>
            <Input
              id="pineconeApiKey"
              type="password"
              dir="ltr"
              className="text-left font-mono text-sm"
              value={pineconeApiKeyInput}
              onChange={(e) => setPineconeApiKeyInput(e.target.value)}
              placeholder="اتركه فارغاً إن لم ترد تغيير المفتاح المحفوظ"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2 justify-end flex-row-reverse">
            <Checkbox
              id="clearPineconeKey"
              checked={clearPineconeApiKey}
              onCheckedChange={(v) => setClearPineconeApiKey(v === true)}
            />
            <Label htmlFor="clearPineconeKey" className="text-sm font-normal cursor-pointer">
              حذف المفتاح من قاعدة البيانات والاعتماد على البيئة فقط
            </Label>
          </div>

          <Separator className="my-4" />
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">رصيد ومدة التجربة (للداشبورد)</h4>
            <Alert dir="rtl" className="text-right bg-white/80 dark:bg-slate-950/60">
              <AlertTitle>ليست قراءة آلية من Pinecone</AlertTitle>
              <AlertDescription className="text-slate-700 dark:text-slate-300">
                مفتاح المشروع يشغّل المساعد فقط؛ واجهة Pinecone البرمجية{" "}
                <span className="font-medium">لا تعيد</span> رصيد الحساب أو المدة كما في الإعدادات → Billing. انسخ
                الأرقام التي تراها في{" "}
                <a
                  className="font-medium underline underline-offset-2"
                  href="https://app.pinecone.io"
                  target="_blank"
                  rel="noreferrer"
                >
                  app.pinecone.io
                </a>{" "}
                والصقها هنا ليطابق الداشبورد عرضك. أما <span className="font-mono text-xs" dir="ltr">usage</span>{" "}
                والتوكنات فتُجلب تلقائياً من ردود المحادثة وتُخزَّن في قاعدة البيانات.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="dashRemainingUsd">الرصيد المتبقي (بالدولار) — من لوحة Pinecone</Label>
              <Input
                id="dashRemainingUsd"
                dir="ltr"
                className="text-left font-mono text-sm"
                inputMode="decimal"
                value={dashRemainingUsd}
                onChange={(e) => setDashRemainingUsd(e.target.value)}
                placeholder="مثل: 287.5 — اتركه فارغاً ليُقدَّر من التوكنات"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashTrialStart">أول يوم للتجربة (لشريط الوقت)</Label>
              <Input
                id="dashTrialStart"
                type="date"
                dir="ltr"
                className="text-left font-mono text-sm"
                value={dashTrialStart}
                onChange={(e) => setDashTrialStart(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dashTrialBudget">إجمالي رصيد التجربة (بالدولار)</Label>
                <Input
                  id="dashTrialBudget"
                  dir="ltr"
                  className="text-left font-mono text-sm"
                  inputMode="decimal"
                  value={dashTrialBudget}
                  onChange={(e) => setDashTrialBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashTrialDays">مدة التجربة (أيام)</Label>
                <Input
                  id="dashTrialDays"
                  dir="ltr"
                  className="text-left font-mono text-sm"
                  inputMode="numeric"
                  value={dashTrialDays}
                  onChange={(e) => setDashTrialDays(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
