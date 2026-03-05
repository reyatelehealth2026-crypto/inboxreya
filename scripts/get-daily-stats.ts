
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  console.log(`📊 Daily Stats Report for: ${today.toLocaleDateString('th-TH')}`)
  console.log('--------------------------------------------------')

  // 1. Unique Customers Today
  const uniqueUsers = await prisma.message.groupBy({
    by: ['userId'],
    where: {
      direction: 'incoming',
      createdAt: {
        gte: today
      }
    }
  })

  // 2. Total Messages Today
  const totalMessages = await prisma.message.count({
    where: {
      createdAt: {
        gte: today
      }
    }
  })

  // 3. Successful Orders (Dispensing Records)
  const successfulOrders = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(*) as count, 
      SUM(total_amount) as revenue 
    FROM dispensing_records 
    WHERE payment_status = 'paid' 
    AND created_at >= ${today}
  `

  const orderCount = Number(successfulOrders[0]?.count || 0)
  const revenue = Number(successfulOrders[0]?.revenue || 0)

  console.log(`👤 ลูกค้าที่ทักมาวันนี้: ${uniqueUsers.length} คน`)
  console.log(`💬 จำนวนข้อความรวม: ${totalMessages} ข้อความ`)
  console.log(`📦 ออเดอร์สำเร็จ: ${orderCount} รายการ`)
  console.log(`💰 ยอดขายรวม: ฿${revenue.toLocaleString()}`)
  console.log('--------------------------------------------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
