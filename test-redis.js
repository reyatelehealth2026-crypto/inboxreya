/**
 * Redis Connection Test Script (inboxreya)
 * รัน: node test-redis.js
 * ทดสอบ Redis connection สำหรับ inboxreya project
 */

// Load .env.local manually (ก่อน import เพราะ Next.js ไม่ได้โหลดให้ใน Node scripts)
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  try {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf-8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx < 0) return
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    })
    console.log(`Loaded ${file}`)
  } catch {
    console.log(`${file} not found, using process.env`)
  }
}

loadEnv('.env.local')
loadEnv('.env')

const Redis = require('ioredis')

async function testRedis() {
  console.log('\n=== Redis Connection Test (inboxreya) ===\n')

  const url = process.env.REDIS_URL
  console.log(`Config:`)
  console.log(`  REDIS_URL = ${url || '(not set)'}`)

  if (!url) {
    console.error('\n❌ REDIS_URL is not set in .env.local')
    console.log('   เพิ่ม REDIS_URL=redis://127.0.0.1:6379 ใน .env.local')
    process.exit(1)
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    connectTimeout: 3000,
  })

  redis.on('error', (err) => {
    // handled below
  })

  try {
    console.log(`\nConnecting to Redis...`)
    const pong = await redis.ping()
    console.log(`✅ Connected! PING → ${pong}`)

    // ตรวจสอบ Redis info
    const info = await redis.info('memory')
    const memLine = info.split('\n').find(l => l.startsWith('used_memory_human'))
    const dbSize = await redis.dbsize()
    console.log(`\nRedis Info:`)
    console.log(`  Memory Used : ${memLine ? memLine.split(':')[1].trim() : 'N/A'}`)
    console.log(`  Total Keys  : ${dbSize}`)

    // ทดสอบ SET / GET / DEL
    console.log('\n--- SET/GET/DEL Test ---')
    const key = `inboxreya:test:${Date.now()}`
    const value = JSON.stringify({ status: 'ok', time: new Date().toISOString(), project: 'inboxreya' })

    await redis.set(key, value, 'EX', 30)
    console.log(`SET '${key}' : ✅ OK`)

    const got = await redis.get(key)
    console.log(`GET '${key}' : ${got ? '✅ OK — ' + got : '❌ FAILED'}`)

    const del = await redis.del(key)
    console.log(`DEL '${key}' : ${del ? `✅ OK (${del} key deleted)` : '❌ FAILED'}`)

  } catch (err) {
    console.error(`\n❌ Cannot connect to Redis!`)
    console.error(`   Error: ${err.message}`)
    console.log(`\n   ตรวจสอบ:`)
    console.log(`   1. Redis กำลังรันอยู่หรือเปล่า: systemctl status redis`)
    console.log(`   2. REDIS_URL ถูกต้อง: ${url}`)
    console.log(`   3. ติดตั้ง ioredis: npm install`)
  } finally {
    redis.disconnect()
  }

  console.log('\n=== Done ===\n')
}

testRedis()
