"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale/ar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type AnalyticsRow = {
  id: string
  created_at: string
  session_id: string
  user_excerpt: string | null
  assistant_excerpt: string | null
  user_message_length: number | null
  assistant_response_length: number | null
  ok: boolean
  latency_ms: number | null
  error_hint: string | null
}

function toCsv(rows: AnalyticsRow[]): string {
  const headers = [
    "id",
    "created_at",
    "session_id",
    "user_excerpt",
    "assistant_excerpt",
    "user_message_length",
    "assistant_response_length",
    "ok",
    "latency_ms",
    "error_hint",
  ]
  const escape = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.created_at,
        r.session_id,
        r.user_excerpt,
        r.assistant_excerpt,
        r.user_message_length,
        r.assistant_response_length,
        r.ok,
        r.latency_ms,
        r.error_hint,
      ]
        .map(escape)
        .join(","),
    ),
  ]
  return lines.join("\n")
}

/** تنسيق موحّد بين الخادم والمتصفح (تجنّب اختلاف Intl لـ ar-OM في Hydration). */
function formatAnalyticsTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return format(d, "Pp", { locale: ar })
}

export function AnalyticsTable({ rows }: { rows: AnalyticsRow[] }) {
  const [detail, setDetail] = useState<AnalyticsRow | null>(null)
  const csv = useMemo(() => toCsv(rows), [rows])

  const downloadCsv = () => {
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">محتوى الرسالة</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-5 text-right">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">سؤال المستخدم</p>
                <div className="rounded-md bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-950">
                  {detail.user_excerpt ? (
                    <p className="whitespace-pre-wrap">{detail.user_excerpt}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      لا يوجد نص مسجّل
                      {detail.user_message_length ? ` (${detail.user_message_length} حرفاً مسجّلة كطول فقط)` : ""}.
                      تأكد أن التخزين مفعّل ولم يُضبط ANALYTICS_CAPTURE_EXCERPT=false.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">رد المساعد</p>
                <div className="rounded-md bg-slate-50 p-3 text-sm leading-relaxed dark:bg-slate-950">
                  {detail.assistant_excerpt ? (
                    <p className="whitespace-pre-wrap">{detail.assistant_excerpt}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      لا يوجد نص مسجّل
                      {detail.assistant_response_length
                        ? ` (${detail.assistant_response_length} حرفاً مسجّلة كطول فقط)`
                        : ""}
                      .
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={rows.length === 0}>
          تصدير CSV
        </Button>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الوقت</TableHead>
              <TableHead className="text-right">نجاح</TableHead>
              <TableHead className="text-right">ms</TableHead>
              <TableHead className="text-right min-w-[220px]">محتوى الرسالة</TableHead>
              <TableHead className="text-right">session</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  لا توجد بيانات في الفترة المحددة
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatAnalyticsTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right">{r.ok ? "نعم" : "لا"}</TableCell>
                  <TableCell className="text-right">{r.latency_ms ?? "—"}</TableCell>
                  <TableCell className="text-right align-top">
                    <div className="space-y-2 max-w-md ml-auto">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">السؤال</p>
                        <p className="line-clamp-2 text-sm" title={r.user_excerpt ?? ""}>
                          {r.user_excerpt ?? (r.user_message_length ? "… (طول فقط)" : "—")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">الرد</p>
                        <p className="line-clamp-2 text-sm" title={r.assistant_excerpt ?? ""}>
                          {r.assistant_excerpt ?? (r.assistant_response_length ? "… (طول فقط)" : "—")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setDetail(r)}
                      >
                        عرض المحتوى كاملاً
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs align-top" dir="ltr">
                    {r.session_id.slice(0, 8)}…
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
