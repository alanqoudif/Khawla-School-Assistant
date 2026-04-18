import { createServiceRoleClient } from "@/lib/supabase/service"
import { getSupabaseUrl } from "@/lib/supabase/env"

const SETTINGS_KEYS = {
  apiKey: "pinecone_api_key",
  assistantId: "pinecone_assistant_id",
} as const

function readValue(value: unknown): string {
  if (value && typeof value === "object" && "value" in value && typeof (value as { value: unknown }).value === "string") {
    return (value as { value: string }).value.trim()
  }
  return ""
}

let warnedMissingServiceRole = false

/** للتوافق مع مسار الحفظ؛ الإعدادات تُقرأ دائماً من دون كاش. */
export function invalidatePineconeCredentialsCache() {
  /* no-op */
}

/**
 * يقرأ من site_settings ثم يعود لمتغيرات البيئة.
 * يتطلب SUPABASE_SERVICE_ROLE_KEY على الخادم لقراءة قاعدة البيانات؛ بدونه تُستخدم البيئة فقط.
 */
export async function getPineconeCredentials(): Promise<{ apiKey: string | null; assistantId: string }> {
  const envKey = process.env.PINECONE_API_KEY?.trim() || null
  const envAssistant = (process.env.PINECONE_ASSISTANT_ID || "ad").trim() || "ad"

  const svc = createServiceRoleClient()
  if (!svc) {
    if (!warnedMissingServiceRole && getSupabaseUrl()) {
      warnedMissingServiceRole = true
      console.warn(
        "[pinecone] SUPABASE_SERVICE_ROLE_KEY غير مضبوط: لن تُقرأ إعدادات Pinecone من لوحة التحكم في /api/chat. أضف المفتاح في .env.local أو استخدم PINECONE_API_KEY في البيئة.",
      )
    }
    return { apiKey: envKey, assistantId: envAssistant }
  }

  const { data, error } = await svc.from("site_settings").select("key, value").in("key", [SETTINGS_KEYS.apiKey, SETTINGS_KEYS.assistantId])

  if (error) {
    console.error("[pinecone] فشل قراءة site_settings:", error.message)
    return { apiKey: envKey, assistantId: envAssistant }
  }

  let dbKey = ""
  let dbAssistant = ""
  for (const row of data ?? []) {
    if (row.key === SETTINGS_KEYS.apiKey) dbKey = readValue(row.value)
    if (row.key === SETTINGS_KEYS.assistantId) dbAssistant = readValue(row.value)
  }

  return {
    apiKey: dbKey || envKey,
    assistantId: (dbAssistant || envAssistant).trim() || "ad",
  }
}
