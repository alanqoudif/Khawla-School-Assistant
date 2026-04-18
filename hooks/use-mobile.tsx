"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // تحديد ما إذا كان الجهاز محمولاً عند التحميل
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // التحقق عند التحميل
    checkMobile()

    // إضافة مستمع لتغيير حجم النافذة
    window.addEventListener("resize", checkMobile)

    // إزالة المستمع عند تفكيك المكون
    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  return isMobile
}

/** Alias expected by shadcn `Sidebar` (`components/ui/sidebar.tsx`). */
export function useIsMobile() {
  return useMobile()
}
