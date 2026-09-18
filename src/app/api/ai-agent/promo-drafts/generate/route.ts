import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchCnyProducts, inferCampaignType } from '@/lib/ai-agent/cny-products'
import { generatePromoDraft } from '@/lib/ai-agent/promo-drafts'

const generateSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  campaignType: z.enum(['flash_sale', 'promotion', 'bestseller', 'new_arrival', 'product_catalog']).optional(),
  maxProducts: z.number().int().min(1).max(12).optional(),
  productSourceUrl: z.string().url().optional(),
  skuIncludes: z.array(z.string().trim().min(1)).max(50).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const body = generateSchema.parse(await request.json())
    const createdBy = parseInt(String(user.id), 10)

    try {
      const { products, sourceUrl } = await fetchCnyProducts(body.productSourceUrl)
      const generated = await generatePromoDraft({
        prompt: body.prompt,
        products,
        campaignType: body.campaignType || inferCampaignType(body.prompt),
        maxProducts: body.maxProducts,
        productFilters: body.skuIncludes?.length ? { skuIncludes: body.skuIncludes } : undefined,
      })

      const draft = await prisma.aiPromoDraft.create({
        data: {
          lineAccountId: user.lineAccountId as number,
          prompt: body.prompt,
          campaignType: generated.campaignType,
          selectedProducts: generated.selectedProducts as any,
          generatedCopy: generated.generatedCopy,
          flexJson: generated.flexJson as any,
          proposedScheduledAt: generated.proposedScheduledAt,
          status: generated.status,
          errorMessage: generated.errorMessage,
          source: 'manual',
          productSourceUrl: sourceUrl,
          createdBy,
        },
      })

      return NextResponse.json({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Product source unavailable'
      const draft = await prisma.aiPromoDraft.create({
        data: {
          lineAccountId: user.lineAccountId as number,
          prompt: body.prompt,
          campaignType: body.campaignType || inferCampaignType(body.prompt),
          selectedProducts: [] as any,
          generatedCopy: '',
          flexJson: { type: 'flex', altText: 'Needs review', contents: { type: 'carousel', contents: [] } } as any,
          proposedScheduledAt: null,
          status: 'needs_review',
          errorMessage: message,
          source: 'manual',
          productSourceUrl: body.productSourceUrl || process.env.CNY_PRODUCT_API_URL || null,
          createdBy,
        },
      })
      return NextResponse.json({ success: true, data: draft, warning: message })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate promo draft'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
