// API Route: /api/odoo/orders/route.ts
// ดึงข้อมูลออเดอร์จาก odoo_webhooks_log สำหรับแสดงใน Dashboard

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'processing', 'completed'
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const assignedToMe = searchParams.get('assignedToMe') === 'true';

    // สร้าง IN clause สำหรับ event types (ปลอดภัย - ใช้ค่าที่ควบคุมได้เอง)
    let eventTypes = [
      'order.validated',
      'order.confirmed', 
      'order.processing',
      'order.shipped',
      'order.delivered',
      'order.cancelled'
    ];

    if (status === 'pending') {
      eventTypes = ['order.validated'];
    } else if (status === 'processing') {
      eventTypes = ['order.confirmed', 'order.processing'];
    } else if (status === 'completed') {
      eventTypes = ['order.shipped', 'order.delivered'];
    }

    // สร้าง placeholders สำหรับ parameterized query
    const eventPlaceholders = eventTypes.map(() => '?').join(',');
    const adminId = session.user.id ? parseInt(session.user.id) : null;

    let query: string;
    let params: any[] = [];

    if (assignedToMe && adminId) {
      // Query แบบกรองเฉพาะงานที่มอบหมายให้แอดมินคนนี้
      // ใช้ INNER JOIN กับ users และ conversation_multi_assignees
      query = `
        SELECT 
          o.id,
          o.order_id,
          o.event_type,
          o.payload,
          o.line_user_id,
          o.status as webhook_status,
          o.received_at,
          o.processing_started_at,
          o.processed_at,
          o.retry_count,
          o.error_message
        FROM odoo_webhooks_log o
        INNER JOIN users u ON o.line_user_id = u.line_user_id
        INNER JOIN conversation_multi_assignees cma ON u.id = cma.user_id
        WHERE o.event_type IN (${eventPlaceholders})
          AND o.status IN ('success', 'processing', 'received')
          AND cma.admin_id = ?
          AND cma.status = 'active'
        ORDER BY o.received_at DESC
        LIMIT ?
      `;
      params = [...eventTypes, adminId, limit];
    } else {
      // Query แบบไม่กรอง (ดึงทั้งหมด)
      query = `
        SELECT 
          id,
          order_id,
          event_type,
          payload,
          line_user_id,
          status as webhook_status,
          received_at,
          processing_started_at,
          processed_at,
          retry_count,
          error_message
        FROM odoo_webhooks_log
        WHERE event_type IN (${eventPlaceholders})
          AND status IN ('success', 'processing', 'received')
        ORDER BY received_at DESC
        LIMIT ?
      `;
      params = [...eventTypes, limit];
    }

    // Debug log
    console.log('[DEBUG] Odoo Orders Query:', {
      assignedToMe,
      adminId,
      eventTypesCount: eventTypes.length,
      paramsCount: params.length
    });

    // Execute query
    const [rows] = await pool.execute(query, params);
    const odooOrders = rows as any[];

    console.log('[DEBUG] Odoo Orders Result:', {
      count: odooOrders.length,
      firstOrder: odooOrders[0] ? { 
        id: odooOrders[0].id, 
        event_type: odooOrders[0].event_type,
        order_id: odooOrders[0].order_id
      } : null
    });

    // แปลงข้อมูลให้เหมาะสมกับ Dashboard
    const formattedOrders = odooOrders.map((order) => {
      let payload: any = {};
      try {
        payload = JSON.parse(order.payload || '{}');
      } catch (e) {
        console.error('Failed to parse payload:', e);
      }

      // ดึงข้อมูลลูกค้าจาก payload
      const customerName = payload?.customer?.name || 
                          payload?.partner?.name || 
                          'ลูกค้าไม่ระบุชื่อ';
      
      const customerPhone = payload?.customer?.phone || 
                           payload?.partner?.phone || 
                           payload?.customer?.mobile || 
                           '';

      // ดึงข้อมูลออเดอร์
      const orderAmount = payload?.amount_total || 
                         payload?.total_amount || 
                         0;

      const orderStatus = mapEventTypeToStatus(order.event_type);

      return {
        id: `odoo-${order.id}`,
        source: 'odoo',
        orderId: order.order_id,
        eventType: order.event_type,
        customerName,
        customerPhone,
        customerId: order.line_user_id,
        amount: orderAmount,
        status: orderStatus,
        webhookStatus: order.webhook_status,
        receivedAt: order.received_at,
        processedAt: order.processed_at,
        retryCount: order.retry_count,
        errorMessage: order.error_message,
        rawPayload: payload,
        lineUserId: order.line_user_id,
      };
    });

    // สรุปสถิติ
    const summary = {
      total: formattedOrders.length,
      pending: formattedOrders.filter(o => o.status === 'pending').length,
      processing: formattedOrders.filter(o => o.status === 'processing').length,
      completed: formattedOrders.filter(o => o.status === 'completed').length,
      failed: formattedOrders.filter(o => o.webhookStatus === 'failed').length,
    };

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      summary,
      debug: {
        assignedToMe,
        adminId,
        queryEventTypes: eventTypes,
        rawCount: odooOrders.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching Odoo orders:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Odoo orders', 
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function แปลง event_type เป็นสถานะที่เข้าใจง่าย
function mapEventTypeToStatus(eventType: string): string {
  const statusMap: Record<string, string> = {
    'order.validated': 'pending',      // รอดำเนินการ
    'order.confirmed': 'processing',    // กำลังเตรียมสินค้า
    'order.processing': 'processing',   // กำลังดำเนินการ
    'order.shipped': 'completed',       // จัดส่งแล้ว
    'order.delivered': 'completed',     // ส่งถึงแล้ว
    'order.cancelled': 'cancelled',     // ยกเลิก
  };
  return statusMap[eventType] || 'unknown';
}
