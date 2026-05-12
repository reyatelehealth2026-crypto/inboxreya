import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create LINE Account
  const lineAccount = await prisma.lineAccount.upsert({
    where: { channelSecret: 'demo-channel-secret' },
    update: {},
    create: {
      name: 'Demo Pharmacy Bot',
      channelSecret: 'demo-channel-secret',
      channelAccessToken: 'demo-access-token',
      basicId: '@demo-pharmacy',
      isActive: true,
      isDefault: true,
    },
  })
  console.log('✅ Created LINE Account:', lineAccount.name)

  // Create Admin Users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const adminUser = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@pharmacy.com',
      password: hashedPassword,
      displayName: 'ผู้ดูแลระบบ',
      role: 'super_admin',
      lineAccountId: lineAccount.id,
      isActive: true,
    },
  })
  console.log('✅ Created Admin User:', adminUser.username)

  // Create Tags
  const tags = [
    { name: 'VIP', color: '#FFD700', description: 'ลูกค้า VIP' },
    { name: 'ลูกค้าประจำ', color: '#4CAF50', description: 'ลูกค้าที่ซื้อบ่อย' },
    { name: 'ลูกค้าใหม่', color: '#2196F3', description: 'ลูกค้าใหม่' },
    { name: 'รอติดตาม', color: '#FF9800', description: 'รอติดตามผล' },
    { name: 'โรคเรื้อรัง', color: '#9C27B0', description: 'ผู้ป่วยโรคเรื้อรัง' },
  ]

  for (const tag of tags) {
    await prisma.userTag.upsert({
      where: { lineAccountId_name: { lineAccountId: lineAccount.id, name: tag.name } },
      update: {},
      create: {
        ...tag,
        lineAccountId: lineAccount.id,
      },
    })
  }
  console.log('✅ Created', tags.length, 'tags')

  // Create Sample LINE Users
  const sampleUsers = [
    {
      lineUserId: 'U001',
      displayName: 'สมชาย ใจดี',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      phone: '081-234-5678',
      email: 'somchai@example.com',
      tier: 'gold',
      points: 1500,
      totalSpent: 25000,
      orderCount: 15,
      membershipLevel: 'gold' as const,
      isRegistered: true,
      chatStatus: 'active',
    },
    {
      lineUserId: 'U002',
      displayName: 'สมหญิง รักสุขภาพ',
      firstName: 'สมหญิง',
      lastName: 'รักสุขภาพ',
      phone: '089-876-5432',
      tier: 'silver',
      points: 800,
      totalSpent: 12000,
      orderCount: 8,
      membershipLevel: 'silver' as const,
      isRegistered: true,
      chatStatus: 'active',
    },
    {
      lineUserId: 'U003',
      displayName: 'วิชัย สุขใจ',
      firstName: 'วิชัย',
      lastName: 'สุขใจ',
      phone: '062-111-2222',
      tier: 'bronze',
      points: 200,
      totalSpent: 3000,
      orderCount: 3,
      membershipLevel: 'bronze' as const,
      isRegistered: false,
      chatStatus: 'pending',
    },
  ]

  for (const userData of sampleUsers) {
    const user = await prisma.lineUser.upsert({
      where: { lineAccountId_lineUserId: { lineAccountId: lineAccount.id, lineUserId: userData.lineUserId } },
      update: {},
      create: {
        ...userData,
        lineAccountId: lineAccount.id,
        lastInteraction: new Date(),
        registeredAt: userData.isRegistered ? new Date() : null,
      },
    })

    // Create sample messages
    const messages = [
      { direction: 'incoming', content: 'สวัสดีครับ', messageType: 'text' },
      { direction: 'outgoing', content: 'สวัสดีค่ะ ยินดีให้บริการค่ะ', messageType: 'text' },
      { direction: 'incoming', content: 'มียาแก้ปวดหัวไหมครับ', messageType: 'text' },
      { direction: 'outgoing', content: 'มีค่ะ มียา Paracetamol และ Ibuprofen ค่ะ', messageType: 'text' },
    ]

    for (const msg of messages) {
      await prisma.message.create({
        data: {
          userId: user.id,
          lineAccountId: lineAccount.id,
          direction: msg.direction,
          messageType: msg.messageType,
          content: msg.content,
          isRead: msg.direction === 'outgoing',
          sentBy: msg.direction === 'outgoing' ? adminUser.id.toString() : null,
        },
      })
    }

    console.log('✅ Created user:', userData.displayName, 'with', messages.length, 'messages')
  }

  // Assign tags to users
  const allUsers = await prisma.lineUser.findMany({ where: { lineAccountId: lineAccount.id } })
  const allTags = await prisma.userTag.findMany({ where: { lineAccountId: lineAccount.id } })

  if (allUsers.length > 0 && allTags.length > 0) {
    // Assign VIP tag to first user
    await prisma.userTagAssignment.upsert({
      where: { userId_tagId: { userId: allUsers[0].id, tagId: allTags[0].id } },
      update: {},
      create: {
          userId: allUsers[0].id,
          tagId: allTags[0].id,
          assignedBy: adminUser.id.toString(),
      },
    })

    // Assign ลูกค้าประจำ tag to second user
    if (allUsers.length > 1 && allTags.length > 1) {
      await prisma.userTagAssignment.upsert({
        where: { userId_tagId: { userId: allUsers[1].id, tagId: allTags[1].id } },
        update: {},
        create: {
          userId: allUsers[1].id,
          tagId: allTags[1].id,
          assignedBy: adminUser.id.toString(),
        },
      })
    }

    // Assign ลูกค้าใหม่ tag to third user
    if (allUsers.length > 2 && allTags.length > 2) {
      await prisma.userTagAssignment.upsert({
        where: { userId_tagId: { userId: allUsers[2].id, tagId: allTags[2].id } },
        update: {},
        create: {
          userId: allUsers[2].id,
          tagId: allTags[2].id,
          assignedBy: adminUser.id.toString(),
        },
      })
    }
    console.log('✅ Assigned tags to users')
  }

  // ----- Sales-admin AI prompts (Phase 2) -----
  const promptSeeds = [
    {
      key: 'ghost_draft',
      body: `You are drafting a reply for a Thai pharmacy sales admin replying to a B2B customer (a pharmacy/clinic).
Use the conversation history, customer profile, recent orders, and product catalog (when provided).
Write 1-3 short paragraphs in Thai. Be helpful, accurate, and respectful. Quote SKU/price only when they appear in the catalog context. Do not invent stock numbers, lead times, or promotions.
If the customer asked something out of scope (medical advice, regulatory questions), draft a polite handoff message instead.`,
    },
    {
      key: 'summarizer',
      body: `Summarize the conversation between a Thai pharmacy sales admin and a B2B customer.
Output 3-5 bullet points in Thai:
- Main topic + decisions reached
- Open items / pending action from the admin's side
- Customer sentiment (positive | neutral | negative) and one-line reason
Keep each bullet under 30 words. No greetings or preamble.`,
    },
    {
      key: 'action_suggester',
      body: `Given the conversation history and customer profile, suggest 2-3 concrete next actions the admin can take RIGHT NOW.
Output JSON only: { "actions": [ { "label": string, "reason": string, "type": "reply" | "price_list" | "follow_up" | "order_check" | "escalate", "priority": 1 | 2 | 3 } ] }.
priority 1 = urgent, 3 = nice-to-have. Labels are in Thai, short (under 8 words). Reasons cite the conversation evidence.`,
    },
    {
      key: 'order_parser',
      body: `Parse the customer's message into structured order items by matching against the provided catalog.
Output JSON only: { "items": [ { "sku": string, "name": string, "qty": number, "price": number, "confidence": number } ] }.
confidence is 0..1. Use only SKUs from the catalog context; if no match, emit confidence < 0.5 and keep the customer's phrasing in name. Quantities must be positive integers.`,
    },
  ]
  for (const p of promptSeeds) {
    await prisma.aiPrompt.upsert({
      where: { key_version: { key: p.key, version: 1 } },
      update: {},
      create: { key: p.key, version: 1, body: p.body, isActive: true },
    })
  }
  console.log('✅ Seeded', promptSeeds.length, 'AI prompts')

  // ----- Feature flags (off by default; admin enables when ready) -----
  const flagSeeds = [
    { key: 'ai_draft', enabled: false, enabledForRoles: 'admin,super_admin,supervisor' },
    { key: 'ai_summarizer', enabled: false, enabledForRoles: 'admin,super_admin,supervisor' },
    { key: 'ai_action_suggester', enabled: false, enabledForRoles: 'admin,super_admin' },
    { key: 'ai_order_parser', enabled: false, enabledForRoles: 'admin,super_admin' },
  ]
  for (const f of flagSeeds) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    })
  }
  console.log('✅ Seeded', flagSeeds.length, 'feature flags')

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
