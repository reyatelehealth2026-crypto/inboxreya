/**
 * Server Action: Sync Group Members from LINE API
 * Server actions have better auth support in Next.js 15
 */

'use server';

import { auth } from '@/lib/auth';
import { phpApiRequest } from '@/lib/api-utils';

export async function syncGroupMembers(groupId: number) {
  try {
    // auth() works perfectly in server actions
    const session = await auth();
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized - Please log in',
      };
    }

    const adminId = parseInt(session.user.id);
    const lineAccountId = session.user.lineAccountId || 3;

    // Validate inputs
    if (!adminId || isNaN(adminId)) {
      return {
        success: false,
        error: 'Invalid admin ID',
      };
    }

    if (!groupId || isNaN(groupId)) {
      return {
        success: false,
        error: 'Invalid group ID',
      };
    }

    console.log('=== SYNC MEMBERS SERVER ACTION ===');
    console.log('Sync members server action:', {
      adminId,
      lineAccountId,
      groupId,
      phpUrl: process.env.NEXT_PUBLIC_PHP_API_URL,
    });

    // Call PHP backend - ส่ง action ใน query string เพราะ PHP อ่านจาก $_GET['action']
    console.log('Calling PHP API...');
    
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    const endpoint = `api/inbox-groups.php?action=sync_members&_t=${timestamp}`;
    
    console.log('Endpoint:', endpoint);
    console.log('Request body:', { group_id: groupId });
    
    const response = await phpApiRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-ID': adminId.toString(),
        'X-Line-Account-ID': lineAccountId.toString(),
      },
      body: JSON.stringify({
        group_id: groupId,
      }),
    });

    console.log('PHP API response:', response);
    console.log('=== SYNC MEMBERS SERVER ACTION COMPLETE ===');
    
    return response;
  } catch (error) {
    console.error('=== SYNC MEMBERS SERVER ACTION ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Full error object:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      errorType: error?.constructor?.name,
    };
  }
}
