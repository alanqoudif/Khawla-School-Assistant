import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
// إضافة استيراد مكون MetaViewport
import MetaViewport from "./meta-viewport"

export const metadata: Metadata = {
  title: "Admission المساعد الذكي للقبول الموحد",
  description: "مساعد ذكي للإجابة على أسئلتك حول القبول الموحد لمؤسسات التعليم العالي في سلطنة عُمان",
    generator: 'v0.dev'
}

// تحديث الـ head لإضافة meta tags للجوال
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <MetaViewport />
      </head>
      <body>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="light" 
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
