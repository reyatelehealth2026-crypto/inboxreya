import { prisma } from '@/lib/prisma'

interface CountBroadcastRecipientsParams {
  lineAccountId: number
  targetSegmentId?: number
  targetCustomerIds?: number[]
  targetTagIds?: number[]
}

export const countBroadcastRecipients = async ({
  lineAccountId,
  targetSegmentId,
  targetCustomerIds,
  targetTagIds,
}: CountBroadcastRecipientsParams) => {
  if (targetTagIds && targetTagIds.length > 0) {
    const tagRecipients = await prisma.userTagAssignment.findMany({
      where: {
        tagId: { in: targetTagIds },
        user: { lineAccountId },
      },
      select: { userId: true },
      distinct: ['userId'],
    })

    return tagRecipients.length
  }

  if (targetSegmentId) {
    return 0
  }

  if (targetCustomerIds && targetCustomerIds.length > 0) {
    return targetCustomerIds.length
  }

  return prisma.lineUser.count({
    where: { lineAccountId },
  })
}
