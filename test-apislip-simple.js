#!/usr/bin/env node
/**
 * Simple test for ApiSlip API
 */

const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const apiKeyMatch = envContent.match(/APISLIP_API_KEY="([^"]+)"/)

if (!apiKeyMatch) {
  console.error('❌ APISLIP_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = apiKeyMatch[1]
const BASE_URL = 'https://apislip-public.n0tify.pro'

console.log('🔑 API Key loaded:', API_KEY.substring(0, 10) + '...')
console.log('')

// Test 1: Check account info
async function testAccountInfo() {
  console.log('🧪 Test 1: Get account info...')
  
  try {
    const res = await fetch(`${BASE_URL}/api/v1/account/info`, {
      headers: { 'X-Api-Key': API_KEY }
    })
    
    const data = await res.json()
    
    if (data.success) {
      console.log('✅ Account Info:')
      console.log(`   Username: ${data.data.username}`)
      console.log(`   Credits: ${data.data.credits.balance} remaining`)
      console.log(`   Total Used: ${data.data.credits.totalUsed}`)
      if (data.data.currentPlan) {
        console.log(`   Plan: ${data.data.currentPlan.name}`)
      }
    } else {
      console.log('❌ Error:', data)
    }
  } catch (err) {
    console.error('❌ Failed:', err.message)
  }
  console.log('')
}

// Test 2: Verify slip with a sample image
async function testVerifySlip() {
  // You need to provide a real slip image URL
  const testImageUrl = process.argv[2]
  
  if (!testImageUrl) {
    console.log('🧪 Test 2: Skipped (no image URL provided)')
    console.log('   Usage: node test-apislip-simple.js <image_url>')
    console.log('')
    return
  }
  
  console.log(`🧪 Test 2: Verify slip from URL...`)
  console.log(`   Image: ${testImageUrl}`)
  
  try {
    // Download image
    console.log('   Downloading image...')
    const imageRes = await fetch(testImageUrl)
    
    if (!imageRes.ok) {
      console.log(`   ❌ Failed to download image (${imageRes.status})`)
      return
    }
    
    const imageBuffer = await imageRes.arrayBuffer()
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
    
    console.log(`   Image size: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB`)
    
    // Build FormData
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: contentType })
    formData.append('slip', blob, 'slip.jpg')
    
    // Call ApiSlip
    console.log('   Calling ApiSlip...')
    const res = await fetch(`${BASE_URL}/api/v1/verify/slip`, {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY },
      body: formData
    })
    
    const data = await res.json()
    
    if (data.success && data.data?.status === 'success') {
      console.log('✅ Verification Success!')
      console.log(`   Amount: ${data.data.transaction.amount} ${data.data.transaction.currency}`)
      console.log(`   Ref: ${data.data.transaction.refId}`)
      console.log(`   Date: ${data.data.transaction.date}`)
      console.log(`   Sender: ${data.data.transaction.sender?.name}`)
      console.log(`   Sender Bank: ${data.data.transaction.sender?.bank}`)
      console.log(`   Receiver: ${data.data.transaction.receiver?.name}`)
      console.log(`   Receiver Bank: ${data.data.transaction.receiver?.bank}`)
      console.log(`   Confidence: ${data.data.confidenceScore}%`)
    } else {
      console.log('❌ Verification failed')
      console.log(`   Status: ${data.data?.status}`)
      console.log(`   Message: ${data.data?.message}`)
    }
  } catch (err) {
    console.error('❌ Failed:', err.message)
  }
  console.log('')
}

// Run tests
;(async () => {
  await testAccountInfo()
  await testVerifySlip()
})()
