/**
 * Auto-Reply Rule Individual Operations
 * Handles GET, PATCH, DELETE for specific rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  handleAPIError,
  successResponse,
  errorResponse,
  validateBody,
  validateParams,
  withAPIRoute,
  rateLimitConfigs,
  commonSchemas,
} from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================================================
// Validation Schemas
// ============================================================================

const updateRuleSchema = z.object({
  keyword: z.string().min(1).max(255).optional(),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'regex']).optional(),
  replyContent: z.string().min(1).max(5000).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

// ============================================================================
// GET - Get single auto-reply rule
// ============================================================================

export async function GET(
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

    // Get rule
    const rule = await prisma.auto_reply_rules.findFirst({
      where: {
        id,
        line_account_id: user.lineAccountId,
      },
    })

    if (!rule) {
      return errorResponse('Auto-reply rule not found', 404, 'NOT_FOUND')
    }

    return successResponse(rule)
  } catch (error) {
    return handleAPIError(error)
  }
}

// ============================================================================
// PATCH - Update auto-reply rule
// ============================================================================

export async function PATCH(
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

    // Validate request body
    const data = await validateBody(request, updateRuleSchema)

    // Validate regex pattern if match type is regex
    if (data.matchType === 'regex' && data.keyword) {
      try {
        new RegExp(data.keyword)
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid regex pattern',
            details: error instanceof Error ? error.message : 'Invalid regex',
          },
          { status: 400 }
        )
      }
    }

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

    // Update rule
    const rule = await prisma.auto_reply_rules.update({
      where: { id },
      data,
    })

    return successResponse(rule)
  } catch (error) {
    return handleAPIError(error)
  }
}

// ============================================================================
// DELETE - Delete auto-reply rule
// ============================================================================

export async function DELETE(
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

    // Delete rule
    await prisma.auto_reply_rules.delete({
      where: { id },
    })

    return successResponse({ message: 'Auto-reply rule deleted successfully' })
  } catch (error) {
    return handleAPIError(error)
  }
}
