/**
 * تقديرات تقريبية للاستخدام — لا يوجد لدينا أرقام التوكن من Pinecone مباشرة.
 * يمكن ضبط المعاملات عبر متغيرات البيئة.
 */

function numEnv(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === "") return fallback
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** متوسط حرف لكل توكن للنص العربي/المختلط (تقريب). */
export function charsPerToken(): number {
  return numEnv("PINECONE_CHARS_PER_TOKEN", 3)
}

/** يضرب في مدخل المستخدم لتقريب الريتريفر + السياق + تعليمات النظام مقارنة بطول رسالة المستخدم فقط. */
export function promptExpansionMultiplier(): number {
  return numEnv("PINECONE_PROMPT_EXPANSION", 4)
}

/** تكلفة بالدولار لكل مليون توكن (مدمج مدخل/مخرج) — تقدير للعرض مع رصيد الـ credits. */
export function blendedUsdPerMillionTokens(): number {
  return numEnv("PINECONE_BLEND_USD_PER_M_TOKENS", 18)
}

export type TurnTokenEstimate = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export function estimateTurnTokens(userLen: number, assistantLen: number): TurnTokenEstimate {
  const cpt = charsPerToken()
  const mult = promptExpansionMultiplier()
  const inputTokens = Math.ceil(((userLen || 0) / cpt) * mult)
  const outputTokens = Math.ceil((assistantLen || 0) / cpt)
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

export function estimateUsdFromTotalTokens(totalTokens: number): number {
  const perM = blendedUsdPerMillionTokens()
  return (totalTokens / 1_000_000) * perM
}

/** عند عدم توفر تجميع SQL (صفّ بصف). تقل دقة مقارنةً بمجموع ceil لكل حدث. */
export function fallbackEstimateTotalTokensFromSums(sumUserLen: number, sumAssistantLen: number): number {
  const cpt = charsPerToken()
  const mult = promptExpansionMultiplier()
  return Math.ceil(((sumUserLen || 0) / cpt) * mult + (sumAssistantLen || 0) / cpt)
}

export function sumTurnEstimates(rows: { user_message_length: number | null; assistant_response_length: number | null }[]): {
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedUsd: number
} {
  let totalInput = 0
  let totalOutput = 0
  for (const r of rows) {
    const u = r.user_message_length ?? 0
    const a = r.assistant_response_length ?? 0
    const e = estimateTurnTokens(u, a)
    totalInput += e.inputTokens
    totalOutput += e.outputTokens
  }
  const totalTokens = totalInput + totalOutput
  return {
    totalTokens,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estimatedUsd: estimateUsdFromTotalTokens(totalTokens),
  }
}

/** توكن تقريبي يعادل مبلغاً بالدولار عند نفس المعدل المختلط (لشرح "كم توكن ≈ 300 دولار"). */
export function approximateTokensForUsd(usd: number): number {
  const perM = blendedUsdPerMillionTokens()
  if (perM <= 0) return 0
  return Math.round((usd / perM) * 1_000_000)
}
