"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, Sparkles, HelpCircle, AlertCircle, RefreshCw, FileText, Download } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { WelcomeDialog } from "@/components/welcome-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Message = {
  role: "user" | "assistant" | "error"
  content: string
  id?: number
}

// إضافة مجموعة متنوعة من رسائل التحميل محايدة الجنس
const LOADING_MESSAGES = [
  "جاري البحث في دليل الطالب للإجابة على سؤالك...",
  "لحظة من فضلك، أنا أفكر في إجابة مناسبة...",
  "جاري البحث في دليل القبول الموحد...",
  "أنا أتصفح دليل الطالب للعثور على المعلومات المناسبة...",
  "دعني أفكر قليلاً في سؤالك...",
  "أنا أراجع المعلومات في دليل الطالب...",
  "جاري تحليل سؤالك للعثور على أفضل إجابة...",
  "لحظة واحدة، أبحث عن المعلومات الدقيقة لك...",
]

const API_PROXY_TIMEOUT = Math.max(8000, Number(process.env.NEXT_PUBLIC_CHAT_API_TIMEOUT ?? "70000") || 70000)

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "مرحباً بك! أنا Admission، مساعد القبول الموحد، وأنا هنا لمساعدتك في كل ما يتعلق بدليل الطالب للالتحاق بمؤسسات التعليم العالي. كيف يمكنني مساعدتك اليوم؟",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()
  const [avatarError, setAvatarError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showWelcomeAgain, setShowWelcomeAgain] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3
  const [lastUserMessage, setLastUserMessage] = useState<string>("")
  const [isRetrying, setIsRetrying] = useState(false)
  const [silentRetry, setSilentRetry] = useState(false)
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number) => {
    const controller = new AbortController()
    const timeoutId = timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }

  const safeJsonParse = (text: string) => {
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch (error) {
      console.warn("Failed to parse JSON payload:", error)
      return null
    }
  }

  const extractAiResponse = (payload: any): string | null => {
    if (!payload || typeof payload !== "object") return null

    // API route يرجع "response" مباشرة، لذلك نبحث عنه أولاً
    const candidateKeys = [
      "response", // الأولوية الأولى
      "answer",
      "message",
      "text",
      "content",
      "reply",
      "ai_response",
      "assistant_response",
    ]

    for (const key of candidateKeys) {
      const value = payload[key]
      if (typeof value === "string" && value.trim().length > 0) {
        return value
      }
    }

    for (const key in payload) {
      const value = (payload as Record<string, unknown>)[key]
      if (
        typeof value === "string" &&
        value.trim().length > 10 &&
        !value.includes("تم استلام") &&
        !value.includes("شكراً لك")
      ) {
        return value
      }
    }

    return null
  }

  // دالة لتحويل Markdown (**text**) إلى JSX مع نص أكبر
  const renderMarkdown = (text: string): React.ReactNode => {
    if (!text) return null

    // تحويل **text** إلى <strong> مع حجم أكبر
    const parts: (string | React.ReactNode)[] = []
    const regex = /\*\*(.+?)\*\*/g
    let lastIndex = 0
    let match
    let matchIndex = 0

    while ((match = regex.exec(text)) !== null) {
      // إضافة النص قبل **
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      
      // إضافة النص بين ** مع تنسيق أكبر
      parts.push(
        <strong key={`bold-${matchIndex}`} className="text-base md:text-lg font-bold">
          {match[1]}
        </strong>
      )
      
      lastIndex = regex.lastIndex
      matchIndex++
    }

    // إضافة باقي النص
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    // إذا لم يكن هناك ** في النص، أرجعه كما هو
    if (parts.length === 0 || (parts.length === 1 && typeof parts[0] === "string")) {
      return text
    }

    return <>{parts}</>
  }

  const requestViaAppApi = async (sanitizedMessages: Message[]) => {
    const response = await fetchWithTimeout(
      "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: sanitizedMessages }),
      },
      API_PROXY_TIMEOUT,
    )

    const text = await response.text()
    const data = safeJsonParse(text) ?? {}

    if (!response.ok || (data as { error?: string }).error) {
      const errorDetail = (data as { error?: string }).error || `Error ${response.status}: ${response.statusText}`
      throw new Error(errorDetail)
    }

    const candidate = extractAiResponse(data)

    if (!candidate) {
      throw new Error("خادم المحادثة لم يرجع ردًا صالحًا.")
    }

    return candidate
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // التركيز على حقل الإدخال عند تحميل الصفحة
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const getRandomLoadingMessage = () => {
    const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length)
    return LOADING_MESSAGES[randomIndex]
  }

  const handleSubmit = async (e: React.FormEvent, retryMessage?: string) => {
    e.preventDefault()

    // استخدم الرسالة المعاد محاولتها أو الإدخال الجديد
    const messageContent = retryMessage || input

    if (!messageContent.trim()) return

    // إذا لم تكن هذه محاولة إعادة، احفظ الرسالة الأخيرة للمستخدم
    if (!retryMessage) {
      setLastUserMessage(messageContent)
    }

    const userMessage: Message = {
      role: "user",
      content: messageContent,
    }

    // إذا لم تكن هذه محاولة إعادة، أضف رسالة المستخدم إلى المحادثة
    if (!retryMessage) {
      setMessages((prev) => [...prev, userMessage])
      setInput("")
    }

    setIsLoading(true)
    setIsRetrying(!!retryMessage)

    // إنشاء معرف فريد لرسالة التحميل
    const loadingMessageId = Date.now()

    // إضافة رسالة التحميل فقط إذا لم تكن محاولة صامتة
    if (!silentRetry) {
      setMessages((prev) => [...prev, { role: "assistant", content: getRandomLoadingMessage(), id: loadingMessageId }])
    }

    try {
      console.log("Sending request to chat API...")

      const sanitizedMessages = [...messages.filter((msg) => msg.role !== "error"), userMessage]

      // استخدام API route فقط (الذي يتصل بـ Pinecone Assistants)
      let assistantReply: string | null = null
      
      try {
        assistantReply = await requestViaAppApi(sanitizedMessages)
      } catch (apiError) {
        console.error("API request failed:", apiError)
        console.error("Error details:", apiError instanceof Error ? apiError.message : String(apiError))
        throw apiError
      }

      if (!assistantReply) {
        throw new Error("لم يتم الحصول على رد من API")
      }

      const finalResponse = assistantReply

      // إزالة رسالة التحميل وإضافة الرد المناسب
      setMessages((prev) => {
        // إذا كانت محاولة صامتة، استبدل آخر رسالة خطأ بالرد
        if (silentRetry) {
          const newMessages = [...prev]
          // البحث عن آخر رسالة خطأ واستبدالها
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].role === "error") {
              newMessages[i] = {
                role: "assistant",
                content: finalResponse,
              }
              return newMessages
            }
          }
          // إذا لم نجد رسالة خطأ، أضف الرد كالمعتاد
          return [...newMessages, { role: "assistant", content: finalResponse }]
        } else {
          // إزالة رسالة التحميل وإضافة الرد
          return prev
            .filter((msg) => msg.id !== loadingMessageId)
            .concat({
              role: "assistant",
              content: finalResponse,
            })
        }
      })

      // إعادة تعيين عداد المحاولات عند النجاح
      setRetryCount(0)
      setIsRetrying(false)
      setSilentRetry(false)
    } catch (error) {
      console.error("Error:", error)

      // Create a more informative error message for the user
      let errorMessage = "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى."

      // If the error is related to API authentication, show a more specific message
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          errorMessage = "عذراً، هناك مشكلة في الاتصال بخدمة الذكاء الاصطناعي. يرجى التواصل مع مسؤول النظام."
          console.error("Authentication error with Pinecone API")
        } else if (error.message.includes("404")) {
          errorMessage = "عذراً، لم يتم العثور على نقطة النهاية المطلوبة. يرجى التحقق من إعدادات Pinecone API."
          console.error("Endpoint not found - Pinecone Assistants API endpoint may be incorrect")
        } else if (error.message.includes("403")) {
          errorMessage = "عذراً، لا توجد صلاحية للوصول. يرجى التحقق من API Key."
          console.error("Authorization error - Pinecone API key may be invalid")
        }
        
        // في development، أضف تفاصيل الخطأ
        if (process.env.NODE_ENV === "development") {
          console.error("Full error details:", error.message)
          console.error("Error stack:", error.stack)
        }
      }

      // إذا كانت محاولة صامتة، لا تغير الرسائل
      if (!silentRetry) {
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== loadingMessageId)
            .concat({
              role: "error",
              content: errorMessage,
            }),
        )
      }

      // زيادة عداد المحاولات
      setRetryCount((prev) => prev + 1)

      // إذا لم نصل إلى الحد الأقصى للمحاولات، حاول مرة أخرى تلقائيًا بعد ثانيتين
      if (retryCount < maxRetries - 1) {
        setTimeout(() => {
          setSilentRetry(true) // تعيين المحاولة التالية كمحاولة صامتة
          handleSubmit(e, messageContent)
        }, 1500)
      } else {
        setIsRetrying(false)
        setSilentRetry(false)
      }
    } finally {
      setIsLoading(false)
      // التركيز على حقل الإدخال بعد الإرسال
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  // وظيفة لإعادة المحاولة مع آخر رسالة للمستخدم
  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault()
    if (lastUserMessage && !isLoading && !isRetrying) {
      setRetryCount(0) // إعادة تعيين عداد المحاولات عند الضغط على زر إعادة المحاولة يدويًا
      setSilentRetry(false) // تأكد من أن المحاولة اليدوية ليست صامتة
      handleSubmit(e as unknown as React.FormEvent, lastUserMessage)
    }
  }

  // تحديث وظيفة resetWelcomeDialog لتكون أكثر وضوحًا
  const resetWelcomeDialog = () => {
    // إزالة علامة "hasSeenWelcome" من التخزين المحلي
    // هذا سيجعل البطاقة المنبثقة تظهر مرة أخرى في المرة القادمة
    localStorage.removeItem("hasSeenWelcome")
    // تحديث حالة لإعادة تحميل مكون WelcomeDialog
    setShowWelcomeAgain(!showWelcomeAgain)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-purple-50 via-purple-100 to-indigo-50">
      <WelcomeDialog key={showWelcomeAgain ? "show" : "hide"} />
      
      {/* نافذة عرض PDF */}
      <Dialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle className="text-right">دليل الطالب للالتحاق بمؤسسات التعليم العالي</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src="/student-guide.pdf"
              className="w-full h-full border-0"
              title="دليل الطالب"
            />
          </div>
        </DialogContent>
      </Dialog>

      <header className="bg-gradient-to-r from-purple-800 to-indigo-700 text-white py-3 px-3 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-white/20">
              <AvatarImage src="/school-logo.png" alt="شعار مدرسة خولة بنت حكيم للتعليم الأساسي(٩-١٢)" />
              <AvatarFallback className="bg-purple-700">أ</AvatarFallback>
            </Avatar>
            <h1 className="text-lg md:text-xl font-bold text-center">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400 text-2xl md:text-3xl font-extrabold drop-shadow-md tracking-wide animate-pulse">
                Admission
              </span>
              <br />
              المساعد الذكي للقبول الموحد
            </h1>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 h-8 w-8"
              onClick={resetWelcomeDialog}
              title="المساعدة"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">المساعدة</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-2 md:p-6 flex flex-col">
        {/* بطاقة دليل الطالب */}
        <Card className="mb-4 shadow-lg border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-purple-600" />
                <div>
                  <h3 className="font-bold text-purple-900 text-sm md:text-base">دليل الطالب للالتحاق بمؤسسات التعليم العالي</h3>
                  <p className="text-xs md:text-sm text-purple-700">تصفح أو حمّل دليل القبول الموحد</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setIsPdfDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 ml-1" />
                  تصفح الدليل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => {
                    const link = document.createElement("a")
                    link.href = "/student-guide.pdf"
                    link.download = "دليل-الطالب-للالتحاق-بمؤسسات-التعليم-العالي.pdf"
                    link.click()
                  }}
                >
                  <Download className="h-4 w-4 ml-1" />
                  تحميل
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden shadow-xl border-purple-200 bg-white/80 backdrop-blur-sm">
          <CardHeader className="py-2 px-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardTitle className="text-center text-purple-800 flex items-center justify-center gap-1 text-sm md:text-base">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>دليل الطالب للالتحاق بمؤسسات التعليم العالي</span>
              <Sparkles className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-16rem)] md:h-[calc(100vh-18rem)]">
              <div className="p-3 space-y-3">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`flex items-start gap-2 max-w-[90%] md:max-w-[80%] ${
                        message.role === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <Avatar
                        className={`h-7 w-7 md:h-8 md:w-8 ${
                          message.role === "assistant"
                            ? "bg-purple-600"
                            : message.role === "error"
                              ? "bg-red-600"
                              : "bg-slate-600"
                        } ring-2 ${
                          message.role === "assistant"
                            ? "ring-purple-200"
                            : message.role === "error"
                              ? "ring-red-200"
                              : "ring-blue-100"
                        }`}
                      >
                        <AvatarFallback className="text-xs md:text-sm">
                          {message.role === "assistant" ? "أ" : message.role === "error" ? "!" : "م"}
                        </AvatarFallback>
                        {message.role === "assistant" && !avatarError && (
                          <AvatarImage
                            src="/school-logo.png"
                            alt="مساعد القبول الموحد"
                            onError={() => setAvatarError(true)}
                          />
                        )}
                        {message.role === "error" && <AlertCircle className="h-4 w-4 text-white" />}
                      </Avatar>
                      <div
                        className={`p-2 md:p-3 rounded-2xl shadow-sm ${
                          message.role === "user"
                            ? "bg-gradient-to-r from-blue-100 to-blue-50 text-slate-800"
                            : message.role === "error"
                              ? "bg-gradient-to-r from-red-100 to-red-50 text-slate-800"
                              : "bg-gradient-to-r from-purple-100 to-purple-50 text-slate-800"
                        }`}
                        style={{ direction: "rtl" }}
                      >
                        {message.id ? (
                          <div className="flex items-center">
                            <p className="text-sm whitespace-pre-wrap">
                              {renderMarkdown(message.content)} <span className="inline-block animate-pulse">...</span>
                            </p>
                          </div>
                        ) : (
                          <div>
                            {/* {message.role === "assistant" && (
                              <p className="text-xs font-semibold text-purple-700 mb-1">
                                أنا Admission، مساعد القبول الموحد
                              </p>
                            )} */}
                            <p className="text-sm whitespace-pre-wrap">{renderMarkdown(message.content)}</p>
                            {message.role === "error" && lastUserMessage && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs bg-white/50 hover:bg-white"
                                onClick={handleRetry}
                                disabled={isLoading || retryCount >= maxRetries || isRetrying}
                              >
                                <RefreshCw className={`h-3 w-3 ml-1 ${isRetrying ? "animate-spin" : ""}`} />
                                {isRetrying ? "جاري المحاولة..." : "إعادة المحاولة"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-2 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex gap-2 w-full">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب سؤالك هنا..."
                className="flex-1 text-right h-10 md:h-12 text-sm md:text-base border-purple-200 focus-visible:ring-purple-400"
                disabled={isLoading || retryCount >= maxRetries || isRetrying}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim() || retryCount >= maxRetries || isRetrying}
                className="h-10 md:h-12 px-3 md:px-4 bg-purple-600 hover:bg-purple-700"
              >
                {isLoading || isRetrying ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isMobile ? (
                  <Send className="h-5 w-5" />
                ) : (
                  <>
                    <Send className="h-5 w-5 ml-2" />
                    <span>إرسال</span>
                  </>
                )}
              </Button>
            </form>
            {retryCount >= maxRetries && !isRetrying && !silentRetry && (
              <div className="mt-2 text-center text-red-600 text-sm">
                عذراً، لم نتمكن من معالجة طلبك في الوقت الحالي. يرجى المحاولة لاحقاً.
              </div>
            )}
          </CardFooter>
        </Card>
      </main>

      <footer className="bg-gradient-to-r from-purple-100 to-indigo-50 text-slate-700 py-3 px-3 text-center text-xs border-t">
        <div className="container mx-auto">
          <div className="mb-2">
            <p className="font-bold mb-1 text-purple-900">مدرسة خولة بنت حكيم للتعليم الأساسي(٩-١٢)</p>
            <Separator className="my-1 bg-purple-300 mx-auto w-16" />
            <p className="font-bold text-purple-800 mb-1">أخصائيات التوجيه المهني:</p>
            <div className="flex flex-wrap justify-center gap-x-4 text-slate-700">
              <p>إيمان سعيد البهانتة</p>
              <p>فاطمة علي بيت سعيد</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <a
              href="https://x.com/edugovdhf8197?s=11"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-purple-800 hover:text-purple-900 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="w-5 h-5 fill-current"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>@khwlaschool</span>
            </a>
          </div>
          <p>© {new Date().getFullYear()} مدرسة خولة بنت حكيم للتعليم الأساسي(٩-١٢) - جميع الحقوق محفوظة</p>
          <p className="mt-1 text-purple-800 text-[10px]">
            Powered by{" "}
            <a
              href="https://www.instagram.com/nuqta_om/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-purple-900 hover:text-indigo-600 transition-colors underline decoration-2 decoration-purple-400 hover:decoration-indigo-500 underline-offset-2"
            >
              Nuqta AI
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
