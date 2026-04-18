import type { PostgrestError } from "@supabase/supabase-js"
import { excerpt, getExcerptMaxLength, shouldCaptureExcerpts } from "@/lib/chat-analytics"
import type { PineconeChatUsage } from "@/lib/extract-pinecone-chat-usage"
import { createServiceRoleClient } from "@/lib/supabase/service"

type LogChatAnalyticsParams = {
  sessionId: string
  userContent: string
  assistantContent: string | null
  ok: boolean
  latencyMs: number
  errorHint?: string | null
  /** من حقل usage في رد assistant.chat (Pinecone). */
  pineconeUsage?: PineconeChatUsage | null
}

type InsertPayload = {
  session_id: string
  user_excerpt: string | null
  assistant_excerpt: string | null
  user_message_length: number
  assistant_response_length: number
  pinecone_prompt_tokens: number | null
  pinecone_completion_tokens: number | null
  pinecone_total_tokens: number | null
  ok: boolean
  latency_ms: number
  error_hint: string | null
}

function buildPayload(params: LogChatAnalyticsParams, capture: boolean, maxLen: number): InsertPayload {
  return {
    session_id: params.sessionId,
    user_excerpt: capture ? excerpt(params.userContent, maxLen) : null,
    assistant_excerpt:
      capture && params.assistantContent ? excerpt(params.assistantContent, maxLen) : null,
    user_message_length: params.userContent.length,
    assistant_response_length: params.assistantContent?.length ?? 0,
    pinecone_prompt_tokens: params.pineconeUsage?.prompt_tokens ?? null,
    pinecone_completion_tokens: params.pineconeUsage?.completion_tokens ?? null,
    pinecone_total_tokens: params.pineconeUsage?.total_tokens ?? null,
    ok: params.ok,
    latency_ms: params.latencyMs,
    error_hint: params.errorHint ?? null,
  }
}

function isMissingPineconeColumnError(err: PostgrestError): boolean {
  const msg = (err.message ?? "").toLowerCase()
  const code = err.code ?? ""
  if (code === "PGRST204" && /pinecone/i.test(msg)) return true
  if (/could not find.*pinecone/i.test(msg)) return true
  if (code === "42703" && /pinecone/i.test(msg)) return true
  return false
}

function logInsertFailure(err: PostgrestError, phase: string): void {
  console.error(
    `[chat-analytics] insert failed (${phase}):`,
    err.message,
    err.code ?? "",
    err.details ?? "",
    err.hint ?? "",
  )
}

/**
 * ينتظر إتمام الإدراج في Supabase قبل متابعة الطلب.
 * يضمن ظهور السجل في قاعدة البيانات ولوحة الإدارة حتى في serverless.
 */
export async function logChatAnalytics(params: LogChatAnalyticsParams): Promise<void> {
  const svc = createServiceRoleClient()
  if (!svc) {
    console.error(
      "[chat-analytics] تخطّي التسجيل: اضبط SUPABASE_URL (أو NEXT_PUBLIC_SUPABASE_URL) و SUPABASE_SERVICE_ROLE_KEY على بيئة الخادم (مثل Vercel) حتى تُسجَّل أحداث المحادثة.",
    )
    return
  }

  const capture = shouldCaptureExcerpts()
  const maxLen = getExcerptMaxLength()
  const full = buildPayload(params, capture, maxLen)

  let { error } = await svc.from("chat_analytics_events").insert(full)

  if (error && isMissingPineconeColumnError(error)) {
    logInsertFailure(error, "with pinecone columns — retrying without")
    const rest = {
      session_id: full.session_id,
      user_excerpt: full.user_excerpt,
      assistant_excerpt: full.assistant_excerpt,
      user_message_length: full.user_message_length,
      assistant_response_length: full.assistant_response_length,
      ok: full.ok,
      latency_ms: full.latency_ms,
      error_hint: full.error_hint,
    }
    const retry = await svc.from("chat_analytics_events").insert(rest)
    error = retry.error
  }

  if (error) {
    logInsertFailure(error, "final")
  }
}
