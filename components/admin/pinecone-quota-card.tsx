"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PineconeBudgetCardModel } from "@/lib/pinecone-dashboard-stats"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n)
}

function fmtMillions(n: number) {
  return new Intl.NumberFormat("ar-OM", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n)
}

function BarRow({
  label,
  ratioRemaining,
  leftLine,
  subLine,
  urgent,
}: {
  label: string
  ratioRemaining: number
  leftLine: string
  subLine?: string
  urgent: boolean
}) {
  const r = Math.min(1, Math.max(0, ratioRemaining))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-right" dir="ltr">
          {leftLine}
        </span>
      </div>
      <div
        className={cn(
          "h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800",
          urgent && "ring-2 ring-amber-400/80",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            urgent ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${r * 100}%` }}
        />
      </div>
      {subLine ? <p className="text-xs text-muted-foreground text-right">{subLine}</p> : null}
    </div>
  )
}

export function PineconeQuotaCard({ model }: { model: PineconeBudgetCardModel }) {
  const timeUrgent = model.trialConfigured && model.daysLeft <= 3
  const creditUrgent = model.creditsProgressUsed >= 0.85

  return (
    <Card
      className={cn(
        model.showUrgentWarning &&
          "border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-300/60",
      )}
    >
      <CardHeader>
        <CardTitle className="text-right">رصيد Pinecone</CardTitle>
        <p className="text-sm text-muted-foreground text-right leading-relaxed">
          البيانات تُحمَّل من الخادم عند كل فتح للصفحة.{" "}
          <span className="font-medium text-foreground">التوكنات:</span> من ردود Pinecone الفعلية.{" "}
          <span className="font-medium text-foreground">الدولار والأيام:</span> إما من حقول «رصيد ومدة التجربة» في
          الإعدادات (نسخ يدوي من app.pinecone.io) أو من البيئة — مفتاح API لا يقرأ رصيد الحساب آلياً.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {model.showUrgentWarning ? (
          <Alert variant="destructive" dir="rtl" className="border-amber-600 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">اقترب نفاد رصيد أو انتهاء المدة</AlertTitle>
            <AlertDescription className="text-amber-950/90">
              الرصيد أو الوقت ضيق. حدّث «الرصيد المتبقي» في الإعدادات من لوحة Pinecone، أو راقب{" "}
              <span className="font-mono text-xs" dir="ltr">
                app.pinecone.io
              </span>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border bg-slate-50/80 p-4 dark:bg-slate-950/40">
            <h3 className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">Credits</h3>
            <BarRow
              label="المتبقي من الميزانية"
              ratioRemaining={1 - model.creditsProgressUsed}
              leftLine={`${fmtUsd(model.creditsUsedUsd)} / ${fmtUsd(model.trialCreditsUsd)}`}
              subLine={
                model.billing.remainingSource === "database"
                  ? `المتبقي المعروض: ${fmtUsd(model.creditsRemainingUsd)} (من حقل الإعدادات)`
                  : model.billing.remainingSource === "env"
                    ? `المتبقي: ${fmtUsd(model.creditsRemainingUsd)} (من البيئة)`
                    : `تقدير من التوكنات — المتبقي المعروض: ${fmtUsd(model.creditsRemainingUsd)}`
              }
              urgent={creditUrgent}
            />
            <Alert dir="rtl" className="bg-white/90 text-right dark:bg-slate-950/70">
              <AlertTitle className="text-sm">استهلاك التوكنات</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {model.usageAccountingNote}
              </AlertDescription>
            </Alert>
            <Alert dir="rtl" className="bg-white/90 text-right dark:bg-slate-950/70">
              <AlertTitle className="text-sm">الرصيد بالدولار</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {model.balanceAccountingNote}
              </AlertDescription>
            </Alert>
          </div>
          <div className="space-y-4 rounded-lg border bg-slate-50/80 p-4 dark:bg-slate-950/40">
            <h3 className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">Time</h3>
            {model.trialConfigured ? (
              <BarRow
                label="الأيام المتبقية في التجربة"
                ratioRemaining={model.trialDaysTotal > 0 ? model.daysLeft / model.trialDaysTotal : 0}
                leftLine={`${model.daysLeft} / ${model.trialDaysTotal} يوماً`}
                subLine={`مضى من المدة: ${model.daysElapsed} يوماً`}
                urgent={timeUrgent}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-right">
                غير مفعّل — عيّن تاريخ البداية في الإعدادات (قسم «رصيد ومدة التجربة») أو{" "}
                <code className="rounded bg-black/10 px-1" dir="ltr">
                  PINECONE_TRIAL_START_ISO
                </code>{" "}
                في البيئة.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-dashed p-4 text-right text-sm leading-relaxed">
          <p>
            <span className="font-medium">مجموع التوكنات (نافذة العداد): </span>
            <span dir="ltr" className="tabular-nums">
              {new Intl.NumberFormat("ar-OM").format(model.tokensUsedEstimate)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            أحداث ضمنها <span className="font-medium text-foreground">{Math.round(model.pineconeUsageCoverage * 100)}٪</span>{" "}
            تحتوي <span className="font-mono text-[10px]" dir="ltr">usage</span> من Pinecone؛ الباقي يُقدَّر من
            أطوال النصوص إن وُجد.
          </p>
          <p className="mt-2 text-muted-foreground">
            تقريباً{" "}
            <span dir="ltr" className="font-medium text-foreground">
              {fmtMillions(model.approxTokensForTrialBudget / 1_000_000)}
            </span>{" "}
            مليون توكن تُعادل ميزانية {fmtUsd(model.trialCreditsUsd)} عند معدل مختلط{" "}
            <span dir="ltr">{fmtUsd(model.usdPerMillionTokensBlend)}</span> لكل مليون توكن (اضبط{" "}
            <code className="rounded bg-black/10 px-1" dir="ltr">
              PINECONE_BLEND_USD_PER_M_TOKENS
            </code>
            ).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
