import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchAdminChatTotals, projectUsageForHorizon } from "@/lib/pinecone-dashboard-stats"
import { getPineconeProjectionHorizonDays } from "@/lib/pinecone-trial-config"
import { createClient } from "@/lib/supabase/server"
import { AnalyticsSummaryCards } from "./analytics-summary"
import { AnalyticsTable, type AnalyticsRow } from "./analytics-table"

type PageProps = {
  searchParams: Promise<{ days?: string }>
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const days = Math.min(90, Math.max(1, Number(sp.days ?? 7) || 7))
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const [totalsAgg, { data, error }] = await Promise.all([
    fetchAdminChatTotals(supabase, from),
    supabase
      .from("chat_analytics_events")
      .select(
        "id, created_at, session_id, user_excerpt, assistant_excerpt, user_message_length, assistant_response_length, ok, latency_ms, error_hint",
      )
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  const horizonDays = getPineconeProjectionHorizonDays()
  const projection = projectUsageForHorizon(totalsAgg, days, horizonDays)

  const rows: AnalyticsRow[] = (data ?? []) as AnalyticsRow[]

  const aggregatesMissing = rows.length > 0 && totalsAgg.eventCount === 0

  return (
    <div className="space-y-4">
      {aggregatesMissing ? (
        <Alert variant="destructive" dir="rtl">
          <AlertTitle>تعذّر حساب الإجماليات</AlertTitle>
          <AlertDescription>
            يوجد أسطر في الجدول لكن المجموع صفر — تحقق من صلاحيات الإدارة على الجدول أو من اتصال Supabase. يُفضّل أيضاً
            تطبيق ترحيل{" "}
            <code className="rounded bg-black/10 px-1" dir="ltr">
              admin_chat_analytics_totals
            </code>{" "}
            لسرعة أفضل (تجميع في قاعدة البيانات بدل قراءة كل الصفوف).
          </AlertDescription>
        </Alert>
      ) : null}
      <AnalyticsSummaryCards
        days={days}
        totals={totalsAgg}
        horizonDays={horizonDays}
        projection={projection}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-right">إحصائيات المحادثة</CardTitle>
          <p className="text-sm text-muted-foreground text-right">
            عرض آخر 500 حدثاً خلال {days} يوماً {error ? `(خطأ: ${error.message})` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-right mb-4">
            غيّر المدة عبر الاستعلام:{" "}
            <code className="bg-slate-100 px-1 rounded" dir="ltr">
              ?days=14
            </code>
          </p>
          <AnalyticsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
