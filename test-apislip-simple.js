#!/usr/bin/env node
/**
 * Simple test for HaveSLIP API.
 *
 * Usage:
 *   node test-apislip-simple.js <image_url>
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const apiKeyMatch = envContent.match(/HAVESLIP_API_KEY="?([^"\r\n]+)"?/)
const baseUrlMatch = envContent.match(/HAVESLIP_API_BASE_URL="?([^"\r\n]+)"?/)

if (!apiKeyMatch) {
  console.error('HAVESLIP_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = apiKeyMatch[1]
const BASE_URL = (baseUrlMatch?.[1] || 'https://api.haveslip.com/api').replace(/\/$/, '')

console.log('API Key loaded:', API_KEY.substring(0, 10) + '...')
console.log('')

async function testCreditsBalance() {
  console.log('Test 1: Get credits balance...')

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
    console.error('Failed:', err.message)
  }
  console.log('')
}

async function testVerifySlip() {
  const testImageUrl = process.argv[2]

  if (!testImageUrl) {
    console.log('Test 2: Skipped (no image URL provided)')
    console.log('   Usage: node test-apislip-simple.js <image_url>')
    console.log('')
    return
  }

  console.log('Test 2: Verify slip from URL...')
  console.log(`   Image: ${testImageUrl}`)

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

    if (data.success && data.data?.status === 'completed' && data.data?.result?.valid) {
      const tx = data.data.result.transactionData || {}
      console.log('Verification Success!')
      console.log(`   Amount: ${tx.amount} ${tx.currency || 'THB'}`)
      console.log(`   Ref: ${data.data.uuid}`)
      console.log(`   Date: ${tx.transactionDate}`)
      console.log(`   Sender: ${tx.sender?.name || '-'}`)
      console.log(`   Sender Bank: ${tx.sender?.bank || '-'}`)
      console.log(`   Receiver: ${tx.receiver?.name || '-'}`)
      console.log(`   Receiver Bank: ${tx.receiver?.bank || '-'}`)
    } else {
      console.log('Verification failed')
      console.log(`   Status: ${data.data?.status || '-'}`)
      console.log(`   Message: ${data.message || data.error || data.data?.error || '-'}`)
    }
  } catch (err) {
    console.error('Failed:', err.message)
  }
  console.log('')
}

;(async () => {
  await testCreditsBalance()
  await testVerifySlip()
})()
