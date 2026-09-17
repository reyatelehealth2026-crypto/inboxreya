import { z } from 'zod'

export const IMAGEMAP_SIZES = [1040, 700, 460, 300, 240] as const

export const imagemapRegionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  url: z
    .string()
    .max(1000)
    .refine((u) => u.startsWith('https://'), { message: 'URL must use https' }),
  tagId: z.number().int().positive().optional(),
  keyword: z.string().trim().max(60).optional(),
})

export const imagemapInputSchema = z
  .object({
    baseKey: z.string().min(1),
    width: z.literal(1040),
    height: z.number().int().min(1).max(2500),
    altText: z.string().trim().min(1).max(400),
    regions: z.array(imagemapRegionSchema).min(1).max(12),
  })
  .superRefine((data, ctx) => {
    data.regions.forEach((r, i) => {
      if (r.x + r.w > data.width || r.y + r.h > data.height) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Region ${i} extends outside the image boundaries`,
          path: ['regions', i],
        })
      }
    })
  })

export type ImagemapRegion = z.infer<typeof imagemapRegionSchema>
export type ImagemapInput = z.infer<typeof imagemapInputSchema>

export interface ImagemapMeta {
  baseKey: string
  regions: ImagemapRegion[]
}
