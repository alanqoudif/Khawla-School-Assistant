import { PineconeQuotaCard } from "@/components/admin/pinecone-quota-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolvePineconeBillingForAdmin } from "@/lib/pinecone-billing-settings"
import { buildPineconeBudgetCardModel, fetchAdminChatTotals } from "@/lib/pinecone-dashboard-stats"
import { createClient } from "@/lib/supabase/server"

export default async function AdminHomePage() {
  const supabase = await createClient()

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const billing = await resolvePineconeBillingForAdmin(supabase)
  const trialStartIso = billing.trialStartIso
  const spendWindowStartIso = trialStartIso
    ? trialStartIso
    : new Date(Date.now() - billing.trialDaysTotal * 24 * 60 * 60 * 1000).toISOString()
  const spendTotals = await fetchAdminChatTotals(supabase, spendWindowStartIso)
  const pineconeBudget = buildPineconeBudgetCardModel(spendTotals, billing)

  const [
    { count: events24h },
    { count: events7d },
    { count: ok7d },
    { count: fail7d },
    { data: publishedGuide },
  ] = await Promise.all([
    supabase.from("chat_analytics_events").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("chat_analytics_events").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase
      .from("chat_analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("ok", true)
      .gte("created_at", weekAgo),
    supabase
      .from("chat_analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("ok", false)
      .gte("created_at", weekAgo),
    supabase.from("guide_snapshots").select("updated_at").eq("is_published", true).limit(1).maybeSingle(),
  ])

  const totalWeek = (ok7d ?? 0) + (fail7d ?? 0)
  const successRate =
    totalWeek > 0 ? Math.round(((ok7d ?? 0) / totalWeek) * 100) : null

  return (
    <div className="space-y-6">
      <p className="text-right text-slate-600">
        نظرة سريعة على النشاط ومحتوى الدليل. إجابات المساعد الذكي ما زالت تُخدم من Pinecone حسب الإعداد الحالي.
      </p>
      <PineconeQuotaCard model={pineconeBudget} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-right">أحداث المحادثة (24 ساعة)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-right">{events24h ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-right">أحداث المحادثة (7 أيام)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-right">{events7d ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-right">نسبة النجاح (7 أيام)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-right">
              {successRate === null ? "—" : `${successRate}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-right">آخر تحديث للدليل</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-right text-slate-700">
              {publishedGuide?.updated_at
                ? new Date(publishedGuide.updated_at).toLocaleString("ar-OM")
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
