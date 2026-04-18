import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPineconeCreditsRemainingUsdOverride,
  getPineconeTrialCreditsUsd,
  getPineconeTrialDaysTotal,
  getPineconeTrialStartIso,
} from "@/lib/pinecone-trial-config"

/** مفتاح واحد في site_settings — لا يُخزَّن به مفتاح API. */
export const PINECONE_DASHBOARD_BILLING_KEY = "pinecone_dashboard_billing" as const

export type PineconeDashboardBillingStored = {
  /** ما يظهر لك في Pinecone كمتبقٍ من الرصيد / الميزانية (بالدولار)، لصق من الواجهة. */
  remainingUsd?: number | null
  /** أول يوم في التجربة كما تريد احتساب شريط الأيام */
  trialStartDate?: string | null
  /** مثل 300 */
  trialBudgetUsd?: number | null
  /** مثل 21 */
  trialDays?: number | null
}

export type ResolvedPineconeBilling = {
  remainingUsdOverride: number | null
  trialStartIso: string | null
  trialCreditsUsd: number
  trialDaysTotal: number
  /** من أين جاء الرصيد اليدوي */
  remainingSource: "database" | "env" | "none"
  /** من أين جاء تاريخ البداية */
  trialStartSource: "database" | "env" | "none"
  /** هل ميزانية أو مدة التجربة من حفظ الإعدادات */
  trialPlanFromDatabase: boolean
}

function readNestedValue(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && "value" in value && (value as { value: unknown }).value !== undefined) {
    const inner = (value as { value: unknown }).value
    if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as Record<string, unknown>
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

export function parseDashboardBillingRowValue(raw: unknown): PineconeDashboardBillingStored {
  const o = readNestedValue(raw)
  if (!o) return {}
  const remainingUsd =
    typeof o.remainingUsd === "number" && Number.isFinite(o.remainingUsd)
      ? Math.max(0, o.remainingUsd)
      : o.remainingUsd === null
        ? null
        : undefined
  const trialStartDate = typeof o.trialStartDate === "string" ? o.trialStartDate.trim() || null : o.trialStartDate === null ? null : undefined
  const trialBudgetUsd =
    typeof o.trialBudgetUsd === "number" && Number.isFinite(o.trialBudgetUsd) && o.trialBudgetUsd > 0
      ? o.trialBudgetUsd
      : undefined
  const trialDays =
    typeof o.trialDays === "number" && Number.isFinite(o.trialDays) && o.trialDays > 0
      ? Math.floor(o.trialDays)
      : undefined
  return { remainingUsd, trialStartDate: trialStartDate ?? undefined, trialBudgetUsd, trialDays }
}

/** YYYY-MM-DD → ISO آمن لـ differenceInCalendarDays (ظهر UTC). */
export function trialDateToIsoStart(trialStartDate: string | null | undefined): string | null {
  if (!trialStartDate || typeof trialStartDate !== "string") return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trialStartDate.trim())
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`
}

export async function resolvePineconeBillingForAdmin(supabase: SupabaseClient): Promise<ResolvedPineconeBilling> {
  const { data: row } = await supabase.from("site_settings").select("value").eq("key", PINECONE_DASHBOARD_BILLING_KEY).maybeSingle()

  const stored = parseDashboardBillingRowValue(row?.value)

  const envRemaining = getPineconeCreditsRemainingUsdOverride()
  const envTrialStart = getPineconeTrialStartIso()

  let remainingUsdOverride: number | null = null
  let remainingSource: ResolvedPineconeBilling["remainingSource"] = "none"
  if (typeof stored.remainingUsd === "number" && Number.isFinite(stored.remainingUsd)) {
    remainingUsdOverride = Math.max(0, stored.remainingUsd)
    remainingSource = "database"
  } else if (envRemaining !== null) {
    remainingUsdOverride = envRemaining
    remainingSource = "env"
  }

  let trialStartIso: string | null = null
  let trialStartSource: ResolvedPineconeBilling["trialStartSource"] = "none"
  const fromDbDate = trialDateToIsoStart(stored.trialStartDate ?? null)
  if (fromDbDate) {
    trialStartIso = fromDbDate
    trialStartSource = "database"
  } else if (envTrialStart) {
    trialStartIso = envTrialStart
    trialStartSource = "env"
  }

  const envCredits = getPineconeTrialCreditsUsd()
  const envDays = getPineconeTrialDaysTotal()

  let trialCreditsUsd = envCredits
  let trialDaysTotal = envDays
  let trialPlanFromDatabase = false

  if (stored.trialBudgetUsd != null && Number.isFinite(stored.trialBudgetUsd) && stored.trialBudgetUsd > 0) {
    trialCreditsUsd = stored.trialBudgetUsd
    trialPlanFromDatabase = true
  }
  if (stored.trialDays != null && Number.isFinite(stored.trialDays) && stored.trialDays > 0) {
    trialDaysTotal = Math.floor(stored.trialDays)
    trialPlanFromDatabase = true
  }

  return {
    remainingUsdOverride,
    trialStartIso,
    trialCreditsUsd,
    trialDaysTotal,
    remainingSource,
    trialStartSource,
    trialPlanFromDatabase,
  }
}
