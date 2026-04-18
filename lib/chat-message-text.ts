/**
 * يستخرج نص رسالة المستخدم من صيغة السلسلة أو مصفوفة أجزاء (مثل واجهات نماذج متعددة).
 */
export function extractUserMessageText(content: unknown): string {
  if (typeof content === "string") return content
  if (content == null) return ""
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const part of content) {
      if (typeof part === "string") {
        if (part) parts.push(part)
        continue
      }
      if (part && typeof part === "object" && "text" in part) {
        const t = (part as { text?: unknown }).text
        if (typeof t === "string" && t) parts.push(t)
      }
    }
    return parts.join("\n")
  }
  return String(content)
}
