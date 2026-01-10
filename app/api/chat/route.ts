import { type NextRequest, NextResponse } from "next/server"
import { Pinecone } from "@pinecone-database/pinecone"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Get the last user message
    const lastUserMessage = messages.filter((msg: any) => msg.role === "user").pop()

    if (!lastUserMessage) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 })
    }

    // التحقق من أن رسالة المستخدم ليست فارغة أو قصيرة جداً
    if (!lastUserMessage.content || lastUserMessage.content.trim().length < 3) {
      return NextResponse.json({ 
        response: "عذراً، يبدو أن رسالتك لم تكتمل. هل يمكنك توضيح سؤالك أو الطلب الذي تود معرفته؟ سأكون سعيداً بمساعدتك!" 
      })
    }

    // إعدادات الاتصال بـ Pinecone Assistants API
    // Pinecone Assistants يستخدم SDK وليس REST API مباشرة
    const pineconeApiKey = process.env.PINECONE_API_KEY || "pcsk_2KyufY_ExDVihweFdvddp5fwD4WaHLHrFzJQ1cjwFfVPsAHDfnGoXpM9QGe4Qf5oXrWhzX"
    const assistantId = process.env.PINECONE_ASSISTANT_ID || "ad"
    const apiTimeout = Math.max(5000, Number(process.env.PINECONE_API_TIMEOUT ?? 70000) || 70000)

    // تحويل الرسائل إلى تنسيق Pinecone (تاريخ المحادثة)
    const conversationHistory = messages
      .filter((msg: any) => msg.role !== "error")
      .slice(-10) // أخذ آخر 10 رسائل فقط
      .map((msg: any) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      }))

    // بناء messages array للـ chat
    const chatMessages = [
      ...conversationHistory,
      { role: "user" as const, content: lastUserMessage.content },
    ]

    // إرسال الطلب إلى Pinecone Assistants API باستخدام SDK
    try {
      console.log("Initializing Pinecone client...")
      console.log("Sending request to Pinecone Assistants:", lastUserMessage.content)
      console.log("Assistant ID:", assistantId)

      // إنشاء Pinecone client
      const pc = new Pinecone({
        apiKey: pineconeApiKey,
      })

      // الحصول على Assistant باستخدام pc.assistant() وليس pc.Assistant()
      const assistant = pc.assistant(assistantId)

      // إرسال chat request
      console.log("Calling assistant.chat()...")
      const chatResp = await assistant.chat({
        messages: chatMessages,
      })

      console.log("Response received from Pinecone Assistants successfully")
      console.log("Full response data:", JSON.stringify(chatResp, null, 2))

      // استخراج الرد من response
      // بناءً على التوثيق، response يحتوي على message.content
      // Response structure: { id, finishReason, message: { role, content }, model, citations, usage }
      let aiResponse: string | null = null

      if (chatResp && typeof chatResp === "object") {
        // البحث في البنية القياسية للـ response بناءً على التوثيق
        // chat() returns: { id, finishReason, message: { role, content }, model, citations, usage }
        aiResponse = (chatResp as any).message?.content || null

        // إذا لم نجد في message، جرب المفاتيح الأخرى
        if (!aiResponse) {
          aiResponse =
            (chatResp as any).content ||
            (chatResp as any).response ||
            (chatResp as any).answer

          // إذا كان response يحتوي على choices array (chatCompletion format)
          if (!aiResponse && Array.isArray((chatResp as any).choices) && (chatResp as any).choices.length > 0) {
            aiResponse =
              (chatResp as any).choices[0]?.message?.content ||
              (chatResp as any).choices[0]?.content
          }

          // البحث في جميع المفاتيح
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

      // إذا لم نجد رد مناسب، نعطي رسالة خطأ واضحة
      if (!aiResponse) {
        console.error("No valid AI response found in Pinecone response:", chatResp)
        return NextResponse.json({
          response: "عذراً، لم أتمكن من الحصول على رد مناسب من النظام. يرجى المحاولة مرة أخرى.",
        })
      }

      // إرجاع الرد من AI
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
      
      // إرجاع معلومات الخطأ للمساعدة في التصحيح (في development فقط)
      const errorDetails = process.env.NODE_ENV === "development" 
        ? ` (${pineconeError instanceof Error ? pineconeError.message : String(pineconeError).substring(0, 100)})`
        : ""
      
      console.error("================================")
      
      // في حالة فشل API، نعطي رد احتياطي مع معلومات الخطأ في development
      return NextResponse.json({
        response: isTimeoutError || isAbortError
          ? "عذراً، يستغرق الحصول على الرد وقتاً أطول من المعتاد. يرجى المحاولة مرة أخرى بعد لحظات."
          : `عذراً، واجهت بعض الصعوبات التقنية في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع مركز القبول الموحد مباشرة.${errorDetails}`,
        error: process.env.NODE_ENV === "development" ? (pineconeError instanceof Error ? pineconeError.message : String(pineconeError)) : undefined,
      })
    }
  } catch (error) {
    console.error("Error processing chat request:", error)
    // تحسين رسالة الخطأ للمستخدم
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلبك"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
