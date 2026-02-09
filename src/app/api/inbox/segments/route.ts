import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ segments: [] });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Segment creation is currently disabled' }, { status: 503 });
}
