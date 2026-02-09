/**
 * LINE Group Members Sync API
 * POST /api/inbox/groups/[id]/sync-members - Sync members from LINE API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { phpApiRequest } from '@/lib/api-utils';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log('=== SYNC MEMBERS API START ===');
  
  try {
    // ใช้ getToken แทน auth() เพราะทำงานได้ดีกว่าใน API routes
    const token = await getToken({ 
      req: request as any,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET 
    });
    
    console.log('Token check:', token ? 'Found' : 'Not found');
    
    if (!token) {
      console.error('Sync members: No token found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const adminId = parseInt(token.id as string);
    const lineAccountId = (token.lineAccountId as number) || 3;
    const { id: groupId } = await context.params;

    console.log('Sync members request:', {
      adminId,
      lineAccountId,
      groupId,
      phpUrl: process.env.NEXT_PUBLIC_PHP_API_URL,
    });

    // Validate inputs
    if (!adminId || isNaN(adminId)) {
      console.error('Invalid admin ID:', adminId);
      return NextResponse.json(
        { success: false, error: 'Invalid admin ID' },
        { status: 400 }
      );
    }

    if (!groupId || isNaN(parseInt(groupId))) {
      console.error('Invalid group ID:', groupId);
      return NextResponse.json(
        { success: false, error: 'Invalid group ID' },
        { status: 400 }
      );
    }

    console.log('Calling phpApiRequest...');
    
    // ส่ง action ใน query string เพราะ PHP อ่านจาก $_GET['action']
    const timestamp = Date.now();
    const response = await phpApiRequest(`/api/inbox-groups.php?action=sync_members&_t=${timestamp}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-ID': adminId.toString(),
        'X-Line-Account-ID': lineAccountId.toString(),
      },
      body: JSON.stringify({
        group_id: parseInt(groupId),
      }),
    });

    console.log('Sync members response:', response);
    console.log('=== SYNC MEMBERS API SUCCESS ===');

    return NextResponse.json(response);
  } catch (error) {
    console.error('=== SYNC MEMBERS API ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        errorType: error?.constructor?.name,
      },
      { status: 500 }
    );
  }
}
