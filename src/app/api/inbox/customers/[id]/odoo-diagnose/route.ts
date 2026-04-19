/**
 * GET /api/inbox/customers/[id]/odoo-diagnose
 *
 * Comprehensive Odoo-link diagnosis for a single customer.
 * - Verifies each linking signal (lineUserId, memberId, phone, odoo_line_users row, Odoo partner)
 * - Pulls webhook_summary + warnings from PHP customer_360
 * - Optionally calls Gemini to produce a Thai-language root-cause + action list
 *
 * Response shape is stable and consumed by OdooLinkStatusCard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateAiText } from '@/lib/ai'

type FindingLevel = 'ok' | 'warning' | 'error'

interface Finding {
  level: FindingLevel
  code: string
  title: string
  detail?: string
}

export type AutoFixCode =
  | 'sync_member_id_from_link'
  | 'create_link_from_member_id'
  | 'relink_partner'

interface SuggestedAction {
  label: string
  description: string
  /** If present, frontend shows a one-click "แก้อัตโนมัติ" button that POSTs to /odoo-diagnose/fix */
  fixCode?: AutoFixCode
  /** Requires confirmation (e.g. deletes existing rows) */
  destructive?: boolean
}

interface LinkStatus {
  overall: 'linked' | 'partial' | 'unlinked'
  hasLineUserId: boolean
  hasMemberId: boolean
  hasPhone: boolean
  hasOdooLink: boolean
  hasOdooPartner: boolean
  partnerId: number | null
  partnerName: string | null
  partnerCode: string | null
  linkedVia: string | null
  linkedAt: string | null
}

interface WebhookSummary {
  total: number
  success: number
  failed: number
  retry: number
  dead_letter: number
  last_event_at: string | null
}

