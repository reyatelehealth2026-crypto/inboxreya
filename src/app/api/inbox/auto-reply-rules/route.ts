/**
 * Auto-Reply Rules API Routes
 * Handles CRUD operations for auto-reply rules
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  handleAPIError,
  successResponse,
  validateBody,
  validateQuery,
  withAPIRoute,
  rateLimitConfigs,
  commonSchemas,
} from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================================================
// Validation Schemas
// ============================================================================

const createRuleSchema = z.object({
  keyword: z.string().min(1).max(255),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'regex']),
  replyContent: z.string().min(1).max(5000),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(100).optional().default(0),
})

const updateRuleSchema = z.object({
  keyword: z.string().min(1).max(255).optional(),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'regex']).optional(),
  replyContent: z.string().min(1).max(5000).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

const listRulesQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// ============================================================================
// GET - List all auto-reply rules
// ============================================================================

export const GET = withAPIRoute(
  async (request: NextRequest) => {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Validate query parameters
    const query = validateQuery(request, listRulesQuerySchema)
    const { search, isActive, page, limit } = query

    // Build where clause
    const where: any = {
      line_account_id: user.lineAccountId,
    }

    // Filter by active status
    if (isActive !== 'all') {
      where.is_active = isActive === 'true'
    }

    // Search by keyword or reply content
    if (search) {
      where.OR = [
        { keyword: { contains: search } },
        { response_content: { contains: search } },
      ]
    }

    // Get total count
    const total = await prisma.auto_reply_rules.count({ where })

    // Get rules with pagination
    const rules = await prisma.auto_reply_rules.findMany({
      where,
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { created_at: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    })

    return successResponse({
      rules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  },
  {
    rateLimit: rateLimitConfigs.standard,
    requireAuth: true,
  }
)

// ============================================================================
// POST - Create new auto-reply rule
// ============================================================================

export const POST = withAPIRoute(
  async (request: NextRequest) => {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Validate request body
    const data = await validateBody(request, createRuleSchema)

    // Validate regex pattern if match type is regex
    if (data.matchType === 'regex') {
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

    // Create rule
    const rule = await prisma.auto_reply_rules.create({
      data: {
        line_account_id: user.lineAccountId,
        keyword: data.keyword,
        match_type: data.matchType,
        response_content: data.replyContent,
        is_active: data.isActive,
        priority: data.priority,
      },
    })

    return successResponse(rule, 201)
  },
  {
    rateLimit: rateLimitConfigs.standard,
    requireAuth: true,
  }
)
