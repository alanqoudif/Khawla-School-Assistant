import { type NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  PINECONE_DASHBOARD_BILLING_KEY,
  parseDashboardBillingRowValue,
} from "@/lib/pinecone-billing-settings"
import { getAdminContext } from "@/lib/supabase/admin"
import { createServiceRoleClient } from "@/lib/supabase/service"
import { invalidatePineconeCredentialsCache, getPineconeCredentials } from "@/lib/pinecone-credentials"

const KEYS = {
  apiKey: "pinecone_api_key",
  assistantId: "pinecone_assistant_id",
} as const

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: "غير مصرح" }, { status: ctx.reason === "unconfigured" ? 503 : 401 })
  }

  const creds = await getPineconeCredentials()
  const envHasKey = Boolean(process.env.PINECONE_API_KEY?.trim())

  const svc = createServiceRoleClient()
  const serverCanReadDbSecrets = Boolean(svc)
  let storedKeyInDb = false
  let dashboardBilling: {
    remainingUsd: number | null
    trialStartDate: string | null
    trialBudgetUsd: number | null
    trialDays: number | null
  } | null = null

  if (svc) {
    const { data } = await svc.from("site_settings").select("key").eq("key", KEYS.apiKey).maybeSingle()
    storedKeyInDb = Boolean(data)

    const { data: billRow } = await svc
      .from("site_settings")
      .select("value")
      .eq("key", PINECONE_DASHBOARD_BILLING_KEY)
      .maybeSingle()
    if (billRow?.value) {
      const p = parseDashboardBillingRowValue(billRow.value)
      dashboardBilling = {
        remainingUsd: typeof p.remainingUsd === "number" ? p.remainingUsd : null,
        trialStartDate: p.trialStartDate ?? null,
        trialBudgetUsd: p.trialBudgetUsd ?? null,
        trialDays: p.trialDays ?? null,
      }
    }
  }

  return NextResponse.json({
    assistantId: creds.assistantId,
    hasApiKey: Boolean(creds.apiKey),
    apiKeyStoredInDatabase: storedKeyInDb,
    envProvidesApiKey: envHasKey,
    serverCanReadDbSecrets,
    dashboardBilling,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: "غير مصرح" }, { status: ctx.reason === "unconfigured" ? 503 : 401 })
  }

  const svc = createServiceRoleClient()
  if (!svc) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY غير مضبوط — لا يمكن حفظ الإعدادات في قاعدة البيانات" },
      { status: 503 },
    )
  }

  let body: {
    assistantId?: unknown
    pineconeApiKey?: unknown
    clearPineconeApiKey?: unknown
    dashboardBilling?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON غير صالح" }, { status: 400 })
  }

  const assistantId =
    typeof body.assistantId === "string" ? body.assistantId.trim() : typeof body.assistantId === "number" ? String(body.assistantId) : ""

  if (!assistantId) {
    return NextResponse.json({ error: "معرّف المساعد (PINECONE_ASSISTANT_ID) مطلوب" }, { status: 400 })
  }

  const { error: e1 } = await svc.from("site_settings").upsert(
    {
      key: KEYS.assistantId,
      value: { value: assistantId },
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    },
    { onConflict: "key" },
  )
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 })
  }

  if (body.clearPineconeApiKey === true) {
    await svc.from("site_settings").delete().eq("key", KEYS.apiKey)
  } else if (typeof body.pineconeApiKey === "string") {
    const k = body.pineconeApiKey.trim()
    if (k.length > 0) {
      const { error: e2 } = await svc.from("site_settings").upsert(
        {
          key: KEYS.apiKey,
          value: { value: k },
          updated_at: new Date().toISOString(),
          updated_by: ctx.userId,
        },
        { onConflict: "key" },
      )
      if (e2) {
        return NextResponse.json({ error: e2.message }, { status: 500 })
      }
    }
  }

  if ("dashboardBilling" in body && body.dashboardBilling !== undefined) {
    const raw = body.dashboardBilling
    if (raw === null) {
      await svc.from("site_settings").delete().eq("key", PINECONE_DASHBOARD_BILLING_KEY)
    } else if (raw && typeof raw === "object") {
      const r = raw as Record<string, unknown>
      const payload: Record<string, unknown> = {}

      if ("remainingUsd" in r) {
        if (r.remainingUsd === null || r.remainingUsd === "") {
          payload.remainingUsd = null
        } else {
          const n = typeof r.remainingUsd === "number" ? r.remainingUsd : Number(String(r.remainingUsd).trim())
          if (Number.isFinite(n) && n >= 0) payload.remainingUsd = n
        }
      }

      if ("trialStartDate" in r) {
        const s = typeof r.trialStartDate === "string" ? r.trialStartDate.trim() : ""
        payload.trialStartDate = s === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
      }

      if ("trialBudgetUsd" in r) {
        if (r.trialBudgetUsd === null || r.trialBudgetUsd === "") {
          payload.trialBudgetUsd = null
        } else {
          const n = typeof r.trialBudgetUsd === "number" ? r.trialBudgetUsd : Number(String(r.trialBudgetUsd).trim())
          if (Number.isFinite(n) && n > 0) payload.trialBudgetUsd = n
        }
      }

      if ("trialDays" in r) {
        if (r.trialDays === null || r.trialDays === "") {
          payload.trialDays = null
        } else {
          const n = typeof r.trialDays === "number" ? r.trialDays : Number(String(r.trialDays).trim())
          if (Number.isFinite(n) && n > 0) payload.trialDays = Math.floor(n)
        }
      }

      const { error: eBill } = await svc.from("site_settings").upsert(
        {
          key: PINECONE_DASHBOARD_BILLING_KEY,
          value: { value: payload },
          updated_at: new Date().toISOString(),
          updated_by: ctx.userId,
        },
        { onConflict: "key" },
      )
      if (eBill) {
        return NextResponse.json({ error: eBill.message }, { status: 500 })
      }
    }
  }

  invalidatePineconeCredentialsCache()
  revalidatePath("/admin")
  revalidatePath("/admin/analytics")
  return NextResponse.json({ ok: true })
}
