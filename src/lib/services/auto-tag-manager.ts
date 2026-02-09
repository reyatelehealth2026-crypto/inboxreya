import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AutoTagCondition, AutoTagTriggerType } from '@/types'

interface AutoTagContext {
  userId: number
  lineAccountId: number
  triggerType: AutoTagTriggerType
  data?: Record<string, any>
}

export class AutoTagManager {
  private lineAccountId: number

  constructor(lineAccountId: number) {
    this.lineAccountId = lineAccountId
  }

  /**
   * Process auto-tagging for a user based on trigger type
   */
  async processAutoTags(context: AutoTagContext): Promise<void> {
    const { userId, triggerType, data } = context

    // Get all active rules for this trigger type
    const rules = await prisma.autoTagRule.findMany({
      where: {
        triggerType,
        isActive: true,
        lineAccountId: this.lineAccountId,
      },
      include: {
        tag: true,
      },
      orderBy: {
        priority: 'desc',
      },
    })

    // Get user data for condition evaluation
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tier: true,
        points: true,
        totalSpent: true,
        orderCount: true,
        membershipLevel: true,
        isRegistered: true,
        gender: true,
        province: true,
      },
    })

    if (!user) return

    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions) as AutoTagCondition[]
      
      if (this.evaluateConditions(conditions, user, data)) {
        await this.assignTag(userId, rule.tagId, true)
      }
    }
  }

  /**
   * Evaluate conditions against user data
   */
  private evaluateConditions(
    conditions: AutoTagCondition[],
    user: any,
    contextData?: Record<string, any>
  ): boolean {
    if (conditions.length === 0) return true

    return conditions.every((condition) => {
      const value = this.getFieldValue(condition.field, user, contextData)
      return this.evaluateCondition(condition, value)
    })
  }

  /**
   * Get field value from user or context data
   */
  private getFieldValue(
    field: string,
    user: any,
    contextData?: Record<string, any>
  ): any {
    // Check context data first
    if (contextData && field in contextData) {
      return contextData[field]
    }

    // Check user fields
    const fieldMap: Record<string, string> = {
      'tier': 'tier',
      'points': 'points',
      'total_spent': 'totalSpent',
      'order_count': 'orderCount',
      'membership_level': 'membershipLevel',
      'is_registered': 'isRegistered',
      'gender': 'gender',
      'province': 'province',
    }

    const userField = fieldMap[field] || field
    return user[userField]
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: AutoTagCondition, value: any): boolean {
    const { operator, value: conditionValue } = condition

    switch (operator) {
      case 'equals':
        return value === conditionValue

      case 'contains':
        return String(value).toLowerCase().includes(String(conditionValue).toLowerCase())

      case 'greater_than':
        return Number(value) > Number(conditionValue)

      case 'less_than':
        return Number(value) < Number(conditionValue)

      case 'in':
        const inValues = Array.isArray(conditionValue) ? conditionValue : [conditionValue]
        return inValues.includes(value)

      case 'not_in':
        const notInValues = Array.isArray(conditionValue) ? conditionValue : [conditionValue]
        return !notInValues.includes(value)

      default:
        return false
    }
  }

  /**
   * Assign a tag to a user
   */
  async assignTag(userId: number, tagId: number, isAuto: boolean = false): Promise<void> {
    await prisma.userTagAssignment.upsert({
      where: {
        userId_tagId: { userId, tagId },
      },
      create: {
        userId,
        tagId,
        assignedBy: isAuto ? 'auto' : 'manual',
        assignedReason: isAuto ? 'auto_tag' : undefined,
      },
      update: {
        assignedBy: isAuto ? 'auto' : 'manual',
        assignedReason: isAuto ? 'auto_tag' : undefined,
      },
    })
  }

  /**
   * Remove a tag from a user
   */
  async removeTag(userId: number, tagId: number): Promise<void> {
    await prisma.userTagAssignment.deleteMany({
      where: { userId, tagId },
    })
  }

  /**
   * Process on_follow trigger
   */
  async onFollow(userId: number): Promise<void> {
    await this.processAutoTags({
      userId,
      lineAccountId: this.lineAccountId,
      triggerType: 'on_follow',
    })
  }

  /**
   * Process on_message trigger
   */
  async onMessage(userId: number, messageContent: string): Promise<void> {
    await this.processAutoTags({
      userId,
      lineAccountId: this.lineAccountId,
      triggerType: 'on_message',
      data: { message_content: messageContent },
    })
  }

  /**
   * Process on_order trigger
   */
  async onOrder(userId: number, orderData: { amount: number; items: string[] }): Promise<void> {
    await this.processAutoTags({
      userId,
      lineAccountId: this.lineAccountId,
      triggerType: 'on_order',
      data: {
        order_amount: orderData.amount,
        order_items: orderData.items,
      },
    })
  }

  /**
   * Process on_tier_upgrade trigger
   */
  async onTierUpgrade(userId: number, newTier: string, oldTier: string): Promise<void> {
    await this.processAutoTags({
      userId,
      lineAccountId: this.lineAccountId,
      triggerType: 'on_tier_upgrade',
      data: {
        new_tier: newTier,
        old_tier: oldTier,
      },
    })
  }

  /**
   * Process on_points_milestone trigger
   */
  async onPointsMilestone(userId: number, points: number): Promise<void> {
    await this.processAutoTags({
      userId,
      lineAccountId: this.lineAccountId,
      triggerType: 'on_points_milestone',
      data: { points },
    })
  }

  /**
   * Process inactive users (cron job)
   */
  async processInactiveUsers(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

    const inactiveUsers = await prisma.lineUser.findMany({
      where: {
        lineAccountId: this.lineAccountId,
        lastInteraction: {
          lt: cutoffDate,
        },
      },
      select: { id: true },
    })

    for (const user of inactiveUsers) {
      await this.processAutoTags({
        userId: user.id,
        lineAccountId: this.lineAccountId,
        triggerType: 'on_inactive',
        data: { days_inactive: daysInactive },
      })
    }

    return inactiveUsers.length
  }

  /**
   * Process birthday tags (cron job)
   * Note: birthDate field is not currently in the schema, so this is a no-op.
   * To enable birthday tags, add birthDate field to LineUser model in schema.prisma
   */
  async processBirthdayTags(): Promise<number> {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // Find users with birthday today using raw query since birthDate may not exist in schema
    let birthdayUsers: Array<{ id: number; birth_date: Date | null }> = []
    try {
      birthdayUsers = await prisma.$queryRaw<Array<{ id: number; birth_date: Date | null }>>`
        SELECT id, birth_date 
        FROM users 
        WHERE line_account_id = ${this.lineAccountId} 
        AND birth_date IS NOT NULL
      `
    } catch (error) {
      // birth_date column may not exist in the database
      console.warn('Skipping birthday tags: birth_date column may not exist in database.')
      return 0
    }

    let count = 0
    for (const user of birthdayUsers) {
      if (user.birth_date) {
        const birthMonth = user.birth_date.getMonth() + 1
        const birthDay = user.birth_date.getDate()
        
        if (birthMonth === month && birthDay === day) {
          await this.processAutoTags({
            userId: user.id,
            lineAccountId: this.lineAccountId,
            triggerType: 'on_birthday',
          })
          count++
        }
      }
    }

    return count
  }
}

// Factory function to create AutoTagManager
export function createAutoTagManager(lineAccountId: number): AutoTagManager {
  return new AutoTagManager(lineAccountId)
}
