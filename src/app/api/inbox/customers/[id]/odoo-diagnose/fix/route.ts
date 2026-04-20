/**
 * POST /api/inbox/customers/[id]/odoo-diagnose/fix
 *
 * One-click auto-repair for common Odoo linkage issues.
 * Body: { fixCode: AutoFixCode }
 *
 * Supported fixes:
 * - sync_member_id_from_link: copy odoo_line_users.odoo_customer_code -> users.member_id
 * - create_link_from_member_id: lookup partner via Odoo by memberId, INSERT link row
 * - relink_partner: delete stale link row, then create_link_from_member_id
 *
 * All destructive ops run inside a single transaction where possible and roll back on failure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'

type AutoFixCode =
  | 'sync_member_id_from_link'
  | 'create_link_from_member_id'
  | 'relink_partner'

interface FixResult {
  success: boolean
  fixCode: AutoFixCode
  applied: boolean
  message: string
  details?: Record<string, unknown>
}

interface OdooPartnerPayload {
  id: number
  name?: string
  partner_code?: string
  source?: 'customer_projection' | 'line_users_cache' | 'odoo_api'
}

/**
 * Look up a partner by customer code using multiple sources, in priority order:
 *  1. `odoo_customer_projection` — local cache rebuilt from Odoo webhooks (authoritative)
 *  2. `odoo_line_users` — any other LINE user already linked to this partner
 *  3. Live Odoo API via PHP bridge (last resort, can be slow/flaky)
 *
 * Returns the first match, or null if nothing found anywhere.
 */
async function lookupOdooPartnerByCode(
  memberCode: string
): Promise<OdooPartnerPayload | null> {
  // 1) odoo_customer_projection (local, fast, always fresh)
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        odoo_partner_id: number | null
        customer_name: string | null
        partner_name: string | null
        customer_ref: string | null
      }>
    >(
      `SELECT odoo_partner_id, customer_name, partner_name, customer_ref
         FROM odoo_customer_projection
        WHERE customer_ref = ? AND odoo_partner_id IS NOT NULL
        LIMIT 1`,
      memberCode
    )
    if (rows[0]?.odoo_partner_id) {
      return {
        id: rows[0].odoo_partner_id,
        name: rows[0].customer_name || rows[0].partner_name || undefined,
        partner_code: rows[0].customer_ref || memberCode,
        source: 'customer_projection',
      }
    }
  } catch (err) {
    console.warn('[odoo-diagnose/fix] customer_projection lookup failed:', err)
  }

  // 2) odoo_line_users — another LINE user may already be linked to this partner
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        odoo_partner_id: number | null
        odoo_partner_name: string | null
        odoo_customer_code: string | null
      }>
    >(
      `SELECT odoo_partner_id, odoo_partner_name, odoo_customer_code
         FROM odoo_line_users
        WHERE odoo_customer_code = ? AND odoo_partner_id IS NOT NULL
        LIMIT 1`,
      memberCode
    )
    if (rows[0]?.odoo_partner_id) {
      return {
        id: rows[0].odoo_partner_id,
        name: rows[0].odoo_partner_name || undefined,
        partner_code: rows[0].odoo_customer_code || memberCode,
        source: 'line_users_cache',
      }
    }
  } catch (err) {
    console.warn('[odoo-diagnose/fix] odoo_line_users lookup failed:', err)
  }

  // 3) Live Odoo API (last resort)
  try {
    const res = await callPhpApi<{ data?: { partner?: OdooPartnerPayload } }>(
      `/api/odoo-api.php?action=get_partner`,
      {
        method: 'POST',
        body: JSON.stringify({ partner_code: memberCode }),
      }
    )
    const partner = (res as unknown as {
      data?: { data?: { partner?: OdooPartnerPayload } }
    })?.data?.data?.partner
    if (partner && partner.id) {
      return { ...partner, source: 'odoo_api' }
    }
  } catch (err) {
    console.error('[odoo-diagnose/fix] Odoo live API lookup failed:', err)
  }

  return null
}

