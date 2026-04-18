import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AdminChatTotals } from "@/lib/pinecone-dashboard-stats"

function fmtM(n: number) {
  return new Intl.NumberFormat("ar-OM", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n)
}

export function AnalyticsSummaryCards({
  days,
  totals,
  horizonDays,
  projection,
}: {
  days: number
  totals: AdminChatTotals
  horizonDays: number
  projection: { projectedMessages: number; projectedTokensMillions: number } | null
}) {
  const tokensMidM = totals.estTotalTokens / 1_000_000
  const tokensLowM = tokensMidM * 0.75
  const tokensHighM = tokensMidM * 1.25

  const monthsLabel =
    horizonDays >= 120 && horizonDays <= 125 ? "أربعة أشهر تقريباً" : `${horizonDays} يوماً`

  const coveragePct =
    totals.eventCount > 0 ? Math.round((100 * totals.eventsWithPinecone) / totals.eventCount) : 0
  const preferPinecone = coveragePct >= 50

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-right">عدد الرسائل ({days} يوماً)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-right tabular-nums">
            {new Intl.NumberFormat("ar-OM").format(totals.eventCount)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-right">
            {preferPinecone ? "التوكنات (معظمها من Pinecone)" : "التوكنات (مزيج تقدير + Pinecone)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl font-bold text-right tabular-nums">{fmtM(tokensMidM)} مليون</p>
          <p className="text-xs text-muted-foreground text-right">
            تغطية <span className="font-mono" dir="ltr">usage</span>: {coveragePct}٪ من الأحداث
          </p>
          <p className="text-xs text-muted-foreground text-right" dir="ltr">
            نطاق تقريبي ±25%: {fmtM(tokensLowM)} – {fmtM(tokensHighM)} مليون توكن
          </p>
        </CardContent>
      </Card>
      <Card className="sm:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-right">توقع على {monthsLabel}</CardTitle>
          <p className="text-xs text-muted-foreground text-right font-normal">
            بافتراض استمرار نفس الوتيرة خلال آخر {days} يوماً
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {projection ? (
            <>
              <p className="text-right text-lg font-semibold">
                رسائل ≈{" "}
                <span className="tabular-nums">{new Intl.NumberFormat("ar-OM").format(projection.projectedMessages)}</span>
              </p>
              <p className="text-right text-slate-700">
                توكنات ≈{" "}
                <span className="tabular-nums font-medium">{fmtM(projection.projectedTokensMillions)}</span> مليون
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-right">لا توجد بيانات كافية في الفترة</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
