import OpenAI from "openai"
import { studentGuideContent } from "@/data/student-guide"
import { promises as fs } from "fs"
import path from "path"

// أنواع البيانات
interface EmbeddingChunk {
  id: string
  content: string
  embedding: number[]
  metadata: {
    section?: string
    page?: number
    type: 'header' | 'content' | 'list'
  }
}

interface EmbeddingCache {
  chunks: EmbeddingChunk[]
  lastUpdated: string
  version: string
}

// إعداد OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
})

// مسار ملف الـ cache
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'embeddings-cache.json')

// تقسيم النص إلى chunks منطقية
function splitIntoLogicalChunks(text: string): { content: string; metadata: any }[] {
  const chunks: { content: string; metadata: any }[] = []
  
  // تقسيم النص إلى فقرات
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0)
  
  let currentChunk = ""
  let currentSection = ""
  let chunkId = 0
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    
    // كشف العناوين (تبدأ بأرقام أو تحتوي على كلمات مفتاحية)
    const isHeader = /^\d+\.?\s/.test(trimmedParagraph) || 
                     /^(مقدم|سياسات|مركز|الطلبة|شروط|المعدل|طلبة|الطلبة|نصائح|مراحل|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|مؤسسات|البرامج|الملاحق)/.test(trimmedParagraph)
    
    if (isHeader) {
      // حفظ الـ chunk الحالي إذا كان يحتوي على محتوى
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            section: currentSection,
            type: 'content' as const,
            chunkId: chunkId++
          }
        })
      }
      
      // بدء chunk جديد مع العنوان
      currentSection = trimmedParagraph.substring(0, 100) // أول 100 حرف كعنوان للقسم
      currentChunk = trimmedParagraph
    } else {
      // إضافة الفقرة إلى الـ chunk الحالي
      if (currentChunk.length + trimmedParagraph.length > 2000) {
        // إذا تجاوز الحد، احفظ الـ chunk الحالي وابدأ جديد
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              section: currentSection,
              type: 'content' as const,
              chunkId: chunkId++
            }
          })
        }
        currentChunk = trimmedParagraph
      } else {
        if (currentChunk.length > 0) {
          currentChunk += "\n\n"
        }
        currentChunk += trimmedParagraph
      }
    }
  }
  
  // إضافة الـ chunk الأخير
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        section: currentSection,
        type: 'content' as const,
        chunkId: chunkId++
      }
    })
  }
  
  return chunks
}

// توليد embeddings للنص
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw error
  }
}

// حساب cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length")
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// تحميل أو إنشاء embeddings cache
export async function loadOrCreateEmbeddings(): Promise<EmbeddingChunk[]> {
  try {
    // محاولة تحميل الـ cache الموجود
    try {
      const cacheData = JSON.parse(await fs.readFile(CACHE_FILE_PATH, 'utf-8')) as EmbeddingCache
      
      // التحقق من أن الـ cache حديث (أقل من 7 أيام)
      const cacheDate = new Date(cacheData.lastUpdated)
      const now = new Date()
      const daysDiff = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysDiff < 7 && cacheData.chunks.length > 0) {
        console.log(`Using cached embeddings (${cacheData.chunks.length} chunks)`)
        return cacheData.chunks
      }
    } catch (error) {
      // الملف غير موجود، سنقوم بإنشاء embeddings جديدة
      console.log("Cache file not found, will generate new embeddings")
    }
    
    console.log("Generating new embeddings...")
    
    // تقسيم النص إلى chunks
    const chunks = splitIntoLogicalChunks(studentGuideContent)
    console.log(`Split content into ${chunks.length} chunks`)
    
    // توليد embeddings لكل chunk
    const embeddingChunks: EmbeddingChunk[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`Processing chunk ${i + 1}/${chunks.length}`)
      
      try {
        const embedding = await generateEmbedding(chunk.content)
        embeddingChunks.push({
          id: `chunk_${chunk.metadata.chunkId}`,
          content: chunk.content,
          embedding,
          metadata: chunk.metadata
        })
        
        // تأخير صغير لتجنب rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error)
        // تجاهل الـ chunk الذي فشل في المعالجة
      }
    }
    
    // حفظ الـ cache
    const cacheData: EmbeddingCache = {
      chunks: embeddingChunks,
      lastUpdated: new Date().toISOString(),
      version: "1.0"
    }
    
    // إنشاء مجلد data إذا لم يكن موجوداً
    const dataDir = path.dirname(CACHE_FILE_PATH)
    try {
      await fs.mkdir(dataDir, { recursive: true })
    } catch (error) {
      // المجلد موجود بالفعل
    }
    
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2))
    console.log(`Saved ${embeddingChunks.length} embeddings to cache`)
    
    return embeddingChunks
  } catch (error) {
    console.error("Error in loadOrCreateEmbeddings:", error)
    throw error
  }
}

// البحث الدلالي في الـ embeddings
export async function semanticSearch(
  query: string, 
  chunks: EmbeddingChunk[], 
  topK: number = 3
): Promise<EmbeddingChunk[]> {
  try {
    // توليد embedding للاستعلام
    const queryEmbedding = await generateEmbedding(query)
    
    // حساب الـ similarity لكل chunk
    const similarities = chunks.map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    
    // ترتيب حسب الـ similarity واختيار أفضل النتائج
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.chunk)
    
    console.log(`Found ${topResults.length} relevant chunks for query: "${query.substring(0, 50)}..."`)
    
    return topResults
  } catch (error) {
    console.error("Error in semanticSearch:", error)
    throw error
  }
}

// كشف التحيات
export function isGreeting(text: string): boolean {
  const greetings = [
    'السلام عليكم', 'وعليكم السلام', 'السلام', 'سلام',
    'مرحبا', 'مرحباً', 'أهلا', 'أهلاً', 'أهلين',
    'صباح الخير', 'مساء الخير', 'مساء النور',
    'كيف حالك', 'كيفك', 'شلونك', 'شلون حالك',
    'أهلا وسهلا', 'أهلاً وسهلاً', 'مرحبا بك', 'مرحباً بك',
    'شكرا', 'شكراً', 'مشكور', 'مشكورة',
    'الله يعطيك العافية', 'يعطيك العافية',
    'ما شاء الله', 'بارك الله فيك', 'بارك الله فيكِ'
  ]
  
  const lowerText = text.toLowerCase().trim()
  
  return greetings.some(greeting => 
    lowerText.includes(greeting.toLowerCase()) || 
    lowerText === greeting.toLowerCase()
  )
}

// توليد رد التحية
export function generateGreetingResponse(): string {
  const responses = [
    "وعليكم السلام ورحمة الله وبركاته! أهلاً وسهلاً بك في مساعد القبول الموحد. أنا هنا لمساعدتك في كل ما يتعلق بدليل الطالب للالتحاق بمؤسسات التعليم العالي. كيف يمكنني مساعدتك اليوم؟",
    "مرحباً بك! أهلاً وسهلاً في مساعد القبول الموحد. أنا جاهز للإجابة على جميع استفساراتك حول دليل الطالب للقبول الموحد. ما الذي تود معرفته؟",
    "السلام عليكم! أهلاً وسهلاً بك. أنا مساعد القبول الموحد وأنا هنا لمساعدتك في كل ما تحتاجه من معلومات حول دليل الطالب للالتحاق بالجامعات. كيف يمكنني مساعدتك؟",
    "وعليكم السلام! مرحباً بك في مساعد القبول الموحد. أنا سعيد لخدمتك والإجابة على جميع أسئلتك المتعلقة بدليل الطالب للقبول الموحد. ما الذي تود الاستفسار عنه؟"
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}
