import fs from "fs"
import path from "path"
import { createServiceRoleClient } from "@/lib/supabase/service"

// وظيفة لتحميل محتوى دليل الطالب: Supabase (المنشور) ثم ملف محلي
export async function loadGuideContent() {
  try {
    const svc = createServiceRoleClient()
    if (svc) {
      const { data, error } = await svc
        .from("guide_snapshots")
        .select("body")
        .eq("is_published", true)
        .limit(1)
        .maybeSingle()

      if (!error && typeof data?.body === "string" && data.body.trim().length > 0) {
        return data.body
      }
    }
  } catch (error) {
    console.error("Error loading guide from Supabase:", error)
  }

  try {
    const filePath = path.join(process.cwd(), "data", "guide-content.txt")

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8")
      if (content.trim().length > 0) {
        return content
      }
    }

    return "محتوى دليل الطالب غير متوفر حاليًا."
  } catch (error) {
    console.error("Error loading guide content:", error)
    return "حدث خطأ أثناء تحميل محتوى دليل الطالب."
  }
}

// وظيفة لحفظ محتوى دليل الطالب في ملف خارجي (نسخة احتياطية محلية)
export async function saveGuideContent(content: string) {
  try {
    const dirPath = path.join(process.cwd(), "data")
    const filePath = path.join(dirPath, "guide-content.txt")

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    fs.writeFileSync(filePath, content, "utf8")
    return true
  } catch (error) {
    console.error("Error saving guide content:", error)
    return false
  }
}
