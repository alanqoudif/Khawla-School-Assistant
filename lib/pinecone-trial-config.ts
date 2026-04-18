/** إعدادات التجربة / الرصيد — من البيئة (لا تُعرض للمستخدم النهائي). */

export function getPineconeTrialStartIso(): string | null {
  const s = process.env.PINECONE_TRIAL_START_ISO?.trim()
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? s : null
}

export function getPineconeTrialDaysTotal(): number {
  const n = Number(process.env.PINECONE_TRIAL_DAYS_TOTAL ?? 21)
  return Number.isFinite(n) && n > 0 ? n : 21
}

export function getPineconeTrialCreditsUsd(): number {
  const n = Number(process.env.PINECONE_TRIAL_CREDITS_USD ?? 300)
  return Number.isFinite(n) && n > 0 ? n : 300
}

/** إن وُجد، يُستخدم كرصيد متبقٍ (من لوحة Pinecone) بدل التقدير من الإحصائيات. */
export function getPineconeCreditsRemainingUsdOverride(): number | null {
  const s = process.env.PINECONE_CREDITS_REMAINING_USD?.trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** عدد الأيام في التوقع الطويل (مثلاً 4 أشهر). */
export function getPineconeProjectionHorizonDays(): number {
  const n = Number(process.env.PINECONE_PROJECTION_DAYS ?? 122)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 122
}
