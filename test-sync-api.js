/**
 * Test sync members API from Next.js
 * Run: node test-sync-api.js
 */

const groupId = 1;

async function testSyncAPI() {
  console.log('🔍 Testing Sync Members API');
  console.log('='.repeat(60));
  console.log();

  try {
    console.log(`1️⃣ Calling POST /api/inbox/groups/${groupId}/sync-members`);
    
    const response = await fetch(`http://localhost:3000/api/inbox/groups/${groupId}/sync-members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add cookie if you have one
        // 'Cookie': 'your-session-cookie'
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log();

    const data = await response.json();
    
    console.log('2️⃣ Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    if (data.success) {
      console.log('✅ Success!');
      console.log(`   Synced: ${data.data?.syncedCount || 0} members`);
      console.log(`   Errors: ${data.data?.errorCount || 0}`);
      console.log(`   Total found: ${data.data?.totalFound || 0}`);
    } else {
      console.log('❌ Failed!');
      console.log(`   Error: ${data.error}`);
      if (data.details) {
        console.log(`   Details: ${data.details}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  console.log();
  console.log('='.repeat(60));
}

testSyncAPI();
