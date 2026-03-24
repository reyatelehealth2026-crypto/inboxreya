import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

/**
 * GET /api/inbox/customers/[id]/odoo-partner
 *
 * "API Once & Local Sync" partner lookup:
 * 1. Check odoo_line_users for existing partner_id
 * 2. If not found, call Odoo API with memberId
 * 3. Store result locally for future use
 */
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

    // Get lineUserId and memberId from DB
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { lineUserId: true, memberId: true },
    })

    if (!user?.lineUserId) {
      return NextResponse.json({
        success: true,
        data: { partnerId: null, partnerName: null, customerCode: null },
      })
    }

    // Step 1: Check odoo_line_users for existing link
    const existingLink = await prisma.$queryRawUnsafe<Array<{
      odoo_partner_id: number
      odoo_partner_name: string | null
      odoo_customer_code: string | null
    }>>(
      `SELECT odoo_partner_id, odoo_partner_name, odoo_customer_code 
       FROM odoo_line_users 
       WHERE line_user_id = ? 
       LIMIT 1`,
      user.lineUserId
    )

    if (existingLink.length > 0 && existingLink[0].odoo_partner_id) {
      return NextResponse.json({
        success: true,
        data: {
          partnerId: existingLink[0].odoo_partner_id,
          partnerName: existingLink[0].odoo_partner_name,
          customerCode: existingLink[0].odoo_customer_code,
        },
      })
    }

    // Step 2: API Fallback — call Odoo API with memberId
    const memberCode = user.memberId
    if (!memberCode) {
      return NextResponse.json({
        success: true,
        data: { partnerId: null, partnerName: null, customerCode: null },
      })
    }

    try {
      const odooResult = await callPhpApi(
        `/api/odoo-api.php?action=get_partner`,
        {
          method: 'POST',
          body: JSON.stringify({ partner_code: memberCode }),
        }
      )

      if (odooResult.success && odooResult.data?.data?.partner) {
        const partner = odooResult.data.data.partner
        const partnerId = partner.id
        const partnerName = partner.name || null
        const customerCode = partner.partner_code || memberCode

        // Step 3: Store in odoo_line_users for future lookups
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO odoo_line_users 
              (line_account_id, line_user_id, odoo_partner_id, odoo_partner_name, odoo_customer_code, linked_via, linked_at) 
             VALUES (1, ?, ?, ?, ?, 'customer_code', NOW())
             ON DUPLICATE KEY UPDATE 
              odoo_partner_id = VALUES(odoo_partner_id),
              odoo_partner_name = VALUES(odoo_partner_name),
              odoo_customer_code = VALUES(odoo_customer_code),
              updated_at = NOW()`,
            user.lineUserId,
            partnerId,
            partnerName,
            customerCode
          )
        } catch (storeErr) {
          console.error('[odoo-partner] Error storing link:', storeErr)
          // Non-fatal — still return the data
        }

        return NextResponse.json({
          success: true,
          data: { partnerId, partnerName, customerCode },
        })
      }
    } catch (apiErr) {
      console.error('[odoo-partner] Odoo API error:', apiErr)
    }

    return NextResponse.json({
      success: true,
      data: { partnerId: null, partnerName: null, customerCode: null },
    })
  } catch (error) {
    console.error('[odoo-partner] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
