#!/usr/bin/env node
/**
 * Test script for Thunder slip verification integration.
 *
 * Usage:
 *   node test-apislip.js <image_url>
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}

envContent.split('\n').forEach((line) => {
  if (line.includes('=') && !line.trim().startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
  }
})

const API_KEY = env.THUNDER_API_KEY
const BASE_URL = (env.THUNDER_API_BASE_URL || 'https://api.thunder.in.th/v2').replace(/\/$/, '')

if (!API_KEY) {
  console.error('THUNDER_API_KEY not found in .env.local')
  process.exit(1)
}

console.log('API Key found:', API_KEY.substring(0, 8) + '...')
console.log('')

async function testInfo() {
  console.log('Testing /info...')
  try {
    const res = await fetch(`${BASE_URL}/info`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const data = await res.json()

    if (data.success) {
      console.log('App Info:')
      console.log(`   Application: ${data.data.application?.name || '-'}`)
      console.log(`   Branch: ${data.data.branch?.name || '-'}`)
      console.log(`   Branch Active: ${data.data.branch?.isActive}`)
      console.log(`   Credit: ${data.data.account?.credit ?? '-'}`)
      console.log(`   Quota Used: ${data.data.application?.quota?.used ?? '-'}`)
      console.log(`   Quota Remaining: ${data.data.application?.quota?.remaining ?? '-'}`)
      console.log(`   Product: ${data.data.product?.name || '-'}`)
    } else {
      console.log('Error:', data)
    }
  } catch (err) {
    console.error('Request failed:', err.message)
  }
  console.log('')
}

async function testVerifySlip() {
  const testImageUrl = process.argv[2]

  if (!testImageUrl) {
    console.log('Testing /verify/bank skipped: pass a real slip image URL as the first argument.')
    console.log('')
    return
  }

  console.log('Testing /verify/bank...')
  console.log(`   Image URL: ${testImageUrl}`)

  try {
    const res = await fetch(`${BASE_URL}/verify/bank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testImageUrl,
        checkDuplicate: true,
        remark: 'inboxreya-test',
      }),
    })

    const data = await res.json()

    if (data.success) {
      const slip = data.data?.rawSlip
      console.log('Verification Result:')
      console.log(`   Duplicate: ${data.data?.isDuplicate}`)
      console.log(`   Amount In Slip: ${data.data?.amountInSlip}`)
      if (slip) {
        console.log(`   Amount: ${slip.amount?.amount} ${slip.amount?.local?.currency || 'THB'}`)
        console.log(`   Ref: ${slip.transRef}`)
        console.log(`   Date: ${slip.date || 'N/A'}`)
        console.log(`   Sender: ${slip.sender?.account?.name?.th || slip.sender?.account?.name?.en || 'N/A'}`)
        console.log(`   Receiver: ${slip.receiver?.account?.name?.th || slip.receiver?.account?.name?.en || 'N/A'}`)
      }
    } else {
      console.log('Verification failed:', data)
    }
  } catch (err) {
    console.error('Request failed:', err.message)
  }
  console.log('')
}

async function testVerifyEndpoint() {
  const testImageUrl = process.argv[2] || '<real_slip_image_url>'
  const localEndpoint = 'http://localhost:3000/api/inbox/verify-slip'

  console.log('Local Next.js endpoint:')
  console.log(`   Endpoint: ${localEndpoint}`)
  console.log(`   Body: { "imageUrl": "${testImageUrl}" }`)
  console.log('   Note: requires Next.js dev server and an authenticated session.')
  console.log('')
}

;(async () => {
  await testInfo()
  await testVerifySlip()
  await testVerifyEndpoint()

  console.log('Test complete.')
})()
