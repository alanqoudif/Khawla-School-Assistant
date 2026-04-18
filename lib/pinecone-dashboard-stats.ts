import { differenceInCalendarDays } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approximateTokensForUsd,
  blendedUsdPerMillionTokens,
  estimateTurnTokens,
  estimateUsdFromTotalTokens,
  fallbackEstimateTotalTokensFromSums,
} from "./pinecone-usage-estimate"
import type { ResolvedPineconeBilling } from "./pinecone-billing-settings"

export type AdminChatTotals = {
  eventCount: number
  sumUserLen: number
  sumAssistantLen: number
  /** أحداث فيها total_tokens من رد Pinecone */
  eventsWithPinecone: number
  /** تفضيل total_tokens من Pinecone؛ وإلا تقدير من الأطوال */
  estTotalTokens: number
}

/** PostgREST قد يعيد bigint كنص أو رقم. */
function rpcBigintToNumber(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "bigint") return Number(v)
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parseRpcRow(raw: unknown): AdminChatTotals | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!("event_count" in r)) return null
  const eventCount = rpcBigintToNumber(r.event_count)
  const sumUser = rpcBigintToNumber(r.sum_user_len)
  const sumAsst = rpcBigintToNumber(r.sum_assistant_len)
  const estTok = rpcBigintToNumber(r.est_total_tokens)
  const withPc = rpcBigintToNumber(r.events_with_pinecone)
  return {
    eventCount,
    sumUserLen: sumUser,
    sumAssistantLen: sumAsst,
    eventsWithPinecone: withPc,
    estTotalTokens:
      Object.prototype.hasOwnProperty.call(r, "est_total_tokens") && r.est_total_tokens != null
        ? estTok
        : fallbackEstimateTotalTokensFromSums(sumUser, sumAsst),
  }
}

const ZERO_TOTALS: AdminChatTotals = {
  eventCount: 0,
  sumUserLen: 0,
  sumAssistantLen: 0,
  eventsWithPinecone: 0,
  estTotalTokens: 0,
}

const FALLBACK_PAGE_SIZE = 800

/**
 * عند غياب الدالة أو فشلها: تجميع عبر الصفوف (نفس منطق التوكن لكل صف تقريباً كـ SQL).
 * إن لم تُضف أعمدة pinecone بعد يُراعى تلقائياً.
 */
async function fetchAdminChatTotalsChunkedFallback(
  supabase: SupabaseClient,
  fromIso: string,
): Promise<AdminChatTotals | null> {
  let mode: "with_pinecone" | "length_only" = "with_pinecone"
  let eventCount = 0
  let sumUser = 0
  let sumAsst = 0
  let eventsWithPinecone = 0
  let estTotalTokens = 0
  let offset = 0

  for (let guard = 0; guard < 10000; guard++) {
    const sel =
      mode === "with_pinecone"
        ? "user_message_length, assistant_response_length, pinecone_total_tokens"
        : "user_message_length, assistant_response_length"

    const { data, error } = await supabase
      .from("chat_analytics_events")
      .select(sel)
      .gte("created_at", fromIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + FALLBACK_PAGE_SIZE - 1)

    if (error) {
      const msg = (error.message ?? "").toLowerCase()
      if (mode === "with_pinecone" && (msg.includes("pinecone") || msg.includes("column") || error.code === "42703")) {
        mode = "length_only"
        offset = 0
        eventCount = 0
        sumUser = 0
        sumAsst = 0
        eventsWithPinecone = 0
        estTotalTokens = 0
        continue
      }
      console.warn("[chat_analytics fallback]", error.message)
      return null
    }

    const rows = (data ?? []) as unknown as Array<{
      user_message_length: number | null
      assistant_response_length: number | null
      pinecone_total_tokens?: number | null
    }>

    if (rows.length === 0) break

    for (const row of rows) {
      eventCount++
      const u = row.user_message_length ?? 0
      const a = row.assistant_response_length ?? 0
      sumUser += u
      sumAsst += a
      if (
        mode === "with_pinecone" &&
        row.pinecone_total_tokens != null &&
        Number.isFinite(row.pinecone_total_tokens as number)
      ) {
        eventsWithPinecone++
        estTotalTokens += Math.max(0, Math.floor(row.pinecone_total_tokens as number))
      } else {
        estTotalTokens += estimateTurnTokens(u, a).totalTokens
      }
    }

    if (rows.length < FALLBACK_PAGE_SIZE) break
    offset += FALLBACK_PAGE_SIZE
  }

  return {
    eventCount,
    sumUserLen: sumUser,
    sumAssistantLen: sumAsst,
    eventsWithPinecone,
    estTotalTokens,
  }
}

/** يفضّل دالة SQL؛ وإلا تجميع احتياطي بدون الحاجة لترحيل الدالة. */
export async function fetchAdminChatTotals(supabase: SupabaseClient, fromIso: string): Promise<AdminChatTotals> {
  const { data, error } = await supabase.rpc("admin_chat_analytics_totals", { p_from: fromIso })
  if (!error && data != null) {
    const first = Array.isArray(data) ? data[0] : data
    const parsed = parseRpcRow(first)
    if (parsed) return parsed
  }
  console.warn(
    "[admin_chat_analytics_totals]",
    error?.message ?? "استجابة غير متوقعة — جارٍ التجميع الاحتياطي",
  )
  const fb = await fetchAdminChatTotalsChunkedFallback(supabase, fromIso)
  return fb ?? ZERO_TOTALS
}

