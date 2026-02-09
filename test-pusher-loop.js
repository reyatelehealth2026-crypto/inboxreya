/**
 * Test script to send multiple Pusher events in a loop
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
const conversationId = process.argv[2] || '962'
let counter = 1

console.log('🧪 Testing Pusher Events (Loop Mode)...')
console.log('📋 Conversation ID:', conversationId)
console.log('📡 Channel: inbox')
console.log('📨 Event: new-message')
console.log('')
console.log('⏰ Sending events every 5 seconds...')
console.log('   Press Ctrl+C to stop')
console.log('')

const sendEvent = () => {
  const testEvent = {
    conversationId: conversationId,
    message: {
      id: `test-${Date.now()}-${counter}`,
      userId: conversationId,
      direction: 'incoming',
      messageType: 'text',
      content: `Test message #${counter} at ${new Date().toLocaleTimeString()}`,
      mediaUrl: null,
      createdAt: new Date().toISOString(),
      sentBy: null,
    },
  }

  pusher
    .trigger('inbox', 'new-message', testEvent)
    .then(() => {
      console.log(`✅ Event #${counter} sent: "${testEvent.message.content}"`)
      counter++
    })
    .catch((error) => {
      console.error(`❌ Failed to send event #${counter}:`, error.message)
    })
}

// Send first event immediately
sendEvent()

// Send events every 5 seconds
const interval = setInterval(sendEvent, 5000)

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping...')
  clearInterval(interval)
  process.exit(0)
})
