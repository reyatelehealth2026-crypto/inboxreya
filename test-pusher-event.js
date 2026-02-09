/**
 * Test script to send a Pusher event and verify it works
 */

const fs = require('fs')
const path = require('path')

// Read .env.local
const envPath = path.join(__dirname, '.env.local')
let envContent = ''
try {
  envContent = fs.readFileSync(envPath, 'utf8')
} catch (error) {
  console.error('Error reading .env.local:', error.message)
  process.exit(1)
}

// Parse environment variables
const envVars = {}
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim()
      let value = trimmed.substring(equalIndex + 1).trim()
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      envVars[key] = value
    }
  }
})

const PUSHER_APP_ID = envVars.PUSHER_APP_ID
const PUSHER_KEY = envVars.PUSHER_KEY
const PUSHER_SECRET = envVars.PUSHER_SECRET
const PUSHER_CLUSTER = envVars.PUSHER_CLUSTER || 'ap1'

if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET) {
  console.error('❌ Missing Pusher credentials in .env.local')
  process.exit(1)
}

// Import Pusher (server-side)
const Pusher = require('pusher')

const pusher = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: PUSHER_CLUSTER,
  useTLS: true,
})

// Test event data
const testEvent = {
  conversationId: '962', // Use the conversation ID from browser logs
  message: {
    id: `test-${Date.now()}`,
    userId: '962',
    direction: 'incoming',
    messageType: 'text',
    content: 'Test message from script',
    mediaUrl: null,
    createdAt: new Date().toISOString(),
    sentBy: null,
  },
}

console.log('🧪 Testing Pusher Event...')
console.log('📋 Event Data:', JSON.stringify(testEvent, null, 2))
console.log('📡 Channel: inbox')
console.log('📨 Event: new-message')
console.log('')

// Send event
pusher
  .trigger('inbox', 'new-message', testEvent)
  .then(() => {
    console.log('✅ Event sent successfully!')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Check browser console for: [Pusher] New message received:')
    console.log('   2. Check browser console for: [Pusher] Found queries to update:')
    console.log('   3. Check browser console for: [Pusher] Optimistically updated messages cache')
    console.log('   4. UI should update immediately without refresh')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed to send event:', error)
    process.exit(1)
  })
