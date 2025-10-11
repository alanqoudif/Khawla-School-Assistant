import { type NextRequest, NextResponse } from "next/server"
import { studentGuideContent, searchGuideContent } from "@/data/student-guide"
import OpenAI from "openai"
import { loadOrCreateEmbeddings, semanticSearch, isGreeting, generateGreetingResponse } from "@/utils/embeddings"

// متغير لتخزين الـ embeddings (cache في الذاكرة)
let embeddingsCache: any[] | null = null

// قائمة النماذج المتاحة للاستخدام مع آلية الانتقال التلقائي
const OPENAI_MODELS = [
  "gpt-4o", // النموذج الأساسي
  "gpt-4o-mini", // نموذج احتياطي
  "gpt-4-turbo", // نموذج احتياطي آخر
]

export async function POST(req: NextRequest) {
  try {
    // التحقق من وجود مفتاح API في بداية الدالة
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is missing")
      return NextResponse.json({ error: "مفتاح API غير متوفر. يرجى التواصل مع مسؤول النظام." }, { status: 500 })
    }

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

    // كشف التحيات والرد عليها
    if (isGreeting(lastUserMessage.content)) {
      return NextResponse.json({ 
        response: generateGreetingResponse() 
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


    // البحث في دليل الطالب - استخدام البحث النصي المحسن كبديل احتياطي
    let relevantGuideContent = ""
    
    try {
      // محاولة البحث الدلالي أولاً
      if (!embeddingsCache) {
        console.log("Loading embeddings...")
        embeddingsCache = await loadOrCreateEmbeddings()
      }

      const relevantChunks = await semanticSearch(lastUserMessage.content, embeddingsCache, 3)
      console.log(`Found ${relevantChunks.length} relevant chunks for semantic search`)
      
      if (relevantChunks.length > 0) {
        relevantGuideContent = relevantChunks.map(chunk => chunk.content).join("\n\n")
      }
    } catch (error) {
      console.log("Semantic search failed, falling back to text search:", error)
    }
    
    // إذا لم نحصل على نتائج من البحث الدلالي، استخدم البحث النصي المحسن
    if (!relevantGuideContent || relevantGuideContent.trim().length < 100) {
      console.log("Using enhanced text search as fallback")
      relevantGuideContent = searchGuideContent(lastUserMessage.content)
    }
    
    // تقليل حجم المحتوى إذا كان كبيراً جداً
    const maxGuideContentLength = 30000 // حد أقصى 30,000 حرف
    const trimmedGuideContent = relevantGuideContent.length > maxGuideContentLength 
      ? relevantGuideContent.substring(0, maxGuideContentLength) + "..."
      : relevantGuideContent

    // إعداد الرسالة النظامية مع المحتوى ذي الصلة فقط
    const systemMessage = `أنت مساعد القبول الموحد، مساعد ذكي في مدرسة خولة بنت حكيم للتعليم الأساسي(٩-١٢) في ظفار، عُمان. 
    مهمتك هي مساعدة الطلاب بالإجابة على أسئلتهم المتعلقة بالقبول الموحد للمؤسسات التعليمية العالية في عُمان.
    
    فيما يلي المعلومات ذات الصلة من دليل الطالب للقبول الموحد:
    
    ${trimmedGuideContent}
    
    استخدم لهجة ودودة ولطيفة في ردودك. حاول تحديد جنس المستخدم من خلال المحادثة:
    
    1. إذا كان المستخدم ذكراً، استخدم صيغة المذكر مثل "عزيزي الطالب"، "أحسنت"، "شكراً لك"، "يمكنك"، إلخ.
    2. إذا كانت المستخدمة أنثى، استخدم صيغة المؤنث مثل "عزيزتي الطالبة"، "أحسنتِ"، "شكراً لكِ"، "يمكنكِ"، إلخ.
    3. إذا لم تتمكن من تحديد الجنس، استخدم صيغة محايدة أو اجمع بين الصيغتين مثل "عزيزي الطالب/عزيزتي الطالبة".
    
    كن لطيفاً ومتعاطفاً في ردودك، واستخدم عبارات تشجيعية وداعمة.
    
    عند الإجابة على الأسئلة:
    - اعتمد على المعلومات المتوفرة في دليل الطالب أعلاه
    - قدم إجابات شاملة ومفيدة حتى لو لم تكن المعلومات كاملة
    - إذا لم تجد معلومات دقيقة، قدم إرشادات عامة مفيدة بناءً على معرفتك العامة
    - استخدم لغة طبيعية ومفهومة
    - عند الإجابة على أسئلة حول برامج دراسية محددة، قم بذكر رمز البرنامج والحد الأدنى للتقدم للبرنامج والمعلومات الإضافية المتعلقة به كما هي مذكورة في دليل الطالب
    - إذا لم تجد معلومات محددة، قدم نصائح عامة مفيدة حول القبول الموحد
    
    مهم جداً: حتى لو لم تجد معلومات دقيقة في الدليل، قدم إجابة مفيدة ومشجعة بناءً على معرفتك العامة حول القبول الموحد في عُمان. لا تقل "لم أجد معلومات" بل قدم مساعدة عملية.
    
    هدفك هو تقديم مساعدة مفيدة ومشجعة للطلاب في رحلتهم نحو التعليم العالي.`

    // تحضير محتوى الرسالة
    const prompt = `${systemMessage}\n\nسؤال المستخدم: ${enhancedUserMessage.content}`

    // وظيفة لإرسال طلب إلى OpenAI API
    async function callOpenAIAPI(modelName: string) {
      console.log(`Trying model: ${modelName}...`)

      // التحقق من وجود مفتاح API مرة أخرى قبل إنشاء العميل
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("API_ERROR:OpenAI API key is not available")
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
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

    // إذا لم ننجح مع أي نموذج، ارجع رد احتياطي مفيد
    console.error("All models failed:", lastError)
    
    // محاولة إعطاء رد احتياطي بناءً على البحث النصي
    const fallbackResponse = searchGuideContent(lastUserMessage.content)
    
    if (fallbackResponse && fallbackResponse.length > 50) {
      return NextResponse.json({ 
        response: `عذراً، واجهت بعض الصعوبات التقنية، لكن يمكنني مساعدتك بناءً على دليل الطالب:

${fallbackResponse}

إذا كنت بحاجة لمعلومات أكثر تفصيلاً، يرجى المحاولة مرة أخرى أو التواصل مع مركز القبول الموحد مباشرة.` 
      })
    }
    
    return NextResponse.json(
      {
        error: "عذراً، لم نتمكن من معالجة طلبك في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع مركز القبول الموحد مباشرة.",
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
