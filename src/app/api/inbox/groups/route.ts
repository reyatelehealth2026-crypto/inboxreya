/**
 * LINE Groups API - List and manage groups
 * GET /api/inbox/groups - List all groups
 * POST /api/inbox/groups - Send message to group
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
    console.log('=== Groups API GET Request ===');
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    let session;
    try {
      session = await auth();
      console.log('Session retrieved:', session ? 'Found' : 'Not found');
    } catch (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication failed',
          details: authError instanceof Error ? authError.message : 'Unknown auth error'
        },
        { status: 500 }
      );
    }
    
    if (!session?.user) {
      console.error('No session or user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No session' },
        { status: 401 }
      );
    }

    // Get user data from session
    const adminId = parseInt(session.user.id);
    const lineAccountId = session.user.lineAccountId || 3;
    
    console.log('Admin ID:', adminId);
    console.log('Line Account ID:', lineAccountId);

    const { searchParams } = new URL(request.url);
    const requestedLineAccountId = searchParams.get('lineAccountId');
    const finalLineAccountId = requestedLineAccountId || lineAccountId;
    const isActive = searchParams.get('isActive');
    const groupType = searchParams.get('groupType');
    const search = searchParams.get('search');

    // Build query parameters
    const params = new URLSearchParams({
      action: 'get_groups',
    });

    // Only add line_account_id if it's specified
    if (finalLineAccountId && finalLineAccountId !== '0') {
      params.append('line_account_id', finalLineAccountId?.toString());
    }

    if (isActive !== null) {
      params.append('is_active', isActive);
    }
    if (groupType) {
      params.append('group_type', groupType);
    }
    if (search) {
      params.append('search', search);
    }

    console.log('Request URL:', `/api/inbox-groups.php?${params.toString()}`);
    console.log('Request Headers:', {
      'X-Admin-ID': adminId?.toString() || '',
      'X-Line-Account-ID': finalLineAccountId?.toString() || '3',
    });

    let response;
    try {
      response = await phpApiRequest(
        `/api/inbox-groups.php?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'X-Admin-ID': adminId?.toString() || '',
            'X-Line-Account-ID': finalLineAccountId?.toString() || '3',
          },
        }
      );
    } catch (phpError) {
      console.error('PHP API Request Error:', phpError);
      return NextResponse.json(
        { 
          success: false, 
          error: phpError instanceof Error ? phpError.message : 'PHP backend request failed',
          details: phpError instanceof Error ? phpError.stack : String(phpError)
        },
        { status: 500 }
      );
    }

    console.log('PHP API Response:', response);

    if (!response.success) {
      console.error('PHP API Error:', response.error);
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch groups' },
        { status: 500 }
      );
    }

    // Convert snake_case to camelCase
    const transformedData = toCamelCase(response.data);

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Groups API error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get session data
    const adminId = parseInt(session.user.id);
    const lineAccountId = session.user.lineAccountId || 3;

    const body = await request.json();
    const { groupId, message, action } = body;

    if (!groupId || isNaN(parseInt(groupId))) {
      return NextResponse.json(
        { success: false, error: 'Valid Group ID is required' },
        { status: 400 }
      );
    }

    // Send message to group
    if (action === 'send_message') {
      if (!message || typeof message !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Message is required' },
          { status: 400 }
        );
      }

      if (message.length > 2000) {
        return NextResponse.json(
          { success: false, error: 'Message is too long (max 2000 characters)' },
          { status: 400 }
        );
      }

      const response = await phpApiRequest('/api/inbox-groups.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-ID': adminId?.toString() || '',
          'X-Line-Account-ID': lineAccountId?.toString() || '1',
        },
        body: JSON.stringify({
          action: 'send_message',
          group_id: groupId,
          message,
        }),
      });

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Groups POST API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
