import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdminContext } from "@/lib/supabase/admin"
import { loadGuideContent, saveGuideContent } from "@/utils/guide-loader"

// API لاسترجاع محتوى دليل الطالب
export async function GET() {
  try {
    const content = await loadGuideContent()
    return NextResponse.json({ content })
  } catch (error) {
    console.error("Error fetching guide content:", error)
    return NextResponse.json({ error: "حدث خطأ أثناء استرجاع محتوى دليل الطالب" }, { status: 500 })
  }
}

// API لحفظ محتوى دليل الطالب (يتطلب جلسة إدارية + Supabase)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx.ok) {
      const status = ctx.reason === "unconfigured" ? 503 : 401
      return NextResponse.json({ error: "غير مصرح بحفظ المحتوى" }, { status })
    }

    const { content } = await req.json()

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "المحتوى غير صالح" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from("guide_snapshots")
      .update({
        body: content,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      })
      .eq("is_published", true)

    if (dbError) {
      console.error("guide-content POST db:", dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    const fileOk = await saveGuideContent(content)
    if (!fileOk) {
      return NextResponse.json(
        { message: "تم الحفظ في Supabase لكن فشل النسخ الاحتياطي على الملف المحلي" },
        { status: 207 },
      )
    }

    return NextResponse.json({ message: "تم حفظ المحتوى بنجاح" })
  } catch (error) {
    console.error("Error saving guide content:", error)
    return NextResponse.json({ error: "حدث خطأ أثناء حفظ محتوى دليل الطالب" }, { status: 500 })
  }
}
