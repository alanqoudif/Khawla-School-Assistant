"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export function GuideEditor() {
  const [guideContent, setGuideContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const { data, error } = await supabase
          .from("guide_snapshots")
          .select("body")
          .eq("is_published", true)
          .limit(1)
          .maybeSingle()

        if (cancelled) return
        if (error) {
          toast({
            title: "تعذر التحميل",
            description: error.message,
            variant: "destructive",
          })
          return
        }
        setGuideContent(data?.body ?? "")
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "خطأ",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    if (!guideContent.trim()) {
      toast({
        title: "خطأ",
        description: "لا يمكن حفظ محتوى فارغ",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "انتهت الجلسة", description: "أعد تسجيل الدخول", variant: "destructive" })
        return
      }

      const { error } = await supabase
        .from("guide_snapshots")
        .update({
          body: guideContent,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("is_published", true)

      if (error) {
        toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" })
        return
      }

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث محتوى الدليل في Supabase",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "خطأ في الحفظ",
        description: error instanceof Error ? error.message : "حدث خطأ",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">جاري التحميل...</CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl text-right">إدارة محتوى دليل الطالب</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">
              النص المحفوظ هنا هو المصدر في قاعدة البيانات. تحديث قاعدة معرفة Pinecone يتم بشكل منفصل عند
              الحاجة.
            </p>
          </div>

          <Textarea
            dir="rtl"
            value={guideContent}
            onChange={(e) => setGuideContent(e.target.value)}
            placeholder="انسخ النص الكامل لدليل الطالب هنا..."
            className="min-h-[500px] text-right"
          />

          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "جاري الحفظ..." : "حفظ المحتوى"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
