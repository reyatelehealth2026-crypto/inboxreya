/**
 * Auto-Reply Rule Matching Logic
 * Matches incoming messages against auto-reply rules
 */

import { prisma } from './prisma'

export interface AutoReplyRule {
  id: number
  keyword: string
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | null
  response_content: string
  priority: number | null
  is_active: boolean | null
}

/**
 * Match a message against a single auto-reply rule
 */
export function matchAutoReplyRule(
  message: string,
  rule: Pick<AutoReplyRule, 'keyword' | 'match_type'>
): boolean {
  const normalizedMessage = message.trim()
  const normalizedKeyword = rule.keyword.trim()

  if (!rule.match_type) return false

  switch (rule.match_type) {
    case 'exact':
      return normalizedMessage === normalizedKeyword

    case 'contains':
      return normalizedMessage.includes(normalizedKeyword)

    case 'starts_with':
      return normalizedMessage.startsWith(normalizedKeyword)

    case 'regex':
      try {
        const regex = new RegExp(normalizedKeyword, 'i') // Case-insensitive
        return regex.test(normalizedMessage)
      } catch (error) {
        console.error('Invalid regex pattern:', normalizedKeyword, error)
        return false
      }

    default:
      return false
  }
}

/**
 * Find matching auto-reply rule for a message
 * Returns the highest priority matching rule
 */
export async function findMatchingAutoReplyRule(
  message: string,
  lineAccountId: number
): Promise<AutoReplyRule | null> {
  // Get all active rules for this LINE account, ordered by priority
  const rules = await prisma.auto_reply_rules.findMany({
    where: {
      line_account_id: lineAccountId,
      is_active: true,
    },
    orderBy: [
      { priority: 'desc' }, // Higher priority first
      { created_at: 'asc' }, // Older rules first if same priority
    ],
  })

  // Find first matching rule
  for (const rule of rules) {
    if (matchAutoReplyRule(message, rule)) {
      return rule
    }
  }

  return null
}

/**
 * Process auto-reply for incoming message
 * Returns reply content if a rule matches, null otherwise
 */
export async function processAutoReply(
  message: string,
  lineAccountId: number
): Promise<{
  shouldReply: boolean
  replyContent?: string
  matchedRule?: AutoReplyRule
}> {
  const matchedRule = await findMatchingAutoReplyRule(message, lineAccountId)

  if (matchedRule) {
    return {
      shouldReply: true,
      replyContent: matchedRule.response_content,
      matchedRule,
    }
  }

  return {
    shouldReply: false,
  }
}

/**
 * Log auto-reply usage for analytics
 */
export async function logAutoReplyUsage(
  ruleId: number,
  conversationId: number,
  messageContent: string
): Promise<void> {
  // Track usage statistics in database
  try {
    // We'll use a generic activity log or dedicated table if it exists
    // For now, let's assume we want to track this in a way that's queryable
    await (prisma as any).auto_reply_usage.create({
      data: {
        rule_id: ruleId,
        conversation_id: conversationId,
        message_content: messageContent.substring(0, 255),
        used_at: new Date(),
      },
    })
  } catch (error) {
    // If table doesn't exist, fallback to console and don't break the flow
    console.log('Auto-reply used (db log failed):', {
      ruleId,
      conversationId,
      messageContent: messageContent.substring(0, 50),
      timestamp: new Date().toISOString(),
    })
  }
}
