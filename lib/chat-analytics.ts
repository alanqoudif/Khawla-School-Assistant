/** حد افتراضي لحفظ نص السؤال والجواب في الإحصائيات (قابل للزيادة عبر البيئة). */
const DEFAULT_EXCERPT_LEN = 50_000

/** سقف أمان لتفادي صفوف ضخمة جداً في قاعدة البيانات. */
const MAX_EXCERPT_LEN = 500_000

export function excerpt(text: string | null | undefined, maxLen: number): string | null {
  if (!text || !text.trim()) return null
  const t = text.trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen)
}

/** الالتقاط من الخادم مفعّل افتراضياً لعرض المحتوى في لوحة الإدارة. عطّله بـ ANALYTICS_CAPTURE_EXCERPT=false */
export function shouldCaptureExcerpts(): boolean {
  if (process.env.ANALYTICS_CAPTURE_EXCERPT === "false") return false
  if (process.env.NEXT_PUBLIC_ANALYTICS_CAPTURE_EXCERPT === "false") return false
  return true
}

export function getExcerptMaxLength(): number {
  const raw =
    process.env.ANALYTICS_EXCERPT_MAX_LEN ?? process.env.NEXT_PUBLIC_ANALYTICS_EXCERPT_MAX_LEN ?? DEFAULT_EXCERPT_LEN
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_EXCERPT_LEN) : DEFAULT_EXCERPT_LEN
}

export function parseSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRe.test(s) ? s : null
}
