/**
 * Input Validation Schemas
 * Zod schemas for validating user input across the application
 */

import { z } from 'zod'

// ============================================================================
// Common Validation Schemas
// ============================================================================

export const idSchema = z.number().int().positive()
export const stringIdSchema = z.string().min(1)
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^[0-9]{9,10}$/, 'Invalid phone number')
export const urlSchema = z.string().url()

// ============================================================================
// Message Validation
// ============================================================================

export const messageContentSchema = z.object({
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message is too long (max 5000 characters)'),
  type: z.enum(['text', 'image', 'file', 'flex']).default('text'),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  content: z.string().min(1).max(5000),
  type: z.enum(['text', 'image', 'file', 'flex']).default('text'),
  replyToken: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// ============================================================================
// Conversation Validation
// ============================================================================

export const conversationStatusSchema = z.enum(['new', 'in_progress', 'waiting', 'resolved'])

export const updateConversationStatusSchema = z.object({
  status: conversationStatusSchema,
  note: z.string().max(500).optional(),
})

export const conversationFilterSchema = z.object({
  status: conversationStatusSchema.optional(),
  tagIds: z.array(idSchema).optional(),
  assigneeIds: z.array(idSchema).optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  unreadOnly: z.boolean().optional(),
  hasRedFlag: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

// ============================================================================
// Auto-Reply Rules Validation
// ============================================================================

export const autoReplyRuleSchema = z.object({
  keyword: z.string()
    .min(1, 'Keyword is required')
    .max(255, 'Keyword is too long'),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'regex']),
  replyContent: z.string()
    .min(1, 'Reply content is required')
    .max(5000, 'Reply content is too long'),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
})

export const updateAutoReplyRuleSchema = autoReplyRuleSchema.partial()

// ============================================================================
// Quick Reply Templates Validation
// ============================================================================

export const quickReplyTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(100, 'Template name is too long'),
  content: z.string()
    .min(1, 'Template content is required')
    .max(5000, 'Template content is too long'),
  category: z.string().max(50).optional(),
  shortcuts: z.array(z.string().max(20)).max(5).optional(),
  variables: z.array(z.string().max(50)).max(10).optional(),
})

export const updateQuickReplyTemplateSchema = quickReplyTemplateSchema.partial()

// ============================================================================
// Customer Notes & Tags Validation
// ============================================================================

export const customerNoteSchema = z.object({
  content: z.string()
    .min(1, 'Note content is required')
    .max(2000, 'Note is too long'),
  isPrivate: z.boolean().default(false),
})

export const updateCustomerNoteSchema = z.object({
  content: z.string().min(1).max(2000),
})

export const customerTagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name is too long')
    .regex(/^[a-zA-Z0-9-_\u0E00-\u0E7F\s]+$/, 'Invalid tag name'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
})

// ============================================================================
// Customer Segments Validation
// ============================================================================

export const segmentCriteriaSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in']),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
})

export const customerSegmentSchema = z.object({
  name: z.string()
    .min(1, 'Segment name is required')
    .max(100, 'Segment name is too long'),
  criteria: z.array(segmentCriteriaSchema).min(1, 'At least one criterion is required'),
  logic: z.enum(['AND', 'OR']).default('AND'),
})

export const updateCustomerSegmentSchema = customerSegmentSchema.partial()

// ============================================================================
// Broadcast Messages Validation
// ============================================================================

export const broadcastMessageSchema = z.object({
  content: z.string()
    .min(1, 'Broadcast content is required')
    .max(5000, 'Broadcast content is too long'),
  mediaUrl: z.string().url().optional(),
  targetSegmentId: idSchema.optional(),
  targetUserIds: z.array(idSchema).optional(),
  scheduledAt: z.string().datetime().optional(),
})
  .refine(
    (data) => data.targetSegmentId || (data.targetUserIds && data.targetUserIds.length > 0),
    { message: 'Either targetSegmentId or targetUserIds must be provided' }
  )

// ============================================================================
// Health Profile Validation
// ============================================================================

export const healthProfileSchema = z.object({
  allergies: z.array(z.string().max(100)).max(20).optional(),
  conditions: z.array(z.string().max(100)).max(20).optional(),
  currentMedications: z.array(z.string().max(100)).max(50).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  weight: z.number().positive().max(500).optional(),
  height: z.number().positive().max(300).optional(),
})

// ============================================================================
// Prescription Validation
// ============================================================================

export const prescriptionSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  status: z.enum(['pending', 'dispensed', 'expired']).default('pending'),
  notes: z.string().max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
})

export const updatePrescriptionSchema = z.object({
  status: z.enum(['pending', 'dispensed', 'expired']).optional(),
  notes: z.string().max(1000).optional(),
})

// ============================================================================
// Points & Rewards Validation
// ============================================================================

export const adjustPointsSchema = z.object({
  amount: z.number().int()
    .min(-100000, 'Adjustment amount too low')
    .max(100000, 'Adjustment amount too high'),
  reason: z.string()
    .min(1, 'Reason is required')
    .max(200, 'Reason is too long'),
  type: z.enum(['manual_add', 'manual_deduct', 'correction', 'bonus']),
})

// ============================================================================
// File Upload Validation
// ============================================================================

export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(file.type),
      'Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed'
    ),
  conversationId: idSchema,
})

// ============================================================================
// Scheduled Messages Validation
// ============================================================================

export const scheduledMessageSchema = z.object({
  conversationId: idSchema,
  content: z.string().min(1).max(5000),
  scheduledAt: z.string().datetime()
    .refine(
      (date) => new Date(date) > new Date(),
      'Scheduled time must be in the future'
    ),
})

// ============================================================================
// Rich Menu Validation
// ============================================================================

export const richMenuSchema = z.object({
  name: z.string().min(1).max(100),
  layout: z.object({
    type: z.enum(['2x2', '3x3', 'custom']),
    areas: z.array(z.object({
      bounds: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
      action: z.object({
        type: z.enum(['uri', 'message', 'postback']),
        label: z.string().max(20).optional(),
        data: z.string().max(300),
      }),
    })),
  }),
  imageUrl: z.string().url(),
})

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate data against schema and return typed result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Validate data and return result with errors
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error }
}

/**
 * Get user-friendly error messages from Zod errors
 */
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  
  error.issues.forEach((err) => {
    const path = err.path.join('.')
    errors[path] = err.message
  })
  
  return errors
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((err) => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
    return `${path}${err.message}`
  })
}
