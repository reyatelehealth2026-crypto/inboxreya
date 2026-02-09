// Quick script to update user lineAccountId
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking users without LINE account...')
  
  // Get users without lineAccountId
  const usersWithoutAccount = await prisma.adminUser.findMany({
    where: {
      lineAccountId: null
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    }
  })
  
  console.log(`Found ${usersWithoutAccount.length} users without LINE account:`)
  usersWithoutAccount.forEach(user => {
    console.log(`  - ${user.username} (${user.email}) - Role: ${user.role}`)
  })
  
  if (usersWithoutAccount.length === 0) {
    console.log('All users already have LINE accounts assigned!')
    return
  }
  
  // Get first LINE account
  const firstAccount = await prisma.lineAccount.findFirst({
    orderBy: { id: 'asc' }
  })
  
  if (!firstAccount) {
    console.error('ERROR: No LINE accounts found in database!')
    return
  }
  
  console.log(`\nAssigning LINE account ID ${firstAccount.id} (${firstAccount.name}) to users...`)
  
  // Update users
  const result = await prisma.adminUser.updateMany({
    where: {
      lineAccountId: null
    },
    data: {
      lineAccountId: firstAccount.id
    }
  })
  
  console.log(`✅ Updated ${result.count} users successfully!`)
  
  // Verify
  const updatedUsers = await prisma.adminUser.findMany({
    where: {
      id: { in: usersWithoutAccount.map(u => u.id) }
    },
    select: {
      id: true,
      username: true,
      lineAccountId: true
    }
  })
  
  console.log('\nVerification:')
  updatedUsers.forEach(user => {
    console.log(`  ✓ ${user.username} -> LINE Account ID: ${user.lineAccountId}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
