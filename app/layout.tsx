import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { ThemeProvider } from "@/components/theme-provider"

const GA_MEASUREMENT_ID = "G-VQ82JNEP2W"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f766e",
}

export const metadata: Metadata = {
  title: "Admission المساعد الذكي للقبول الموحد",
  description: "مساعد ذكي للإجابة على أسئلتك حول القبول الموحد لمؤسسات التعليم العالي في سلطنة عُمان",
  generator: "v0.dev",
  icons: {
    icon: "/placeholder-logo.png",
  },
  verification: {
    google: "GxB_jPD0RbHID7iaslnrJ5n_b-UMmt5QoOrHB69HM84",
  },
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
        {/* Google tag (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
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