export type PineconeBudgetCardModel = {
  trialConfigured: boolean
  trialStartIso: string | null
  trialDaysTotal: number
  trialCreditsUsd: number
  daysElapsed: number
  daysLeft: number
  timeProgressUsed: number
  creditsUsedUsd: number
  creditsRemainingUsd: number
  creditsProgressUsed: number
  tokensUsedEstimate: number
  usdPerMillionTokensBlend: number
  approxTokensForTrialBudget: number
  showUrgentWarning: boolean
  /** نسبة الأحداث التي فيها usage من Pinecone */
  pineconeUsageCoverage: number
  /** شرح مصدر أرقام التوكنات */
  usageAccountingNote: string
  /** شرح مصدر الرصيد بالدولار (لا يُجلب من Pinecone بالـ API) */
  balanceAccountingNote: string
  billing: ResolvedPineconeBilling
}

export function projectUsageForHorizon(
  totals: AdminChatTotals,
  periodDays: number,
  horizonDays: number,
): { projectedMessages: number; projectedTokensMillions: number } | null {
  if (periodDays <= 0 || totals.eventCount <= 0) return null
  const dailyEvents = totals.eventCount / periodDays
  const dailyTokens = totals.estTotalTokens / periodDays
  return {
    projectedMessages: Math.max(0, Math.round(dailyEvents * horizonDays)),
    projectedTokensMillions: Math.max(0, (dailyTokens * horizonDays) / 1_000_000),
  }
}

export function buildPineconeBudgetCardModel(
  sinceTrialTotals: AdminChatTotals,
  billing: ResolvedPineconeBilling,
): PineconeBudgetCardModel {
  const trialStartIso = billing.trialStartIso
  const trialDaysTotal = billing.trialDaysTotal
  const trialCreditsUsd = billing.trialCreditsUsd
  const overrideRemaining = billing.remainingUsdOverride
  const blend = blendedUsdPerMillionTokens()
  const approxBudgetTokens = approximateTokensForUsd(trialCreditsUsd)

  const now = new Date()
  let daysElapsed = 0
  let daysLeft = trialDaysTotal
  let trialConfigured = false

  if (trialStartIso) {
    trialConfigured = true
    const start = new Date(trialStartIso)
    if (!Number.isNaN(start.getTime())) {
      const elapsed = differenceInCalendarDays(now, start)
      daysElapsed = Math.min(Math.max(0, elapsed), trialDaysTotal)
      daysLeft = Math.max(0, trialDaysTotal - daysElapsed)
    }
  }

  const timeProgressUsed = trialDaysTotal > 0 ? daysElapsed / trialDaysTotal : 0

  const tokensUsedEstimate = sinceTrialTotals.estTotalTokens
  const estimatedSpendUsd = estimateUsdFromTotalTokens(tokensUsedEstimate)

  const pineconeUsageCoverage =
    sinceTrialTotals.eventCount > 0 ? sinceTrialTotals.eventsWithPinecone / sinceTrialTotals.eventCount : 0

  let creditsRemainingUsd: number
  let creditsUsedUsd: number

  if (overrideRemaining !== null) {
    creditsRemainingUsd = Math.min(trialCreditsUsd, Math.max(0, overrideRemaining))
    creditsUsedUsd = Math.max(0, trialCreditsUsd - creditsRemainingUsd)
  } else {
    creditsUsedUsd = Math.min(trialCreditsUsd, Math.max(0, estimatedSpendUsd))
    creditsRemainingUsd = Math.max(0, trialCreditsUsd - creditsUsedUsd)
  }

  const creditsProgressUsed = trialCreditsUsd > 0 ? creditsUsedUsd / trialCreditsUsd : 0

  const lowCredits = creditsProgressUsed >= 0.85
  const lowTime = trialConfigured && daysLeft <= 3
  const showUrgentWarning = trialConfigured && (lowCredits || lowTime)

  const usageAccountingNote =
    pineconeUsageCoverage >= 0.85
      ? "استهلاك التوكنات حقيقي من حقل usage في ردود Pinecone؛ أي صف قديم بلا usage يُكمَّل بتقدير من طول النصوص."
      : pineconeUsageCoverage > 0
        ? "جزء من الأحداث بلا usage في الرد — غالباً قبل ترحيل القاعدة أو ردّ استثنائي؛ يُكمَّل بالتقدير."
        : sinceTrialTotals.eventCount === 0
          ? "لا توجد أحداث محادثة بعد في نافذة العداد — أو لم يُجرَ ترحيل أعمدة usage بعد."
          : "لم يُخزَّن حقل usage بعد لهذه الأحداث. تأكد من ترحيل قاعدة البيانات ثم نفِّذ محادثة تجريبية من الواجهة."

  const balanceAccountingNote =
    billing.remainingSource !== "none"
      ? billing.remainingSource === "database"
        ? "الرصيد بالدولار: من حقل «الرصيد المتبقي» في إعدادات المساعد (لصق من لوحة Pinecone). مفتاح API لا يعيد رصيد الحساب آلياً."
        : "الرصيد بالدولار: من متغير البيئة PINECONE_CREDITS_REMAINING_USD. مفتاح المشروع لا يوفّر قراءة الرصيد من واجهة Pinecone البرمجية."
      : "الرصيد بالدولار هنا تقدير من التوكنات — ليطابق ما تراه في Pinecone أضف الرقم في إعدادات المساعد أدناه (نسخ يدوي). لا يوجد API عام لنفس رصيد Console بمفتاح المشروع."

  return {
    trialConfigured,
    trialStartIso,
    trialDaysTotal,
    trialCreditsUsd,
    daysElapsed,
    daysLeft,
    timeProgressUsed,
    creditsUsedUsd,
    creditsRemainingUsd,
    creditsProgressUsed,
    tokensUsedEstimate,
    usdPerMillionTokensBlend: blend,
    approxTokensForTrialBudget: approxBudgetTokens,
    showUrgentWarning,
    pineconeUsageCoverage,
    usageAccountingNote,
    balanceAccountingNote,
    billing,
  }
}
