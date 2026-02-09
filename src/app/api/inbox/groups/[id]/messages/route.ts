/**
 * Group Messages API Route
 * GET /api/inbox/groups/[id]/messages - Get group messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { phpApiRequest } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    const adminId = parseInt(session.user.id);
    const lineAccountId = session.user.lineAccountId || 3;

    // Fetch messages from PHP backend
    const response = await phpApiRequest(
      `/api/inbox-groups.php?action=get_messages&group_id=${groupId}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'X-Admin-ID': adminId.toString(),
          'X-Line-Account-ID': lineAccountId.toString(),
        },
      }
    );

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Failed to fetch messages' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data || [],
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
