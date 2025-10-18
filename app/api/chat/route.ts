import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Get the last user message
    const lastUserMessage = messages.filter((msg: any) => msg.role === "user").pop()

    if (!lastUserMessage) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 })
    }

    // إعدادات الاتصال بالويب هوك
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n.srv1069224.hstgr.cloud/webhook/9c1bd900-2b1b-43e2-b640-5fbe2cea2531"
    const webhookTimeout = Math.max(5000, Number(process.env.N8N_WEBHOOK_TIMEOUT ?? 70000) || 70000)

    // إرسال السؤال إلى webhook n8n والحصول على الرد
    try {
      console.log("Sending question to n8n:", lastUserMessage.content)

      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: lastUserMessage.content,
          timestamp: new Date().toISOString(),
          userAgent: req.headers.get("user-agent") || "Unknown",
          ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "Unknown"
        }),
        // إضافة timeout لتجنب الانتظار الطويل
        signal: AbortSignal.timeout(webhookTimeout), // القيمة الافتراضية 70 ثانية
      })

      if (webhookResponse.ok) {
        const responseData = await webhookResponse.json()
        console.log("Response received from n8n webhook successfully")
        console.log("Full response data:", JSON.stringify(responseData, null, 2))

        // البحث عن الرد في جميع المفاتيح المحتملة
        let aiResponse =
          responseData.answer ||
          responseData.response ||
          responseData.message ||
          responseData.text ||
          responseData.content ||
          responseData.reply ||
          responseData.ai_response ||
          responseData.assistant_response

        // إذا لم نجد رد في المفاتيح المعتادة، نبحث في المفاتيح الأخرى
        if (!aiResponse) {
          // البحث في جميع مفاتيح الكائن
          for (const key in responseData) {
            if (
              typeof responseData[key] === "string" &&
              responseData[key].length > 10 &&
              !responseData[key].includes("تم استلام") &&
              !responseData[key].includes("شكراً لك")
            ) {
              aiResponse = responseData[key]
              break
            }
          }
        }

        // إذا لم نجد رد مناسب، نعطي رسالة خطأ واضحة
        if (!aiResponse || aiResponse === "تم استلام سؤالك، شكراً لك!") {
          console.error("No valid AI response found in n8n response:", responseData)
          return NextResponse.json({
            response: "عذراً، لم أتمكن من الحصول على رد مناسب من النظام. يرجى المحاولة مرة أخرى.",
          })
        }

        // إرجاع الرد من AI
        return NextResponse.json({
          response: aiResponse,
        })
      } else {
        console.warn(`Webhook returned status: ${webhookResponse.status}`)
        throw new Error(`Webhook returned status: ${webhookResponse.status}`)
      }
    } catch (webhookError) {
      const isTimeoutError = webhookError instanceof Error && webhookError.name === "TimeoutError"
      console.error("Failed to get response from n8n webhook:", webhookError)
      // في حالة فشل webhook، نعطي رد احتياطي
      return NextResponse.json({
        response: isTimeoutError
          ? "عذراً، يستغرق الحصول على الرد وقتاً أطول من المعتاد. يرجى المحاولة مرة أخرى بعد لحظات."
          : "عذراً، واجهت بعض الصعوبات التقنية في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع مركز القبول الموحد مباشرة.",
      })
    }

    // التحقق من أن رسالة المستخدم ليست فارغة أو قصيرة جداً
    if (!lastUserMessage.content || lastUserMessage.content.trim().length < 3) {
      return NextResponse.json({ 
        response: "عذراً، يبدو أن رسالتك لم تكتمل. هل يمكنك توضيح سؤالك أو الطلب الذي تود معرفته؟ سأكون سعيداً بمساعدتك!" 
      })
    }
  } catch (error) {
    console.error("Error processing chat request:", error)
    // تحسين رسالة الخطأ للمستخدم
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلبك"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