async function upsertOdooLink(
  lineUserId: string,
  lineAccountId: number | null,
  partner: OdooPartnerPayload,
  fallbackCode: string
) {
  const customerCode = partner.partner_code || fallbackCode
  const partnerName = partner.name || null
  // linked_via is ENUM('phone','email','customer_code') — must use a valid value.
  // 'customer_code' is semantically correct since we lookup by partner_code / customer_code.
  await prisma.$executeRawUnsafe(
    `INSERT INTO odoo_line_users
      (line_account_id, line_user_id, odoo_partner_id, odoo_partner_name, odoo_customer_code, linked_via, linked_at)
     VALUES (?, ?, ?, ?, ?, 'customer_code', NOW())
     ON DUPLICATE KEY UPDATE
       odoo_partner_id = VALUES(odoo_partner_id),
       odoo_partner_name = VALUES(odoo_partner_name),
       odoo_customer_code = VALUES(odoo_customer_code),
       linked_via = VALUES(linked_via),
       updated_at = NOW()`,
    lineAccountId ?? 1,
    lineUserId,
    partner.id,
    partnerName,
    customerCode
  )
  return { partnerId: partner.id, partnerName, customerCode }
}

export async function POST(
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

    const body = await request.json().catch(() => ({}))
    const fixCode = body?.fixCode as AutoFixCode | undefined
    if (!fixCode) {
      return NextResponse.json({ error: 'Missing fixCode' }, { status: 400 })
    }

    // Enforce account isolation for non-super-admin
    const user = await prisma.lineUser.findFirst({
      where: {
        id: userId,
        ...(session.user.role !== 'super_admin' && session.user.lineAccountId
          ? { lineAccountId: session.user.lineAccountId }
          : {}),
      },
      select: {
        id: true,
        lineAccountId: true,
        lineUserId: true,
        memberId: true,
        phone: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Lookup existing link row
    type LinkRow = {
      odoo_partner_id: number | null
      odoo_customer_code: string | null
      odoo_partner_name: string | null
    }
    let linkRow: LinkRow | null = null
    try {
      const rows = await prisma.$queryRawUnsafe<LinkRow[]>(
        `SELECT odoo_partner_id, odoo_customer_code, odoo_partner_name
         FROM odoo_line_users WHERE line_user_id = ? LIMIT 1`,
        user.lineUserId
      )
      linkRow = rows[0] || null
    } catch {
      // Table missing -> treat as no link
    }

    // Dispatch fix
    let result: FixResult

    switch (fixCode) {
      // ----------------------------------------------------------------------
      case 'sync_member_id_from_link': {
        const customerCode = linkRow?.odoo_customer_code?.trim() || null
        if (!customerCode) {
          result = {
            success: false,
            fixCode,
            applied: false,
            message:
              'ไม่พบ customer_code ใน odoo_line_users — ไม่มีอะไรให้ sync',
          }
          break
        }
        if (user.memberId && user.memberId.trim() === customerCode) {
          result = {
            success: true,
            fixCode,
            applied: false,
            message: 'users.member_id ตรงกับ customer_code อยู่แล้ว',
            details: { memberId: customerCode },
          }
          break
        }
        await prisma.lineUser.update({
          where: { id: user.id },
          data: { memberId: customerCode },
        })
        result = {
          success: true,
          fixCode,
          applied: true,
          message: `อัปเดต users.member_id = ${customerCode} เรียบร้อย`,
          details: {
            before: user.memberId,
            after: customerCode,
          },
        }
        break
      }

      // ----------------------------------------------------------------------
      case 'create_link_from_member_id': {
        const memberCode =
          user.memberId?.trim() || linkRow?.odoo_customer_code?.trim() || null
        if (!memberCode) {
          result = {
            success: false,
            fixCode,
            applied: false,
            message:
              'ไม่มีเลขสมาชิกให้ค้นหา partner — กรุณากรอก users.member_id ก่อน',
          }
          break
        }

        if (linkRow?.odoo_partner_id) {
          result = {
            success: true,
            fixCode,
            applied: false,
            message: `มี link partner_id=${linkRow.odoo_partner_id} อยู่แล้ว`,
            details: { partnerId: linkRow.odoo_partner_id },
          }
          break
        }

        const partner = await lookupOdooPartnerByCode(memberCode)
        if (!partner) {
          result = {
            success: false,
            fixCode,
            applied: false,
            message:
              `ไม่พบ partner_code = ${memberCode} ในทุกแหล่งข้อมูล ` +
              `(odoo_customer_projection, odoo_line_users, Odoo live API) — ` +
              `ตรวจสอบว่า partner มีอยู่จริงใน Odoo และ webhook ทำงานปกติ`,
          }
          break
        }

        const info = await upsertOdooLink(
          user.lineUserId,
          user.lineAccountId ?? null,
          partner,
          memberCode
        )
        // Also sync memberId if users.member_id is empty or is a MEM placeholder
        const currentMemberId = user.memberId?.trim() || null
        const isPlaceholder = currentMemberId && /^MEM\d+$/i.test(currentMemberId)
        if (!currentMemberId || isPlaceholder) {
          await prisma.lineUser.update({
            where: { id: user.id },
            data: { memberId: info.customerCode },
          })
        }
        result = {
          success: true,
          fixCode,
          applied: true,
          message: `เชื่อม LINE กับ Partner #${info.partnerId} (${info.customerCode})${partner.name ? ` — ${partner.name}` : ''} เรียบร้อย [source: ${partner.source}]`,
          details: { ...info, source: partner.source },
        }
        break
      }

      // ----------------------------------------------------------------------
      case 'relink_partner': {
        // Delete existing row, then look up again
        const memberCode =
          user.memberId?.trim() || linkRow?.odoo_customer_code?.trim() || null
        if (!memberCode) {
          result = {
            success: false,
            fixCode,
            applied: false,
            message: 'ไม่มีเลขสมาชิกให้ค้นหา partner — กรุณากรอกก่อน',
          }
          break
        }

        const partner = await lookupOdooPartnerByCode(memberCode)
        if (!partner) {
          result = {
            success: false,
            fixCode,
            applied: false,
            message: `ไม่พบ partner (${memberCode}) ในทุกแหล่งข้อมูล — ยกเลิกรีลิงก์เพื่อไม่ทำข้อมูลหาย`,
          }
          break
        }

        // Wrap delete + insert in one transaction to avoid empty window
        const info = await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `DELETE FROM odoo_line_users WHERE line_user_id = ?`,
            user.lineUserId
          )
          await tx.$executeRawUnsafe(
            `INSERT INTO odoo_line_users
              (line_account_id, line_user_id, odoo_partner_id, odoo_partner_name, odoo_customer_code, linked_via, linked_at)
             VALUES (?, ?, ?, ?, ?, 'customer_code', NOW())`,
            user.lineAccountId ?? 1,
            user.lineUserId,
            partner.id,
            partner.name || null,
            partner.partner_code || memberCode
          )
          return {
            partnerId: partner.id,
            partnerName: partner.name || null,
            customerCode: partner.partner_code || memberCode,
          }
        })

        result = {
          success: true,
          fixCode,
          applied: true,
          message: `รีลิงก์สำเร็จ → Partner #${info.partnerId} (${info.customerCode})`,
          details: info,
        }
        break
      }

      // ----------------------------------------------------------------------
      default: {
        return NextResponse.json(
          { success: false, error: `Unknown fixCode: ${fixCode}` },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 422 })
  } catch (error) {
    console.error('[odoo-diagnose/fix] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
