#!/usr/bin/env node
/**
 * Simple test for Thunder slip verification API.
 *
 * Usage:
 *   node test-apislip-simple.js <image_url>
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const apiKeyMatch = envContent.match(/THUNDER_API_KEY="?([^"\r\n]+)"?/)
const baseUrlMatch = envContent.match(/THUNDER_API_BASE_URL="?([^"\r\n]+)"?/)

if (!apiKeyMatch) {
  console.error('THUNDER_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = apiKeyMatch[1]
const BASE_URL = (baseUrlMatch?.[1] || 'https://api.thunder.in.th/v2').replace(/\/$/, '')

console.log('API Key loaded:', API_KEY.substring(0, 8) + '...')
console.log('')

async function testInfo() {
  console.log('Test 1: Get app info...')

  try {
    const res = await fetch(`${BASE_URL}/info`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })

    const data = await res.json()

    if (data.success) {
      console.log('App Info:')
      console.log(`   Application: ${data.data.application?.name || '-'}`)
      console.log(`   Branch: ${data.data.branch?.name || '-'}`)
      console.log(`   Credit: ${data.data.account?.credit ?? '-'}`)
      console.log(`   Quota Remaining: ${data.data.application?.quota?.remaining ?? '-'}`)
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
    const res = await fetch(`${BASE_URL}/verify/bank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testImageUrl,
        checkDuplicate: true,
      }),
    })

    const data = await res.json()

    if (data.success && data.data?.rawSlip) {
      const slip = data.data.rawSlip
      console.log('Verification Success!')
      console.log(`   Amount: ${slip.amount?.amount} ${slip.amount?.local?.currency || 'THB'}`)
      console.log(`   Ref: ${slip.transRef}`)
      console.log(`   Date: ${slip.date}`)
      console.log(`   Sender: ${slip.sender?.account?.name?.th || slip.sender?.account?.name?.en || '-'}`)
      console.log(`   Sender Bank: ${slip.sender?.bank?.name || slip.sender?.bank?.short || '-'}`)
      console.log(`   Receiver: ${slip.receiver?.account?.name?.th || slip.receiver?.account?.name?.en || '-'}`)
      console.log(`   Receiver Bank: ${slip.receiver?.bank?.name || slip.receiver?.bank?.short || '-'}`)
      console.log(`   Duplicate: ${data.data.isDuplicate}`)
    } else {
      console.log('Verification failed')
      console.log(`   Code: ${data.error?.code || '-'}`)
      console.log(`   Message: ${data.error?.message || data.message || '-'}`)
    }
  } catch (err) {
    console.error('Failed:', err.message)
  }
  console.log('')
}

;(async () => {
  await testInfo()
  await testVerifySlip()
})()
