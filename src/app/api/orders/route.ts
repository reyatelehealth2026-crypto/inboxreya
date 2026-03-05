/**
 * Orders API Route
 * GET /api/orders - Get orders with filters
 * PATCH /api/orders - Bulk update orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrders, bulkUpdateOrderStatus, getOrderCountsByStatus } from '@/lib/orders/queries';
import { OrderStatus, OrderFilters } from '@/lib/orders/types';

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const status = searchParams.get('status') as OrderStatus | 'all' | null;
    const search = searchParams.get('search') || undefined;
    const dateRange = searchParams.get('dateRange') as OrderFilters['dateRange'] || 'all';
    const sortBy = searchParams.get('sortBy') as OrderFilters['sortBy'] || 'date_desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const countsOnly = searchParams.get('counts') === 'true';
    
    // TODO: Get lineAccountId from session
    const lineAccountId = 1; // Placeholder

    if (countsOnly) {
      const counts = await getOrderCountsByStatus(lineAccountId);
      return NextResponse.json({ counts });
    }

    const filters: OrderFilters = {
      ...(status && status !== 'all' && { status }),
      ...(search && { search }),
      dateRange,
      sortBy,
    };

    const response = await getOrders(filters, lineAccountId, page, limit);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders - Bulk update
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds, status } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'orderIds array is required' },
        { status: 400 }
      );
    }

    if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required' },
        { status: 400 }
      );
    }

    const updatedCount = await bulkUpdateOrderStatus(orderIds, status as OrderStatus);
    
    return NextResponse.json({ 
      success: true, 
      updatedCount,
      message: `Updated ${updatedCount} orders to ${status}`
    });
  } catch (error) {
    console.error('Error updating orders:', error);
    return NextResponse.json(
      { error: 'Failed to update orders' },
      { status: 500 }
    );
  }
}
