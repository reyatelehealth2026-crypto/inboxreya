/**
 * Order Tasks API Route
 * GET /api/orders/tasks - Get order tasks (queue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderTasks, getOrderQueueCounts } from '@/lib/orders/queries';

// GET /api/orders/tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countsOnly = searchParams.get('counts') === 'true';
    
    // TODO: Get lineAccountId from session
    const lineAccountId = 1; // Placeholder

    if (countsOnly) {
      const counts = await getOrderQueueCounts(lineAccountId);
      return NextResponse.json({ counts });
    }

    const tasks = await getOrderTasks(lineAccountId);
    
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching order tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order tasks' },
      { status: 500 }
    );
  }
}
