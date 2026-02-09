/**
 * Debug endpoint to check session status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Debug Session Endpoint ===');
    
    const session = await auth();
    
    console.log('Session exists:', !!session);
    console.log('Session data:', JSON.stringify(session, null, 2));
    
    return NextResponse.json({
      success: true,
      data: {
        hasSession: !!session,
        user: session?.user || null,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Debug session error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
