"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Search, Sparkles, BookOpen, GraduationCap, School } from "lucide-react"

export function WelcomeDialog() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // التحقق مما إذا كان المستخدم قد رأى الصفحة المنبثقة من قبل
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcome")
    // فقط إذا لم يسبق للمستخدم رؤية البطاقة، سيتم عرضها
    if (!hasSeenWelcome) {
      setIsOpen(true)
    } else {
      // التأكد من أن البطاقة مغلقة للمستخدمين العائدين
      setIsOpen(false)
    }
  }, [])

  const handleClose = () => {
    // تخزين أن المستخدم قد رأى الصفحة المنبثقة بشكل دائم
    localStorage.setItem("hasSeenWelcome", "true")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[600px] p-0 overflow-hidden bg-gradient-to-br from-white to-purple-50"
        dir="rtl"
      >
        <DialogHeader className="p-4 pb-2 bg-gradient-to-r from-purple-100 to-indigo-50">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-purple-900 flex items-center justify-center gap-2">
            <School className="h-5 w-5 sm:h-6 sm:w-6 text-purple-800" />
            <span>
              Admission
              <br />
              المساعد الذكي للقبول الموحد
            </span>
          </DialogTitle>
          <DialogDescription className="text-center text-slate-700 text-sm sm:text-base">
            دليلك الذكي للإجابة على جميع استفساراتك حول القبول الموحد
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="features">المميزات</TabsTrigger>
            <TabsTrigger value="howto">طريقة الاستخدام</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-purple-900">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-purple-800" />
                    <span>محادثة ذكية</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-1 px-3">
                  <p className="text-xs sm:text-sm text-slate-700">
                    تفاعل مع مساعد ذكي يجيب على جميع أسئلتك حول القبول الموحد بدقة وسرعة.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-purple-900">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-purple-800" />
                    <span>معلومات شاملة</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-1 px-3">
                  <p className="text-xs sm:text-sm text-slate-700">
                    احصل على معلومات دقيقة من دليل القبول الموحد الرسمي لمؤسسات التعليم العالي.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-purple-900">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-800" />
                    <span>دليل متكامل</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-1 px-3">
                  <p className="text-xs sm:text-sm text-slate-700">
                    يغطي جميع جوانب القبول الموحد من التخصصات والشروط إلى إجراءات التسجيل والمفاضلة.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-purple-900">
                    <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-800" />
                    <span>توجيه مهني</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-1 px-3">
                  <p className="text-xs sm:text-sm text-slate-700">
                    مصمم لمساعدتك في اتخاذ القرارات المناسبة لمستقبلك الأكاديمي.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="howto" className="p-3 sm:p-4">
            <Card>
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-lg sm:text-xl text-purple-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-800" />
                  <span>كيفية استخدام المساعد</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-700">
                  استفد من مساعد القبول الموحد بأقصى درجة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 py-1 px-3">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-purple-900">1. اطرح سؤالك</h3>
                  <p className="text-xs sm:text-sm text-slate-700">
                    اكتب سؤالك في حقل الإدخال أسفل الشاشة واضغط على زر "إرسال".
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-purple-900">2. أسئلة مقترحة</h3>
                  <p className="text-xs sm:text-sm text-slate-700">يمكنك سؤال المساعد عن:</p>
                  <ul className="text-xs sm:text-sm text-slate-700 list-disc list-inside space-y-1">
                    <li>شروط القبول في تخصص معين</li>
                    <li>المؤسسات التي تقدم تخصصًا محددًا</li>
                    <li>مواعيد التسجيل والقبول</li>
                    <li>كيفية حساب النسبة الموزونة</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-purple-900">3. متابعة المحادثة</h3>
                  <p className="text-xs sm:text-sm text-slate-700">
                    يمكنك متابعة المحادثة وطرح أسئلة إضافية للحصول على مزيد من التفاصيل.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-indigo-50">
          <Button onClick={handleClose} className="w-full bg-purple-800 hover:bg-purple-900">
            ابدأ الاستخدام الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
