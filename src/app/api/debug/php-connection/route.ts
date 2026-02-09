/**
 * Debug endpoint to test PHP backend connection
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Debug PHP Connection ===');
    
    const phpBackendUrl = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com';
    const testUrl = `${phpBackendUrl}/api/test-json-response.php`;
    
    console.log('Testing URL:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return NextResponse.json({
        success: false,
        error: 'PHP returned non-JSON response',
        contentType,
        responsePreview: text.substring(0, 500),
      }, { status: 500 });
    }
    
    const data = await response.json();
    console.log('PHP response:', data);
    
    return NextResponse.json({
      success: true,
      data: {
        phpBackendUrl,
        testUrl,
        phpResponse: data,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Debug PHP connection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
