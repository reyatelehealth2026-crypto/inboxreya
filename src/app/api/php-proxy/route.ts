/**
 * PHP Backend Proxy
 * Proxies requests to PHP backend to avoid Vercel Security Checkpoint
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

async function proxyRequest(request: NextRequest, method: string) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }

    const phpBackendUrl = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com';
    
    // Simply append the endpoint to backend URL
    // The endpoint already contains the full path with query string
    const targetUrl = `${phpBackendUrl}${endpoint}`;
    
    console.log('[PHP Proxy] Method:', method);
    console.log('[PHP Proxy] Endpoint:', endpoint);
    console.log('[PHP Proxy] Target URL:', targetUrl);

    // Forward relevant headers
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'InboxReya-NextJS-Proxy/1.0',
      'Accept': 'application/json',
    };

    // Forward authentication headers
    const adminId = request.headers.get('x-admin-id');
    const lineAccountId = request.headers.get('x-line-account-id');
    
    if (adminId) forwardHeaders['X-Admin-ID'] = adminId;
    if (lineAccountId) forwardHeaders['X-Line-Account-ID'] = lineAccountId;

    console.log('[PHP Proxy] Forward headers:', forwardHeaders);

    // Prepare request options
    const fetchOptions: RequestInit = {
      method,
      headers: forwardHeaders,
      cache: 'no-store',
    };

    // Add body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      try {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      } catch (e) {
        console.log('[PHP Proxy] No body to forward');
      }
    }

    // Make request to PHP backend
    const response = await fetch(targetUrl, fetchOptions);
    
    console.log('[PHP Proxy] Response status:', response.status);
    console.log('[PHP Proxy] Response headers:', Object.fromEntries(response.headers.entries()));

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[PHP Proxy] Non-JSON response:', text.substring(0, 500));
      
      return NextResponse.json(
        {
          success: false,
          error: 'PHP backend returned non-JSON response',
          contentType,
          preview: text.substring(0, 200),
        },
        { status: 500 }
      );
    }

    // Forward JSON response
    const data = await response.json();
    console.log('[PHP Proxy] Response data:', data);

    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('[PHP Proxy] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Proxy request failed',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
