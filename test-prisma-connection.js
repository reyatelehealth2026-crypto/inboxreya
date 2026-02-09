/**
 * Test Prisma Connection and New Models
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔌 Testing Prisma connection...\n');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Connected to database successfully\n');
    
    // Test new models
    console.log('📊 Testing new models:\n');
    
    // Test GhostDraft model
    const ghostDraftCount = await prisma.ghostDraft.count();
    console.log(`  ✓ GhostDraft model: ${ghostDraftCount} records`);
    
    // Test ImageAnalysisResult model
    const imageAnalysisCount = await prisma.imageAnalysisResult.count();
    console.log(`  ✓ ImageAnalysisResult model: ${imageAnalysisCount} records`);
    
    // Test SlaTracking model
    const slaTrackingCount = await prisma.slaTracking.count();
    console.log(`  ✓ SlaTracking model: ${slaTrackingCount} records`);
    
    // Test BroadcastMessageV2 model
    const broadcastV2Count = await prisma.broadcastMessageV2.count();
    console.log(`  ✓ BroadcastMessageV2 model: ${broadcastV2Count} records`);
    
    // Test existing models that we'll use
    console.log('\n📊 Testing existing models:\n');
    
    const quickReplyCount = await prisma.quick_reply_templates.count();
    console.log(`  ✓ quick_reply_templates: ${quickReplyCount} records`);
    
    const customerSegmentCount = await prisma.customer_segments.count();
    console.log(`  ✓ customer_segments: ${customerSegmentCount} records`);
    
    const richMenuCount = await prisma.rich_menus.count();
    console.log(`  ✓ rich_menus: ${richMenuCount} records`);
    
    const scheduledMessageCount = await prisma.scheduled_messages.count();
    console.log(`  ✓ scheduled_messages: ${scheduledMessageCount} records`);
    
    const conversationAssigneeCount = await prisma.conversationAssignee.count();
    console.log(`  ✓ ConversationAssignee: ${conversationAssigneeCount} records`);
    
    console.log('\n✅ All models accessible!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testConnection()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
