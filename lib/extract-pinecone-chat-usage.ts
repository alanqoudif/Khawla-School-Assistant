/** استخراج usage من رد assistant.chat حسب وثائق Pinecone. */

export type PineconeChatUsage = {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number
}

export function extractPineconeChatUsage(resp: unknown): PineconeChatUsage | null {
  if (!resp || typeof resp !== "object") return null
  const usage = (resp as { usage?: unknown }).usage
  if (!usage || typeof usage !== "object") return null
  const u = usage as Record<string, unknown>
  const prompt = u.prompt_tokens
  const completion = u.completion_tokens
  const total = u.total_tokens
  const p = typeof prompt === "number" && Number.isFinite(prompt) ? Math.max(0, Math.floor(prompt)) : null
  const c = typeof completion === "number" && Number.isFinite(completion) ? Math.max(0, Math.floor(completion)) : null
  let t = typeof total === "number" && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : null
  if (t === null && p !== null && c !== null) t = p + c
  if (t === null) return null
  return {
    prompt_tokens: p,
    completion_tokens: c,
    total_tokens: t,
  }
}
