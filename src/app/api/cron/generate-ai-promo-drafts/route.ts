import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchCnyProducts } from '@/lib/ai-agent/cny-products'
import { generatePromoDraft } from '@/lib/ai-agent/promo-drafts'

export const maxDuration = 60

function isRuleDue(rule: { schedule: string; lastGeneratedAt: Date | null }) {
  const now = new Date()
  if (!rule.lastGeneratedAt) return true
  const schedule = rule.schedule.toLowerCase()
  if (schedule.includes('hourly')) {
    return now.getTime() - rule.lastGeneratedAt.getTime() >= 60 * 60 * 1000
  }
  if (schedule.includes('daily')) {
    return now.toDateString() !== rule.lastGeneratedAt.toDateString()
  }
  return false
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rules = await prisma.aiPromoRule.findMany({
      where: { enabled: true },
      orderBy: { id: 'asc' },
      take: 20,
    })
    const dueRules = rules.filter(isRuleDue)
    if (dueRules.length === 0) {
      return NextResponse.json({ success: true, processed: 0, drafts: [] })
    }

    const { products, sourceUrl } = await fetchCnyProducts()
    const drafts: Array<{ ruleId: number; draftId?: number; status: string; error?: string }> = []

    for (const rule of dueRules) {
      try {
        const filters = rule.productFilters && typeof rule.productFilters === 'object'
          ? rule.productFilters as { skuIncludes?: string[]; minStock?: number }
          : undefined
        const generated = await generatePromoDraft({
          prompt: `${rule.name} ${rule.schedule}`,
          products,
          campaignType: rule.campaignType as any,
          maxProducts: rule.maxProducts,
          source: 'rule',
          productFilters: filters,
        })

        const draft = await prisma.aiPromoDraft.create({
          data: {
            lineAccountId: rule.lineAccountId,
            prompt: `${rule.name} ${rule.schedule}`,
            campaignType: generated.campaignType,
            selectedProducts: generated.selectedProducts as any,
            generatedCopy: generated.generatedCopy,
            flexJson: generated.flexJson as any,
            proposedScheduledAt: generated.proposedScheduledAt,
            status: generated.status,
            errorMessage: generated.errorMessage,
            source: 'rule',
            productSourceUrl: sourceUrl,
            createdBy: rule.createdBy,
          },
        })
        await prisma.aiPromoRule.update({
          where: { id: rule.id },
          data: { lastGeneratedAt: new Date() },
        })
        drafts.push({ ruleId: rule.id, draftId: draft.id, status: draft.status })
      } catch (error) {
        drafts.push({
          ruleId: rule.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to create draft',
        })
      }
    }

    return NextResponse.json({ success: true, processed: drafts.length, drafts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI promo drafts'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
