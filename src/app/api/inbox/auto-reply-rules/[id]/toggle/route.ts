/**
 * Auto-Reply Rule Toggle Active Status
 * Quick endpoint to enable/disable a rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  handleAPIError,
  successResponse,
  errorResponse,
  validateParams,
  commonSchemas,
} from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================================================
// POST - Toggle rule active status
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsValue = await params;
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Validate params
    const { id } = validateParams(paramsValue, commonSchemas.id)

    // Check if rule exists and belongs to user's LINE account
    const existingRule = await prisma.auto_reply_rules.findFirst({
      where: {
        id,
        line_account_id: user.lineAccountId,
      },
    })

    if (!existingRule) {
      return errorResponse('Auto-reply rule not found', 404, 'NOT_FOUND')
    }

    // Toggle active status
    const rule = await prisma.auto_reply_rules.update({
      where: { id },
      data: {
        is_active: !existingRule.is_active,
      },
    })

    return successResponse({
      rule,
      message: `Rule ${rule.is_active ? 'enabled' : 'disabled'} successfully`,
    })
  } catch (error) {
    return handleAPIError(error)
  }
}
