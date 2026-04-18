import { randomUUID } from "crypto"
import { type NextRequest, NextResponse } from "next/server"
import { Pinecone } from "@pinecone-database/pinecone"
import { parseSessionId } from "@/lib/chat-analytics"
import { extractUserMessageText } from "@/lib/chat-message-text"
import { extractPineconeChatUsage, type PineconeChatUsage } from "@/lib/extract-pinecone-chat-usage"
import { logChatAnalytics } from "@/lib/log-chat-analytics"
import { getPineconeCredentials } from "@/lib/pinecone-credentials"
import { getSupabaseUrl } from "@/lib/supabase/env"

export async function POST(req: NextRequest) {
  const started = Date.now()
  let sessionId: string = randomUUID()
  let userContentForLog = ""

  const logTurn = async (
    userContent: string,
    assistantContent: string | null,
    ok: boolean,
    errorHint?: string | null,
    pineconeUsage?: PineconeChatUsage | null,
  ) => {
    await logChatAnalytics({
      sessionId,
      userContent,
      assistantContent,
      ok,
      latencyMs: Date.now() - started,
      errorHint: errorHint ?? null,
      pineconeUsage: pineconeUsage ?? null,
    })
  }

  try {
    let body: { messages?: unknown; session_id?: unknown }
    try {
      body = await req.json()
    } catch {
      await logChatAnalytics({
        sessionId,
        userContent: "",
        assistantContent: null,
        ok: false,
        latencyMs: Date.now() - started,
        errorHint: "invalid_json_body",
      })
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    sessionId = parseSessionId(body.session_id) ?? randomUUID()

    const messages = body.messages
    if (!Array.isArray(messages)) {
      await logTurn("", null, false, "invalid_messages")
      return NextResponse.json({ error: "No user message found" }, { status: 400 })
    }

    // Get the last user message
    const lastUserMessage = messages.filter((msg: any) => msg.role === "user").pop()

    if (!lastUserMessage) {
      await logTurn("", null, false, "no_user_message")
      return NextResponse.json({ error: "No user message found" }, { status: 400 })
    }

    userContentForLog = extractUserMessageText(lastUserMessage.content)

    // Controls to avoid exceeding Pinecone "prompt tokens" quota.
    // Keep this server-side so every request is bounded.
    const MAX_HISTORY_MESSAGES = Number(process.env.PINECONE_MAX_HISTORY_MESSAGES ?? 6)
    const MAX_MESSAGE_CHARS = Number(process.env.PINECONE_MAX_MESSAGE_CHARS ?? 1200)
    const MAX_PROMPT_CHARS = Number(process.env.PINECONE_MAX_PROMPT_CHARS ?? 12000)

    // التحقق من أن رسالة المستخدم ليست فارغة أو قصيرة جداً
    if (!userContentForLog.trim() || userContentForLog.trim().length < 3) {
      const msg =
        "عذراً، يبدو أن رسالتك لم تكتمل. هل يمكنك توضيح سؤالك أو الطلب الذي تود معرفته؟ سأكون سعيداً بمساعدتك!"
      await logTurn(userContentForLog, msg, true, "short_user_message")
      return NextResponse.json({
        response: msg,
      })
    }

    // إعدادات Pinecone: من لوحة الإدارة (site_settings) ثم متغيرات البيئة
    const { apiKey: pineconeApiKey, assistantId } = await getPineconeCredentials()

    if (!pineconeApiKey) {
      const hasSupabaseUrl = Boolean(getSupabaseUrl())
      const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
      console.error(
        "PINECONE_API_KEY is not set (site_settings or env).",
        hasSupabaseUrl && !hasServiceRole
          ? "Hint: set SUPABASE_SERVICE_ROLE_KEY so /api/chat can read keys saved in Admin → Settings."
          : "",
      )
      const msg =
        "عذراً، واجهت بعض الصعوبات التقنية في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع مركز القبول الموحد مباشرة."
      await logTurn(userContentForLog, msg, true, "missing_pinecone_key")
      return NextResponse.json({
        response: msg,
      })
    }

    const clampContent = (rawContent: unknown) => {
      const contentStr = extractUserMessageText(rawContent)
      // Keep the most recent part since it usually contains the latest context.
      return contentStr.length > MAX_MESSAGE_CHARS ? contentStr.slice(-MAX_MESSAGE_CHARS) : contentStr
    }

    // تحويل الرسائل إلى تنسيق Pinecone (تاريخ المحادثة).
    const nonErrorMessages = messages.filter((msg: any) => msg.role !== "error")

    // Exclude the latest user message from history, then append it exactly once.
    let lastUserIdx = -1
    for (let i = nonErrorMessages.length - 1; i >= 0; i--) {
      if (nonErrorMessages[i]?.role === "user") {
        lastUserIdx = i
        break
      }
    }

    const historySource =
      lastUserIdx >= 0
        ? nonErrorMessages.slice(Math.max(0, lastUserIdx - MAX_HISTORY_MESSAGES), lastUserIdx)
        : nonErrorMessages.slice(-MAX_HISTORY_MESSAGES)

    // Apply a rough chars budget to keep the prompt bounded.
    let remainingChars = MAX_PROMPT_CHARS
    const trimmedFromEnd: Array<{ role: "user" | "assistant"; content: string }> = []
    for (let i = historySource.length - 1; i >= 0; i--) {
      if (remainingChars <= 0) break

      const msg = historySource[i]
      const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user"
      const content = clampContent(msg.content)

      if (!content) continue

      if (content.length > remainingChars) {
        trimmedFromEnd.push({ role, content: content.slice(-remainingChars) })
        remainingChars = 0
        break
      }

      trimmedFromEnd.push({ role, content })
      remainingChars -= content.length
    }

    const conversationHistory = trimmedFromEnd.reverse()

    // بناء messages array للـ chat (نضيف رسالة المستخدم مرة واحدة فقط)
    const chatMessages = [
      ...conversationHistory,
      { role: "user" as const, content: clampContent(userContentForLog) },
    ]

    // إرسال الطلب إلى Pinecone Assistants API باستخدام SDK
    try {
      console.log("Initializing Pinecone client...")
      console.log("Sending request to Pinecone Assistants:", lastUserMessage.content)
      console.log("Assistant ID:", assistantId)

      const pc = new Pinecone({
        apiKey: pineconeApiKey,
      })

      const assistant = pc.assistant(assistantId)

      console.log("Calling assistant.chat()...")
      const chatResp = await assistant.chat({
        messages: chatMessages,
      })

      console.log("Response received from Pinecone Assistants successfully")
      console.log("Full response data:", JSON.stringify(chatResp, null, 2))

      let aiResponse: string | null = null

      if (chatResp && typeof chatResp === "object") {
        aiResponse = (chatResp as any).message?.content || null

        if (!aiResponse) {
          aiResponse =
            (chatResp as any).content ||
            (chatResp as any).response ||
            (chatResp as any).answer

          if (!aiResponse && Array.isArray((chatResp as any).choices) && (chatResp as any).choices.length > 0) {
            aiResponse =
              (chatResp as any).choices[0]?.message?.content ||
              (chatResp as any).choices[0]?.content
          }

          if (!aiResponse) {
            for (const key in chatResp) {
              const value = (chatResp as any)[key]
              if (typeof value === "string" && value.length > 10) {
                aiResponse = value
                break
              } else if (value && typeof value === "object" && value.content && typeof value.content === "string") {
                aiResponse = value.content
                break
              }
            }
          }
        }
      }

      if (!aiResponse) {
        console.error("No valid AI response found in Pinecone response:", chatResp)
        const msg = "عذراً، لم أتمكن من الحصول على رد مناسب من النظام. يرجى المحاولة مرة أخرى."
        await logTurn(userContentForLog, msg, false, "no_ai_response", extractPineconeChatUsage(chatResp))
        return NextResponse.json({
          response: msg,
        })
      }

      const pineconeUsage = extractPineconeChatUsage(chatResp)
      await logTurn(userContentForLog, aiResponse, true, null, pineconeUsage)
      return NextResponse.json({
        response: aiResponse,
      })
    } catch (pineconeError) {
      const isTimeoutError = pineconeError instanceof Error && pineconeError.name === "TimeoutError"
      const isAbortError = pineconeError instanceof Error && pineconeError.name === "AbortError"

      console.error("=== Pinecone Assistants API Error ===")
      console.error("Error type:", pineconeError instanceof Error ? pineconeError.name : typeof pineconeError)
      console.error("Error message:", pineconeError instanceof Error ? pineconeError.message : String(pineconeError))
      console.error("Is timeout:", isTimeoutError)
      console.error("Is abort:", isAbortError)
      console.error("Full error:", pineconeError)

      const messageStr = pineconeError instanceof Error ? pineconeError.message : String(pineconeError)
      if (messageStr.includes("Prompt tokens limit reached") && messageStr.includes("429")) {
        const msg =
          "عذراً، تم الوصول لحد الاستخدام في Pinecone (Prompt tokens). هذا لا يمكن إصلاحه من جهة الكود فقط؛ تحتاج لتحديث/ترقية الخطة أو انتظار إعادة توفر الحصة."
        await logTurn(userContentForLog, msg, false, "pinecone_prompt_quota")
        return NextResponse.json({
          response: msg,
          error: process.env.NODE_ENV === "development" ? messageStr : undefined,
        })
      }

      const errorDetails =
        process.env.NODE_ENV === "development"
          ? ` (${pineconeError instanceof Error ? pineconeError.message : String(pineconeError).substring(0, 100)})`
          : ""

      console.error("================================")

      const msg =
        isTimeoutError || isAbortError
          ? "عذراً، يستغرق الحصول على الرد وقتاً أطول من المعتاد. يرجى المحاولة مرة أخرى بعد لحظات."
          : `عذراً، واجهت بعض الصعوبات التقنية في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع مركز القبول الموحد مباشرة.${errorDetails}`

      await logTurn(userContentForLog, msg, false, isTimeoutError || isAbortError ? "timeout_or_abort" : "pinecone_error")
      return NextResponse.json({
        response: msg,
        error:
          process.env.NODE_ENV === "development"
            ? pineconeError instanceof Error
              ? pineconeError.message
              : String(pineconeError)
            : undefined,
      })
    }
  } catch (error) {
    console.error("Error processing chat request:", error)
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلبك"
    await logTurn(userContentForLog, null, false, "server_exception")
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
