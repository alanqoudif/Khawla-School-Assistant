import { type NextRequest, NextResponse } from "next/server"
import { studentGuideContent } from "@/data/student-guide"
import OpenAI from "openai"

// وظيفة لتقسيم النص إلى أجزاء أصغر
function splitTextIntoChunks(text: string, maxChunkSize = 4000): string[] {
  const chunks: string[] = []
  let currentChunk = ""

  // تقسيم النص إلى فقرات
  const paragraphs = text.split("\n\n")

  for (const paragraph of paragraphs) {
    // إذا كانت إضافة الفقرة الحالية ستتجاوز الحد الأقصى، قم بحفظ الجزء الحالي وابدأ جزءًا جديدًا
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      chunks.push(currentChunk)
      currentChunk = paragraph
    } else {
      // وإلا، أضف الفقرة إلى الجزء الحالي
      if (currentChunk.length > 0) {
        currentChunk += "\n\n"
      }
      currentChunk += paragraph
    }
  }

  // إضافة الجزء الأخير إذا لم يكن فارغًا
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

// وظيفة للبحث عن المعلومات ذات الصلة في دليل الطالب
function findRelevantInformation(query: string, guideContent: string): string {
  // تقسيم دليل الطالب إلى أجزاء
  const chunks = splitTextIntoChunks(guideContent)

  // تحويل الاستعلام والأجزاء إلى أحرف صغيرة للمقارنة
  const lowerQuery = query.toLowerCase()

  // البحث عن الكلمات الرئيسية في الاستعلام
  const keywords = lowerQuery.split(/\s+/).filter((word) => word.length > 3)

  // تصنيف الأجزاء حسب عدد الكلمات الرئيسية التي تحتوي عليها
  const rankedChunks = chunks
    .map((chunk) => {
      const lowerChunk = chunk.toLowerCase()
      let score = 0

      // حساب عدد الكلمات الرئيسية الموجودة في الجزء
      for (const keyword of keywords) {
        if (lowerChunk.includes(keyword)) {
          score += 1
        }
      }

      return { chunk, score }
    })
    .sort((a, b) => b.score - a.score)

  // اختيار الأجزاء الأكثر صلة (بحد أقصى 2 أجزاء لتقليل حجم السياق)
  const relevantChunks = rankedChunks.slice(0, 2).map((item) => item.chunk)

  // دمج الأجزاء ذات الصلة
  return relevantChunks.join("\n\n")
}

