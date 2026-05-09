#!/usr/bin/env node
/**
 * Test script for HaveSLIP integration.
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

const API_KEY = env.HAVESLIP_API_KEY
const BASE_URL = (env.HAVESLIP_API_BASE_URL || 'https://api.haveslip.com/api').replace(/\/$/, '')

if (!API_KEY) {
  console.error('HAVESLIP_API_KEY not found in .env.local')
  process.exit(1)
}

console.log('API Key found:', API_KEY.substring(0, 20) + '...')
console.log('')

async function testCreditsBalance() {
  console.log('Testing /credits/balance...')
  try {
    const res = await fetch(`${BASE_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const data = await res.json()

    if (data.success) {
      console.log('Credits Balance:')
      console.log(`   Currency: ${data.data.currency}`)
      console.log(`   Balance: ${data.data.balance}`)
      console.log(`   Next Expiry: ${data.data.nextExpiryAt || '-'}`)
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
    console.log('Testing /verify skipped: pass a real slip image URL as the first argument.')
    console.log('')
    return
  }

  console.log('Testing /verify...')
  console.log(`   Image URL: ${testImageUrl}`)

  try {
    const res = await fetch(`${BASE_URL}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-${Date.now()}`,
      },
      body: JSON.stringify({
        inputType: 'image',
        imageUrl: testImageUrl,
        mode: 'sync',
      }),
    })

    const data = await res.json()

    if (data.success) {
      const tx = data.data?.result?.transactionData
      console.log('Verification Result:')
      console.log(`   Status: ${data.data?.status}`)
      console.log(`   Valid: ${data.data?.result?.valid}`)
      console.log(`   UUID: ${data.data?.uuid}`)
      if (tx) {
        console.log(`   Amount: ${tx.amount} ${tx.currency || 'THB'}`)
        console.log(`   Date: ${tx.transactionDate || 'N/A'}`)
        console.log(`   Sender: ${tx.sender?.name || 'N/A'}`)
        console.log(`   Receiver: ${tx.receiver?.name || 'N/A'}`)
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
  await testCreditsBalance()
  await testVerifySlip()
  await testVerifyEndpoint()

  console.log('Test complete.')
})()
