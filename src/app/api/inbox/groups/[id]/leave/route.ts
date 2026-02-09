/**
 * Leave Group API Route
 * POST /api/inbox/groups/[id]/leave - Leave a LINE group
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.lineAccountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    // Call PHP backend to leave group
    const phpUrl = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://re-ya.com';
    const response = await fetch(`${phpUrl}/api/inbox-groups.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Account-ID': String(session.user.lineAccountId),
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        action: 'leave_group',
        group_id: groupId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to leave group via PHP backend');
    }

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.message || 'Failed to leave group' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Left group successfully',
    });
  } catch (error) {
    console.error('Leave group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
