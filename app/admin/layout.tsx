import type React from "react"

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div dir="rtl">{children}</div>
}
