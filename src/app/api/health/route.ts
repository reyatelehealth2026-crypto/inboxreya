import { NextResponse } from 'next/server'

/**
 * Health Check Endpoint
 * Used for connectivity checks and monitoring
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
