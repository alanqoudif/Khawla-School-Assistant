import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json()

    // Get the last user message
    const lastUserMessage = messages.filter((msg: any) => msg.role === "user").pop()

    if (!lastUserMessage) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 })
    }

    // نظام الرد المحلي المؤقت (بدلاً من n8n webhook)
    try {
      console.log("Processing question locally:", lastUserMessage.content)
      console.log("User ID:", userId || "anonymous_user")
      
      // إعطاء ردود مناسبة حسب نوع السؤال
      const question = lastUserMessage.content.toLowerCase()
      let response = ""
      
      if (question.includes("مرحبا") || question.includes("السلام") || question.includes("أهلا")) {
        response = "مرحباً بك! أنا مساعد القبول الرقمي لمدرسة خولة. كيف يمكنني مساعدتك اليوم؟"
      } else if (question.includes("القبول") || question.includes("التسجيل")) {
        response = "يمكنك التسجيل في مدرسة خولة من خلال مركز القبول الموحد. هل تريد معرفة المزيد عن متطلبات القبول أو المواعيد؟"
      } else if (question.includes("الرسوم") || question.includes("التكاليف")) {
        response = "تختلف الرسوم حسب المرحلة الدراسية. يمكنك التواصل مع مركز القبول الموحد للحصول على تفاصيل دقيقة عن الرسوم والخصومات المتاحة."
      } else if (question.includes("المواعيد") || question.includes("التوقيت")) {
        response = "مواعيد الدراسة تبدأ من الساعة 7:30 صباحاً. هل تريد معرفة مواعيد محددة لمرحلة معينة؟"
      } else if (question.includes("المناهج") || question.includes("الدراسة")) {
        response = "نحن نتبع المنهج السعودي المعتمد مع إضافة برامج تعليمية متطورة. هل تريد معرفة تفاصيل عن مرحلة دراسية معينة؟"
      } else if (question.includes("الأنشطة") || question.includes("النوادي")) {
        response = "نوفر مجموعة متنوعة من الأنشطة والبرامج الإثرائية للطلاب. هل تريد معرفة الأنشطة المتاحة لمرحلة معينة؟"
      } else if (question.includes("شكرا") || question.includes("شكراً")) {
        response = "العفو! سعيد بمساعدتك. إذا كان لديك أي أسئلة أخرى، لا تتردد في السؤال."
      } else {
        response = "شكراً لسؤالك. أنا هنا لمساعدتك في جميع استفساراتك حول القبول في مدرسة خولة. هل يمكنك توضيح سؤالك أكثر؟ أو يمكنك التواصل مع مركز القبول الموحد للحصول على معلومات مفصلة."
      }
      
      console.log("Generated local response:", response)
      return NextResponse.json({ 
        response: response
      })
      
    } catch (localError) {
      console.error("Failed to process question locally:", localError)
      // في حالة فشل المعالجة المحلية، نعطي رد احتياطي
      return NextResponse.json({ 
        response: "عذراً، حدث خطأ في معالجة سؤالك. يرجى المحاولة مرة أخرى أو التواصل مع مركز القبول الموحد مباشرة." 
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
