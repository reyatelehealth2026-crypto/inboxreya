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
