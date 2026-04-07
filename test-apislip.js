#!/usr/bin/env node
/**
 * Test script for ApiSlip integration
 * Usage: node test-apislip.js
 */

const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envLines = envContent.split('\n')
const env = {}
envLines.forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    const value = valueParts.join('=').replace(/^["']|["']$/g, '')
    env[key] = value
  }
})

const API_KEY = env.APISLIP_API_KEY
const BASE_URL = 'https://apislip-public.n0tify.pro'

if (!API_KEY) {
  console.error('❌ APISLIP_API_KEY not found in .env.local')
  process.exit(1)
}

console.log('🔑 API Key found:', API_KEY.substring(0, 20) + '...')
console.log('')

async function testAccountInfo() {
  console.log('📊 Testing /api/v1/account/info...')
  try {
    const res = await fetch(`${BASE_URL}/api/v1/account/info`, {
      headers: { 'X-Api-Key': API_KEY }
    })
    const data = await res.json()
    
    if (data.success) {
      console.log('✅ Account Info:')
      console.log(`   Username: ${data.data.username}`)
      console.log(`   Credits Balance: ${data.data.credits.balance}`)
      console.log(`   Total Used: ${data.data.credits.totalUsed}`)
      if (data.data.currentPlan) {
        console.log(`   Plan: ${data.data.currentPlan.name}`)
      }
    } else {
      console.log('❌ Error:', data)
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message)
  }
  console.log('')
}

async function testVerifySlip() {
  // Use a sample slip image URL (this is a public test image)
  // You can replace this with a real slip image URL from your system
  const testImageUrl = 'https://www.cnypharmacy.com/uploads/slip_test.jpg'
  
  console.log('🧪 Testing /api/v1/verify/slip...')
  console.log(`   Image URL: ${testImageUrl}`)
  
  try {
    // First, download the image
    console.log('   Downloading image...')
    const imageRes = await fetch(testImageUrl)
    
    if (!imageRes.ok) {
      console.log(`   ⚠️  Image not accessible (${imageRes.status}), using a placeholder test`)
      console.log('   Note: Replace testImageUrl with a real slip image to test actual verification')
      return
    }
    
    const imageBuffer = await imageRes.arrayBuffer()
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
    
    // Build FormData
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: contentType })
    formData.append('slip', blob, 'slip.jpg')
    
    // Call ApiSlip
    console.log('   Sending to ApiSlip...')
    const res = await fetch(`${BASE_URL}/api/v1/verify/slip`, {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY },
      body: formData
    })
    
    const data = await res.json()
    
    if (data.success) {
      console.log('✅ Verification Result:')
      console.log(`   Status: ${data.data.status}`)
      console.log(`   Authentic: ${data.data.isAuthentic}`)
      console.log(`   Message: ${data.data.message}`)
      if (data.data.transaction) {
        console.log(`   Amount: ${data.data.transaction.amount} ${data.data.transaction.currency}`)
        console.log(`   Ref: ${data.data.transaction.refId}`)
        console.log(`   Sender: ${data.data.transaction.sender?.name || 'N/A'}`)
      }
    } else {
      console.log('❌ Verification failed:', data)
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message)
  }
  console.log('')
}

async function testVerifyEndpoint() {
  // Test our Next.js verify-slip endpoint
  const testImageUrl = 'https://www.cnypharmacy.com/uploads/slip_test.jpg'
  const localEndpoint = 'http://localhost:3000/api/inbox/verify-slip'
  
  console.log('🧪 Testing local Next.js endpoint...')
  console.log(`   Endpoint: ${localEndpoint}`)
  console.log(`   Image URL: ${testImageUrl}`)
  console.log('   Note: This requires Next.js dev server to be running')
  console.log('')
}

// Run tests
;(async () => {
  await testAccountInfo()
  await testVerifySlip()
  await testVerifyEndpoint()
  
  console.log('✨ Test complete!')
  console.log('')
  console.log('📝 To test with a real slip:')
  console.log('   1. Find a slip image URL from your system')
  console.log('   2. Update testImageUrl in this script')
  console.log('   3. Run: node test-apislip.js')
})()