async function fetchCustomer360FromPhp(
  lineUserId: string,
  partnerId: number | null,
  customerRef: string | null
) {
  const phpBase =
    process.env.PHP_API_URL ||
    process.env.NEXT_PUBLIC_PHP_API_URL ||
    'https://cny.re-ya.com'
  const apiUrl = `${phpBase}/api/odoo-webhooks-dashboard.php`
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify({
        action: 'customer_360',
        line_user_id: lineUserId,
        partner_id: partnerId ? String(partnerId) : '',
        customer_ref: customerRef || '',
        orders_limit: 5,
        invoices_limit: 5,
        timeline_limit: 10,
      }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const ct = response.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const json = await response.json()
    return json?.success ? json.data : null
  } catch (err) {
    console.error('[odoo-diagnose] customer_360 fetch failed:', err)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = Number(id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const includeAi = searchParams.get('ai') !== '0'

    // --- 1) Load user record --------------------------------------------------
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        custom_display_name: true,
        firstName: true,
        lastName: true,
        memberId: true,
        phone: true,
        email: true,
        isRegistered: true,
        isBlocked: true,
        createdAt: true,
        lastInteraction: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // --- 2) Look up odoo_line_users link --------------------------------------
    type LinkRow = {
      odoo_partner_id: number | null
      odoo_partner_name: string | null
      odoo_customer_code: string | null
      linked_via: string | null
      linked_at: Date | string | null
    }
    let linkRow: LinkRow | null = null
    try {
      const rows = await prisma.$queryRawUnsafe<LinkRow[]>(
        `SELECT odoo_partner_id, odoo_partner_name, odoo_customer_code, linked_via, linked_at
         FROM odoo_line_users WHERE line_user_id = ? LIMIT 1`,
        user.lineUserId
      )
      linkRow = rows[0] || null
    } catch {
      // Table may not exist in non-prod environments
    }

    const partnerId = linkRow?.odoo_partner_id ?? null
    const partnerName = linkRow?.odoo_partner_name ?? null
    const partnerCode = linkRow?.odoo_customer_code ?? user.memberId ?? null

    // --- 3) Pull customer_360 from PHP ----------------------------------------
    const c360 = user.lineUserId
      ? await fetchCustomer360FromPhp(user.lineUserId, partnerId, partnerCode)
      : null

    const webhookSummary: WebhookSummary | null = c360?.webhook_summary
      ? {
          total: Number(c360.webhook_summary.total || 0),
          success: Number(c360.webhook_summary.success || 0),
          failed: Number(c360.webhook_summary.failed || 0),
          retry: Number(c360.webhook_summary.retry || 0),
          dead_letter: Number(c360.webhook_summary.dead_letter || 0),
          last_event_at: c360.webhook_summary.last_event_at || null,
        }
      : null

    const phpLinked = Boolean(c360?.linked)
    const rawPhpWarnings = Array.isArray(c360?.warnings)
      ? (c360!.warnings as string[])
      : []
    // Filter out informational notes that aren't real problems
    const NOISY_WARNING_PREFIXES = ['invoices_fallback', 'orders_fallback']
    const phpWarnings = rawPhpWarnings.filter(
      (w) => !NOISY_WARNING_PREFIXES.some((n) => w.startsWith(n))
    )

    // --- 4) Build link status -------------------------------------------------
    const userMemberId = user.memberId && user.memberId.trim() ? user.memberId.trim() : null
    // Effective code: users.member_id OR odoo_line_users.odoo_customer_code
    const effectiveMemberCode = userMemberId || linkRow?.odoo_customer_code || null

    const hasLineUserId = Boolean(user.lineUserId)
    const hasMemberId = Boolean(effectiveMemberCode)
    const hasPhone = Boolean(user.phone && user.phone.trim())
    const hasOdooLink = Boolean(linkRow)
    const hasOdooPartner = Boolean(partnerId && partnerId > 0)
    // users.member_id field is empty but link already has customer_code — data inconsistency
    const memberIdOutOfSync = !userMemberId && Boolean(linkRow?.odoo_customer_code)

    const overall: LinkStatus['overall'] = hasOdooPartner
      ? 'linked'
      : hasMemberId || hasOdooLink
        ? 'partial'
        : 'unlinked'

    const linkStatus: LinkStatus = {
      overall,
      hasLineUserId,
      hasMemberId,
      hasPhone,
      hasOdooLink,
      hasOdooPartner,
      partnerId,
      partnerName,
      partnerCode,
      linkedVia: linkRow?.linked_via ?? null,
      linkedAt:
        linkRow?.linked_at instanceof Date
          ? linkRow.linked_at.toISOString()
          : (linkRow?.linked_at as string | null) ?? null,
    }

    // --- 5) Build findings ----------------------------------------------------
    const findings: Finding[] = []
    const actions: SuggestedAction[] = []

    if (!hasLineUserId) {
      findings.push({
        level: 'error',
        code: 'no_line_user_id',
        title: 'ไม่มี LINE User ID',
        detail: 'ลูกค้าไม่มีรหัส LINE ในระบบ — ไม่สามารถส่งแจ้งเตือนได้เลย',
      })
    } else {
      findings.push({
        level: 'ok',
        code: 'has_line_user_id',
        title: 'มี LINE User ID',
        detail: user.lineUserId,
      })
    }

    if (!hasMemberId) {
      findings.push({
        level: 'error',
        code: 'no_member_id',
        title: 'ไม่มีเลขสมาชิก (Member ID)',
        detail:
          'ต้องมีเลขสมาชิก (PCxxxxx) เพื่อเชื่อมไปยัง Partner ใน Odoo — BDO/ยอดจะส่งไม่ได้',
      })
      actions.push({
        label: 'ขอเลขสมาชิกและกรอกในโปรไฟล์',
        description:
          'กรุณาขอเลขสมาชิกจากลูกค้าหรือระบบหลังบ้าน แล้วกรอกในช่อง “เลขสมาชิก” ของโปรไฟล์',
      })
    } else if (memberIdOutOfSync) {
      // customer_code ในแถวเชื่อมมีแล้ว แต่ช่อง users.member_id ว่าง — ข้อมูลไม่ sync กัน
      findings.push({
        level: 'warning',
        code: 'member_id_not_synced',
        title: 'เลขสมาชิกยังไม่ sync มาที่โปรไฟล์ LINE',
        detail: `ตาราง odoo_line_users มี customer_code "${linkRow!.odoo_customer_code}" แต่ช่อง “เลขสมาชิก” ของโปรไฟล์ว่าง — workflow ที่อ่านจาก users.member_id โดยตรงอาจหาไม่เจอ`,
      })
      actions.push({
        label: `sync ${linkRow!.odoo_customer_code} ลงช่องเลขสมาชิก`,
        description:
          'ระบบจะเขียน customer_code จาก odoo_line_users ลงใน users.member_id ให้อัตโนมัติ',
        fixCode: 'sync_member_id_from_link',
      })
    } else {
      findings.push({
        level: 'ok',
        code: 'has_member_id',
        title: 'มีเลขสมาชิก',
        detail: effectiveMemberCode!,
      })
    }

    if (!hasPhone) {
      findings.push({
        level: 'warning',
        code: 'no_phone',
        title: 'ไม่มีเบอร์โทร',
        detail:
          'บางขั้นตอน (เช่น ยืนยันตัวตน, การจับคู่ Partner โดยอัตโนมัติ) ต้องใช้เบอร์โทร',
      })
    }

    if (hasMemberId && !hasOdooLink) {
      findings.push({
        level: 'warning',
        code: 'no_odoo_link_row',
        title: 'ยังไม่ได้บันทึกความสัมพันธ์ใน odoo_line_users',
        detail:
          'มีเลขสมาชิกแล้ว แต่ยังไม่มีแถวเชื่อม LINE↔Partner — ระบบจะลองเชื่อมอัตโนมัติเมื่อเรียก Odoo ครั้งต่อไป',
      })
      actions.push({
        label: `เชื่อม LINE ↔ Partner ด้วย ${effectiveMemberCode}`,
        description:
          'ระบบจะเรียก Odoo เพื่อหา partner ด้วย memberId แล้วบันทึกความสัมพันธ์ใน odoo_line_users ให้เลย',
        fixCode: 'create_link_from_member_id',
      })
    }

    if (hasOdooLink && !hasOdooPartner) {
      findings.push({
        level: 'error',
        code: 'link_row_without_partner',
        title: 'มีแถวเชื่อมแต่ไม่พบ partner_id',
        detail:
          'อาจเป็น partner ถูกลบ/รวมใน Odoo หรือข้อมูลในตาราง odoo_line_users เสียหาย',
      })
      actions.push({
        label: 'รีลิงก์ Partner ใหม่',
        description:
          'ล้างแถวเดิมใน odoo_line_users แล้วค้นหา partner ด้วย memberId หรือเบอร์โทรอีกครั้ง (destructive)',
        fixCode: 'relink_partner',
        destructive: true,
      })
    }

    if (hasOdooPartner) {
      findings.push({
        level: 'ok',
        code: 'has_odoo_partner',
        title: 'เชื่อมกับ Odoo Partner แล้ว',
        detail: `#${partnerId}${partnerCode ? ` (${partnerCode})` : ''}${partnerName ? ` — ${partnerName}` : ''}`,
      })
    } else {
      findings.push({
        level: 'error',
        code: 'no_odoo_partner',
        title: 'ยังไม่เชื่อมกับโปรไฟล์ Odoo',
        detail:
          'ผลคือ: ส่งแจ้งเตือน BDO ไม่ได้, ส่งยอดไม่ได้, Customer 360 ไม่โชว์ประวัติการซื้อ',
      })
    }

    if (webhookSummary && webhookSummary.failed > 0) {
      findings.push({
        level: 'error',
        code: 'webhook_failed',
        title: `มี webhook ที่ล้มเหลว ${webhookSummary.failed} รายการ`,
        detail: webhookSummary.last_event_at
          ? `ล่าสุดเมื่อ ${webhookSummary.last_event_at}`
          : undefined,
      })
    }
    if (webhookSummary && webhookSummary.dead_letter > 0) {
      findings.push({
        level: 'error',
        code: 'webhook_dlq',
        title: `มี event ค้างใน DLQ ${webhookSummary.dead_letter} รายการ`,
        detail:
          'ต้องเข้าไปรีทรายใน Odoo Webhook Dashboard หรือให้ดีเวลอปเปอร์ตรวจสอบสาเหตุ',
      })
      actions.push({
        label: 'ตรวจ Dead-Letter Queue ของลูกค้ารายนี้',
        description:
          'เปิด Odoo Webhook Dashboard → DLQ แล้วกรองด้วย line_user_id หรือ partner_id',
      })
    }

    for (const w of phpWarnings) {
      findings.push({
        level: 'warning',
        code: 'php_warning',
        title: 'คำเตือนจากระบบหลังบ้าน',
        detail: w,
      })
    }

    if (user.isBlocked) {
      findings.push({
        level: 'error',
        code: 'user_blocked',
        title: 'ลูกค้าถูกบล็อกใน LINE',
        detail:
          'จะไม่สามารถส่งแจ้งเตือนใด ๆ ผ่าน LINE ได้จนกว่าจะยกเลิกการบล็อก',
      })
    }

    // --- 6) Optional AI diagnosis --------------------------------------------
    let aiDiagnosis: string | null = null
    let aiError: string | null = null

    if (includeAi) {
      try {
        const customerLabel =
          user.custom_display_name ||
          user.displayName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          `user#${user.id}`
        const findingsText = findings
          .map(
            (f, i) =>
              `  ${i + 1}. [${f.level.toUpperCase()}] ${f.title}${f.detail ? ` — ${f.detail}` : ''}`
          )
          .join('\n')

        const prompt = `คุณเป็นผู้เชี่ยวชาญด้าน ERP/LINE integration สำหรับร้านยา ช่วยวินิจฉัย\nว่าลูกค้า "${customerLabel}" มีปัญหาใดบ้างในการเชื่อมกับ Odoo และ/หรือ\nการส่งแจ้งเตือน BDO / ส่งยอด โดยใช้ข้อมูลต่อไปนี้เท่านั้น (ห้ามแต่งข้อเท็จจริง):\n\n== สรุปสถานะ (overall=${overall}) ==\n- LINE User ID: ${user.lineUserId || '(ไม่มี)'}\n- users.member_id (field ในตารางลูกค้า): ${userMemberId || '(ว่าง)'}\n- odoo_line_users.odoo_customer_code: ${linkRow?.odoo_customer_code || '(ไม่มี)'}\n- Effective member code ที่ระบบใช้งานได้: ${effectiveMemberCode || '(ไม่มี)'}\n- เบอร์โทร: ${user.phone || '(ไม่มี)'}\n- แถวใน odoo_line_users: ${hasOdooLink ? 'yes' : 'no'}\n- Odoo partner_id: ${partnerId ?? '(ไม่มี)'}\n- Odoo partner_name: ${partnerName ?? '(ไม่มี)'}\n- PHP customer_360 linked: ${phpLinked}\n- Webhook summary: ${webhookSummary ? `total=${webhookSummary.total}, success=${webhookSummary.success}, failed=${webhookSummary.failed}, dlq=${webhookSummary.dead_letter}, last=${webhookSummary.last_event_at || '-'}` : '(ไม่มี)'}\n- ลูกค้าถูกบล็อก: ${user.isBlocked ? 'yes' : 'no'}\n\n== รายการตรวจที่ระบบสรุปแล้ว ==\n${findingsText || '  (ไม่มี)'}\n\n== กฎสำคัญที่ต้องจำ ==\n- ถ้า overall=linked แปลว่าเชื่อม partner แล้ว → BDO/ยอด "ส่งได้" อย่าบอกว่าส่งไม่ได้\n- ถ้า userMemberId ว่างแต่ odoo_customer_code มี → เป็นปัญหาข้อมูลไม่ sync (warning) ไม่ใช่ปัญหาเชื่อม\n- ตอบตรงกับสถานะจริง ไม่ย้ำปัญหาที่ระบบแก้ไปแล้ว\n\n== รูปแบบคำตอบ (ภาษาไทย, bullet Markdown, ≤8 บรรทัด) ==\n- **สาเหตุหลัก:** ... (ถ้าไม่มีปัญหา ให้บอกว่า “ไม่มีปัญหาหลัก”)\n- **ผลกระทบ:** ... (อิงจากสถานะจริง)\n- **ขั้นตอนแก้ไข:** 1) ... 2) ... 3) ...\n- **วิธีป้องกัน:** ... (ถ้ามี)`

        aiDiagnosis = await generateAiText({
          parts: [{ text: prompt }],
          systemPrompt:
            'คุณคือผู้เชี่ยวชาญ Odoo ERP + LINE OA สำหรับร้านยา ตอบสั้น ตรงประเด็น ใช้ข้อมูลที่ให้เท่านั้น ห้ามแต่งข้อเท็จจริง',
          temperature: 0.2,
          maxTokens: 500,
        })
      } catch (err) {
        aiError =
          err instanceof Error ? err.message : 'AI diagnosis failed'
        console.error('[odoo-diagnose] AI error:', err)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        customer: {
          displayName:
            user.custom_display_name || user.displayName || null,
          lineUserId: user.lineUserId,
          memberId: user.memberId,
          phone: user.phone,
        },
        linkStatus,
        webhookSummary,
        findings,
        suggestedActions: actions,
        aiDiagnosis,
        aiError,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[odoo-diagnose] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
