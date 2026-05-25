import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

function loadEnvFile(file: string) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env / .env.local')
  process.exit(1)
}

const TAG_NAME = 'mini game'
const TAG_COLOR = '#A855F7'
const TAG_DESCRIPTION = 'ลูกค้าที่เพิ่มเพื่อนผ่าน Mini Game'
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

const prisma = new PrismaClient()

function getYesterdayRangeBangkok() {
  const nowBangkok = new Date(Date.now() + BANGKOK_OFFSET_MS)
  const year = nowBangkok.getUTCFullYear()
  const month = nowBangkok.getUTCMonth()
  const day = nowBangkok.getUTCDate()
  const startUtcMs = Date.UTC(year, month, day - 1, 0, 0, 0) - BANGKOK_OFFSET_MS
  const endUtcMs = Date.UTC(year, month, day, 0, 0, 0) - BANGKOK_OFFSET_MS
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) }
}

function formatBangkok(d: Date) {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().replace('Z', '+07:00')
}

async function main() {
  const { start, end } = getYesterdayRangeBangkok()
  console.log(`📅 Window (Bangkok): ${formatBangkok(start)} → ${formatBangkok(end)}`)

  const users = await prisma.lineUser.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { id: true, lineAccountId: true, displayName: true, lineUserId: true },
  })

  if (users.length === 0) {
    console.log('ℹ️  No customers added as friends yesterday.')
    return
  }
  console.log(`👥 Found ${users.length} customer(s) added yesterday`)

  const byAccount = new Map<number | null, typeof users>()
  for (const u of users) {
    const key = u.lineAccountId ?? null
    const list = byAccount.get(key) ?? []
    list.push(u)
    byAccount.set(key, list)
  }

  let totalAssigned = 0
  let totalSkipped = 0

  for (const [accountId, accountUsers] of byAccount) {
    let tag = await prisma.userTag.findFirst({
      where: { lineAccountId: accountId ?? null, name: TAG_NAME },
    })
    if (!tag) {
      tag = await prisma.userTag.create({
        data: {
          lineAccountId: accountId,
          name: TAG_NAME,
          color: TAG_COLOR,
          description: TAG_DESCRIPTION,
          tagType: 'manual',
          priority: 0,
        },
      })
      console.log(`  ➕ Created tag "${TAG_NAME}" (id=${tag.id}) for account=${accountId ?? 'global'}`)
    } else {
      console.log(`  ✓ Reusing tag "${TAG_NAME}" (id=${tag.id}) for account=${accountId ?? 'global'}`)
    }

    for (const u of accountUsers) {
      const result = await prisma.userTagAssignment.upsert({
        where: { userId_tagId: { userId: u.id, tagId: tag.id } },
        create: {
          userId: u.id,
          tagId: tag.id,
          assignedBy: 'script',
          assignedReason: 'mini_game_yesterday_followers',
        },
        update: {},
        select: { id: true, createdAt: true },
      })
      const isNew = Math.abs(Date.now() - result.createdAt.getTime()) < 5_000
      if (isNew) totalAssigned++
      else totalSkipped++
    }
  }

  console.log(`✅ Done. assigned=${totalAssigned}, already-tagged=${totalSkipped}`)
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
