/**
 * LINE Groups Statistics API
 * GET /api/inbox/groups/stats - Get group statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { phpApiRequest } from '@/lib/api-utils';
import { cacheQuery, CACHE_TTL } from '@/lib/redis';

/**
 * Convert snake_case keys to camelCase recursively
 */
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }
  
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  
  return obj;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminId = parseInt(session.user.id);
    const defaultLineAccountId = session.user.lineAccountId || 3;
    const { searchParams } = new URL(request.url);
    const lineAccountId = searchParams.get('lineAccountId') || defaultLineAccountId;

    const data = await cacheQuery(
      `groups:stats:${lineAccountId}`,
      async () => {
        const response = await phpApiRequest(
          `/api/inbox-groups.php?action=get_stats&line_account_id=${lineAccountId}`,
          {
            method: 'GET',
            headers: {
              'X-Admin-ID': adminId?.toString() || '',
              'X-Line-Account-ID': lineAccountId?.toString() || '',
            },
          }
        );

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch stats');
        }

        return toCamelCase(response.data);
      },
      CACHE_TTL.GROUPS  // 60s
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Group stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