// قائمة النماذج المتاحة للاستخدام مع آلية الانتقال التلقائي
const OPENAI_MODELS = [
  "gpt-5-nano", // النموذج المطلوب من المستخدم
  "gpt-4o", // نموذج احتياطي
  "gpt-4o-mini", // نموذج احتياطي آخر
  "gpt-4-turbo", // نموذج احتياطي آخر
]

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
        response: "عذراً، يبدو أن رسالتك لم تكتمل. هل يمكنك توضيح سؤالك أو الطلب الذي تود معرفته بناءً على دليل الطالب للقبول الموحد؟ سأكون سعيداً بمساعدتك!" 
      })
    }

    // إضافة وظيفة لتحسين صياغة الأسئلة
    function enhanceUserQuery(query: string): string {
      return `بناءً على المعلومات الموجودة في دليل الطالب للقبول الموحد، ${query}`
    }

    // تحسين السؤال الأخير من المستخدم
    const enhancedUserMessage = {
      role: lastUserMessage.role,
      content: enhanceUserQuery(lastUserMessage.content),
    }

    // استخدام الرسالة المحسنة في سجل المحادثة
    const conversationHistory = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    // إضافة الرسالة المحسنة في نهاية سجل المحادثة
    conversationHistory.push({
      role: enhancedUserMessage.role,
      content: enhancedUserMessage.content,
    })

    // التحقق من وجود مفتاح API لـ OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is missing")
      return NextResponse.json({ error: "مفتاح API غير متوفر. يرجى التواصل مع مسؤول النظام." }, { status: 500 })
    }

    // البحث عن المعلومات ذات الصلة في دليل الطالب بناءً على سؤال المستخدم
    const relevantGuideContent = findRelevantInformation(lastUserMessage.content, studentGuideContent)
    console.log(`Found relevant guide content (${relevantGuideContent.length} characters)`)
    
    // تقليل حجم المحتوى إذا كان كبيراً جداً
    const maxGuideContentLength = 30000 // حد أقصى 30,000 حرف
    const trimmedGuideContent = relevantGuideContent.length > maxGuideContentLength 
      ? relevantGuideContent.substring(0, maxGuideContentLength) + "..."
      : relevantGuideContent

    // إعداد الرسالة النظامية مع المحتوى ذي الصلة فقط
    const systemMessage = `أنت مساعد القبول الموحد، مساعد ذكي في مدرسة خولة بنت حكيم للتعليم الأساسي(٩-١٢) في ظفار، عُمان. 
    مهمتك هي مساعدة الطلاب بالإجابة على أسئلتهم المتعلقة بالقبول الموحد للمؤسسات التعليمية العالية في عُمان.
    
    يجب أن تكون إجاباتك دقيقة ومستندة فقط على المعلومات الموجودة في "دليل الطالب" للقبول الموحد.
    
    فيما يلي الأجزاء ذات الصلة من دليل الطالب التي يجب أن تعتمد عليها في إجاباتك:
    
    ${trimmedGuideContent}
    
    استخدم لهجة ودودة ولطيفة في ردودك. حاول تحديد جنس المستخدم من خلال المحادثة:
    
    1. إذا كان المستخدم ذكراً، استخدم صيغة المذكر مثل "عزيزي الطالب"، "أحسنت"، "شكراً لك"، "يمكنك"، إلخ.
    2. إذا كانت المستخدمة أنثى، استخدم صيغة المؤنث مثل "عزيزتي الطالبة"، "أحسنتِ"، "شكراً لكِ"، "يمكنكِ"، إلخ.
    3. إذا لم تتمكن من تحديد الجنس، استخدم صيغة محايدة أو اجمع بين الصيغتين مثل "عزيزي الطالب/عزيزتي الطالبة".
    
    كن لطيفاً ومتعاطفاً في ردودك، واستخدم عبارات تشجيعية وداعمة.
    
    إذا لم تكن المعلومات متوفرة في دليل الطالب، اعتذر بلطف وأخبر المستخدم أن هذه المعلومات غير متوفرة في دليل القبول الموحد.
    
    عند الإجابة على أسئلة حول برامج دراسية محددة، قم بذكر رمز البرنامج والحد الأدنى للتقدم للبرنامج والمعلومات الإضافية المتعلقة به كما هي مذكورة في دليل الطالب.`

    // تحضير محتوى الرسالة
    const prompt = `${systemMessage}\n\nسؤال المستخدم: ${enhancedUserMessage.content}`

    // وظيفة لإرسال طلب إلى OpenAI API
    async function callOpenAIAPI(modelName: string) {
      console.log(`Trying model: ${modelName}...`)

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY as string,
      })

      try {
        const response = await openai.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            {
              role: "user",
              content: enhancedUserMessage.content,
            },
          ],
          temperature: 0.7,
          max_completion_tokens: 1000,
        })

        console.log(`${modelName} response received`)

        if (!response.choices || !response.choices[0] || !response.choices[0].message) {
          console.error(`Unexpected ${modelName} response structure:`, response)
          throw new Error(`INVALID_RESPONSE:${JSON.stringify(response)}`)
        }

        return response.choices[0].message.content || ""
      } catch (error: any) {
        console.error(`${modelName} error:`, error.message)

        // إذا كان الخطأ هو تجاوز حد الاستخدام، ارفع استثناءً خاصًا
        if (error.status === 429) {
          throw new Error(`RATE_LIMIT:${error.message}`)
        }

        throw new Error(`API_ERROR:${error.message}`)
      }
    }

    // تنفيذ محاولات متعددة باستخدام نماذج مختلفة
    let lastError = null

    for (const model of OPENAI_MODELS) {
      try {
        const assistantResponse = await callOpenAIAPI(model)
        console.log(`Successfully got response from ${model}`)

        // إرجاع الاستجابة الناجحة
        return NextResponse.json({ response: assistantResponse })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Error with ${model}:`, errorMessage)

        lastError = error

        // إذا كان الخطأ ليس بسبب تجاوز حد الاستخدام، جرب النموذج التالي
        if (!errorMessage.startsWith("RATE_LIMIT:")) {
          continue
        }

        // إذا كان الخطأ بسبب تجاوز حد الاستخدام، انتظر قليلاً قبل المحاولة مرة أخرى
        console.log(`Rate limit hit for ${model}, waiting before trying next model...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    // إذا لم ننجح مع أي نموذج، ارجع خطأ
    console.error("All models failed:", lastError)
    return NextResponse.json(
      {
        error: "عذراً، لم نتمكن من معالجة طلبك في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً.",
      },
      { status: 500 },
    )
  } catch (error) {
    console.error("Error processing chat request:", error)
    // تحسين رسالة الخطأ للمستخدم
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلبك"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
