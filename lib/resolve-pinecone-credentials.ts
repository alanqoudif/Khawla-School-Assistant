import { PINECONE_SETTINGS_KEYS } from "@/lib/pinecone-settings-keys"
import { createServiceRoleClient } from "@/lib/supabase/service"

type Cached = { apiKey: string | null; assistantId: string; at: number }
let cache: Cached | null = null
const TTL_MS = 60_000

function parseStoredApiKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const o = value as Record<string, unknown>
  const secret = o.secret
  if (typeof secret === "string" && secret.trim()) return secret.trim()
  const v = o.value
  if (typeof v === "string" && v.trim()) return v.trim()
  return null
}

function parseStoredAssistantId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const o = value as Record<string, unknown>
  const id = o.assistant_id ?? o.id
  if (typeof id === "string" && id.trim()) return id.trim()
  return null
}

/** DB values override env when present (non-empty). Cached briefly to limit reads per instance. */
export async function resolvePineconeCredentials(): Promise<{ apiKey: string | null; assistantId: string }> {
  const envApi = process.env.PINECONE_API_KEY?.trim() || null
  const envAssistant = process.env.PINECONE_ASSISTANT_ID?.trim() || ""

  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    return { apiKey: cache.apiKey, assistantId: cache.assistantId }
  }

  let fromDbApi: string | null = null
  let fromDbAssistant: string | null = null

  const svc = createServiceRoleClient()
  if (svc) {
    const { data, error } = await svc
      .from("site_settings")
      .select("key, value")
      .in("key", [PINECONE_SETTINGS_KEYS.apiKey, PINECONE_SETTINGS_KEYS.assistantId])

    if (error) {
      console.error("[pinecone-settings]", error.message)
    } else {
      for (const row of data ?? []) {
        if (row.key === PINECONE_SETTINGS_KEYS.apiKey) {
          fromDbApi = parseStoredApiKey(row.value)
        }
        if (row.key === PINECONE_SETTINGS_KEYS.assistantId) {
          fromDbAssistant = parseStoredAssistantId(row.value)
        }
      }
    }
  }

  const apiKey = fromDbApi ?? envApi
  const assistantId = fromDbAssistant ?? envAssistant

  cache = { apiKey, assistantId, at: now }

  return { apiKey, assistantId }
}
