/**
 * Pusher Configuration Verification Script
 * ตรวจสอบว่า Pusher credentials ถูกตั้งค่าถูกต้องหรือไม่
 * 
 * Usage: node verify-pusher.js
 */

const fs = require('fs')
const path = require('path')

// Read .env.local file
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}

  envContent.split('\n').forEach((line) => {
    line = line.trim()
    if (line && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        env[key] = value
      }
    }
  })

  return env
}

const env = loadEnvFile()

console.log('🔍 กำลังตรวจสอบ Pusher Configuration...\n')
console.log('='.repeat(60))

// ตรวจสอบ Server-side credentials
console.log('\n📋 Server-side Credentials:')
const serverCreds = {
  PUSHER_APP_ID: env.PUSHER_APP_ID,
  PUSHER_KEY: env.PUSHER_KEY,
  PUSHER_SECRET: env.PUSHER_SECRET,
  PUSHER_CLUSTER: env.PUSHER_CLUSTER,
}

let serverValid = true
for (const [key, value] of Object.entries(serverCreds)) {
  const isValid = value && value.trim() !== '' && !value.startsWith(' ')
  const status = isValid ? '✅' : '❌'
  const displayValue = value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : '(empty)'
  
  console.log(`  ${status} ${key}: ${displayValue}`)
  
  if (!isValid) {
    serverValid = false
    if (!value) {
      console.log(`     ⚠️  Missing value`)
    } else if (value.startsWith(' ')) {
      console.log(`     ⚠️  Has leading space - remove space after =`)
    }
  }
}

// ตรวจสอบ Client-side credentials
console.log('\n📋 Client-side Credentials:')
const clientCreds = {
  NEXT_PUBLIC_PUSHER_KEY: env.NEXT_PUBLIC_PUSHER_KEY,
  NEXT_PUBLIC_PUSHER_CLUSTER: env.NEXT_PUBLIC_PUSHER_CLUSTER,
}

let clientValid = true
for (const [key, value] of Object.entries(clientCreds)) {
  const isValid = value && value.trim() !== '' && !value.startsWith(' ')
  const status = isValid ? '✅' : '❌'
  const displayValue = value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : '(empty)'
  
  console.log(`  ${status} ${key}: ${displayValue}`)
  
  if (!isValid) {
    clientValid = false
    if (!value) {
      console.log(`     ⚠️  Missing value`)
    } else if (value.startsWith(' ')) {
      console.log(`     ⚠️  Has leading space - remove space after =`)
    }
  }
}

// ตรวจสอบความสอดคล้อง
console.log('\n📋 Consistency Check:')
const keyMatch = serverCreds.PUSHER_KEY === clientCreds.NEXT_PUBLIC_PUSHER_KEY
const clusterMatch = serverCreds.PUSHER_CLUSTER === clientCreds.NEXT_PUBLIC_PUSHER_CLUSTER

console.log(`  ${keyMatch ? '✅' : '❌'} PUSHER_KEY matches NEXT_PUBLIC_PUSHER_KEY: ${keyMatch}`)
console.log(`  ${clusterMatch ? '✅' : '❌'} PUSHER_CLUSTER matches NEXT_PUBLIC_PUSHER_CLUSTER: ${clusterMatch}`)

// สรุปผล
console.log('\n' + '='.repeat(60))
console.log('📊 สรุปผลการตรวจสอบ:\n')

if (serverValid && clientValid && keyMatch && clusterMatch) {
  console.log('✅ Pusher Configuration: ถูกต้องทั้งหมด!')
  console.log('\n📝 ขั้นตอนต่อไป:')
  console.log('   1. Restart Next.js dev server (Ctrl+C แล้ว npm run dev)')
  console.log('   2. ตรวจสอบ console ว่าไม่มี warning "Pusher credentials not configured"')
  console.log('   3. เปิด browser console ตรวจสอบว่าเห็น "[Pusher] Connected"')
  console.log('   4. ทดสอบ real-time features (ส่งข้อความ, typing indicator)')
} else {
  console.log('❌ พบปัญหาในการตั้งค่า Pusher\n')
  
  if (!serverValid) {
    console.log('   ⚠️  Server-side credentials มีปัญหา')
  }
  if (!clientValid) {
    console.log('   ⚠️  Client-side credentials มีปัญหา')
  }
  if (!keyMatch) {
    console.log('   ⚠️  PUSHER_KEY และ NEXT_PUBLIC_PUSHER_KEY ไม่ตรงกัน')
  }
  if (!clusterMatch) {
    console.log('   ⚠️  PUSHER_CLUSTER และ NEXT_PUBLIC_PUSHER_CLUSTER ไม่ตรงกัน')
  }
  
  console.log('\n📝 แก้ไข:')
  console.log('   1. ตรวจสอบไฟล์ .env.local')
  console.log('   2. ตรวจสอบว่าไม่มี space หลังเครื่องหมาย =')
  console.log('   3. ตรวจสอบว่า credentials ครบทุกตัว')
  console.log('   4. ดูคู่มือใน PUSHER_SETUP_GUIDE.md')
}

console.log('\n' + '='.repeat(60))
