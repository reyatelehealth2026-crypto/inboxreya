import { Prisma } from '@prisma/client'
import prisma from './prisma'

const LAST_MESSAGE_SELECT = {
  id: true,
  userId: true,
  direction: true,
  messageType: true,
  content: true,
  mediaUrl: true,
  metadata: true,
  isRead: true,
  sentBy: true,
  replyToId: true,
  platform: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MessageSelect

export type LastMessage = Prisma.MessageGetPayload<{ select: typeof LAST_MESSAGE_SELECT }>

/**
 * Newest message of each user, keyed by user id.
 *
 * Replaces Prisma's nested `messages: { orderBy, take: 1 }`, which loads every
 * message of every listed user and sorts them in one statement. Measured on
 * prod 2026-09-17 for the 100 most recent conversations: 39,328 rows / 6.7 s
 * (one customer alone owns 7,655 messages), and 177k rows / 25–67 s at the
 * old limit of 1000 — six of those at once drained the 17-connection pool and
 * every other route answered P2024.
 *
 * MAX(id) per user rides idx_user_id_cursor (user_id, id): 100 rows / 23 ms,
 * 1000 rows / 122 ms. Highest id == latest created_at held for 1000/1000 users.
 */
export async function lastMessagesFor(userIds: number[]): Promise<Map<number, LastMessage>> {
  if (userIds.length === 0) return new Map()

  const newest = await prisma.$queryRaw<{ id: number | bigint }[]>`
    SELECT MAX(id) AS id FROM messages
    WHERE user_id IN (${Prisma.join(userIds)})
    GROUP BY user_id`

  const messages = await prisma.message.findMany({
    where: { id: { in: newest.map((row) => Number(row.id)) } },
    select: LAST_MESSAGE_SELECT,
  })

  return new Map(
    messages.flatMap((message) => (message.userId === null ? [] : [[message.userId, message] as const])),
  )
}
