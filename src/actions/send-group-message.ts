/**
 * Server Action: Send Message to LINE Group
 */

'use server';

import { auth } from '@/lib/auth';
import { phpApiRequest } from '@/lib/api-utils';

export async function sendGroupMessage(groupId: number, message: string) {
  try {
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

    if (!message || !message.trim()) {
      return {
        success: false,
        error: 'Message cannot be empty',
      };
    }

    console.log('Send group message:', {
      adminId,
      lineAccountId,
      groupId,
      messageLength: message.length,
    });

    // Call PHP backend
    const response = await phpApiRequest('/api/inbox-groups.php?action=send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-ID': adminId.toString(),
        'X-Line-Account-ID': lineAccountId.toString(),
      },
      body: JSON.stringify({
        group_id: groupId,
        message: message.trim(),
      }),
    });

    return response;
  } catch (error) {
    console.error('Send group message error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };
  }
}
