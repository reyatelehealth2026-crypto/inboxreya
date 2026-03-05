// API Route: /api/reports/sales-summary/route.ts
// รายงานสรุปยอดขายแบบละเอียดสำหรับ Dashboard

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
    const days = parseInt(searchParams.get('days') || '7');
    const limit = Math.min(10, parseInt(searchParams.get('limit') || '5'));

    // วันที่เริ่มต้น
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 1. สรุปยอดขายรวม
    const [salesSummary] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT partner_id) as total_customers,
        COALESCE(SUM(amount_total), 0) as total_revenue,
        COALESCE(AVG(amount_total), 0) as avg_order_value
      FROM odoo_orders
      WHERE date_order >= ?
        AND state NOT IN ('cancel', 'draft')
    `, [startDateStr]);

    // 2. สถานะออเดอร์ - แก้ไขให้ใช้ subquery แทน window function
    const [orderStatus] = await pool.execute(`
      SELECT 
        COALESCE(state_display, 'ไม่ระบุ') as status,
        COUNT(*) as count,
        COALESCE(SUM(amount_total), 0) as total_amount
      FROM odoo_orders
      WHERE date_order >= ?
        AND state NOT IN ('cancel', 'draft')
      GROUP BY state_display
      ORDER BY count DESC
    `, [startDateStr]);

    // คำนวณ percentage แยก
    const totalOrdersForPercent = (orderStatus as any[]).reduce((sum, s) => sum + Number(s.count), 0);
    const orderStatusWithPercent = (orderStatus as any[]).map(s => ({
      ...s,
      percentage: totalOrdersForPercent > 0 
        ? ((Number(s.count) / totalOrdersForPercent) * 100).toFixed(1)
        : '0'
    }));

    // 3. Top ลูกค้า
    const [topCustomers] = await pool.execute(`
      SELECT 
        o.partner_id,
        MAX(olu.odoo_customer_code) as customer_code,
        MAX(olu.odoo_partner_name) as customer_name,
        COUNT(*) as order_count,
        SUM(o.amount_total) as total_spent,
        AVG(o.amount_total) as avg_order_value
      FROM odoo_orders o
      LEFT JOIN odoo_line_users olu ON o.partner_id = olu.odoo_partner_id
      WHERE o.date_order >= ?
        AND o.state NOT IN ('cancel', 'draft')
      GROUP BY o.partner_id
      ORDER BY total_spent DESC
      LIMIT ?
    `, [startDateStr, limit]);

    // 4. Top เซลล์ - ใช้ salesperson_id ถ้ามี ไม่เช่นนั้น return empty
    let topSales: any[] = [];
    try {
      // ตรวจสอบว่า odoo_orders มี column salesperson_id หรือ user_id
      const [colCheck] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'odoo_orders'
          AND COLUMN_NAME IN ('salesperson_id', 'user_id', 'salesman_id')
      `);
      const salesCol = (colCheck as any[])[0]?.COLUMN_NAME as string | undefined;

      if (salesCol) {
        const [salesResult] = await pool.execute(`
          SELECT 
            COALESCE(a.display_name, a.username, 'ไม่ระบุ') as sales_name,
            COUNT(*) as order_count,
            SUM(o.amount_total) as total_sales,
            AVG(o.amount_total) as avg_order_value
          FROM odoo_orders o
          LEFT JOIN admin_users a ON o.${salesCol} = a.id
          WHERE o.date_order >= ?
            AND o.state NOT IN ('cancel', 'draft')
            AND o.${salesCol} IS NOT NULL
          GROUP BY o.${salesCol}, a.display_name, a.username
          ORDER BY total_sales DESC
          LIMIT 3
        `, [startDateStr]);
        topSales = salesResult as any[];
      }
    } catch (e) {
      console.log('Top sales query failed, returning empty:', e);
      topSales = [];
    }

    // 5. สถิติรายวัน
    const [dailyStats] = await pool.execute(`
      SELECT 
        DATE(date_order) as date,
        COUNT(*) as orders,
        SUM(amount_total) as revenue,
        COUNT(DISTINCT partner_id) as customers
      FROM odoo_orders
      WHERE date_order >= ?
        AND state NOT IN ('cancel', 'draft')
      GROUP BY DATE(date_order)
      ORDER BY date DESC
      LIMIT 7
    `, [startDateStr]);

    // 6. เปรียบเทียบกับช่วงก่อนหน้า
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

    const [prevPeriod] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(amount_total), 0) as total_revenue,
        COUNT(DISTINCT partner_id) as total_customers
      FROM odoo_orders
      WHERE date_order >= ?
        AND date_order < ?
        AND state NOT IN ('cancel', 'draft')
    `, [prevStartDateStr, startDateStr]);

    // คำนวณ % การเปลี่ยนแปลง
    const current = (salesSummary as any[])[0];
    const previous = (prevPeriod as any[])[0];
    
    const changes = {
      orders: previous.total_orders > 0 
        ? ((current.total_orders - previous.total_orders) / previous.total_orders * 100).toFixed(1)
        : '0',
      revenue: previous.total_revenue > 0
        ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue * 100).toFixed(1)
        : '0',
      customers: previous.total_customers > 0
        ? ((current.total_customers - previous.total_customers) / previous.total_customers * 100).toFixed(1)
        : '0',
    };

    // สร้าง Insights
    const insights = generateInsights(
      current,
      previous,
      dailyStats as any[],
      orderStatus as any[]
    );

    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString().split('T')[0]
      },
      summary: {
        totalOrders: Number(current.total_orders),
        totalCustomers: Number(current.total_customers),
        totalRevenue: Number(current.total_revenue),
        avgOrderValue: Number(current.avg_order_value),
        changes
      },
      orderStatus: orderStatusWithPercent,
      topCustomers: (topCustomers as any[]).map((c, i) => ({
        rank: i + 1,
        customerCode: c.customer_code || `CUST-${c.partner_id}`,
        customerName: c.customer_name || 'ไม่ระบุชื่อ',
        orderCount: Number(c.order_count),
        totalSpent: Number(c.total_spent),
        avgOrderValue: Number(c.avg_order_value)
      })),
      topSales: (topSales as any[]).map((s, i) => ({
        rank: i + 1,
        salesName: s.sales_name,
        orderCount: Number(s.order_count),
        totalSales: Number(s.total_sales),
        avgOrderValue: Number(s.avg_order_value)
      })),
      dailyStats: dailyStats as any[],
      insights
    });

  } catch (error: any) {
    console.error('Error generating sales report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error?.message },
      { status: 500 }
    );
  }
}

// ฟังก์ชันสร้าง Insights
function generateInsights(current: any, previous: any, dailyStats: any[], orderStatus: any[]) {
  const insights = {
    positive: [] as string[],
    warnings: [] as string[]
  };

  const currentRevenue = Number(current.total_revenue);
  const prevRevenue = Number(previous.total_revenue);
  const currentOrders = Number(current.total_orders);
  const prevOrders = Number(previous.total_orders);

  // ข้อดี
  if (currentRevenue > prevRevenue) {
    const growth = ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1);
    insights.positive.push(`ยอดขายเติบโต ${growth}% จากช่วงก่อนหน้า`);
  }

  if (currentOrders > prevOrders) {
    insights.positive.push(`จำนวนออเดอร์เพิ่มขึ้น ${currentOrders - prevOrders} รายการ`);
  }

  // หาวันที่มียอดสูงสุด
  if (dailyStats.length > 0) {
    const topDay = dailyStats.reduce((max, day) => 
      Number(day.revenue) > Number(max.revenue) ? day : max
    );
    insights.positive.push(`วันที่มียอดสูงสุด: ${formatThaiDate(topDay.date)} (${Number(topDay.revenue).toLocaleString()} บาท)`);
  }

  // ข้อควรระวัง
  const pendingStatus = orderStatus.find(s => 
    s.status?.toLowerCase().includes('packing') || 
    s.status?.toLowerCase().includes('picker')
  );
  
  if (pendingStatus && pendingStatus.count > 50) {
    insights.warnings.push(`มีออเดอร์รอดำเนินการสะสม ${pendingStatus.count} รายการ`);
  }

  const deliveredStatus = orderStatus.find(s => 
    s.status?.toLowerCase().includes('delivered')
  );
  
  if (deliveredStatus) {
    const deliveredPercent = Number(deliveredStatus.percentage);
    if (deliveredPercent < 40) {
      insights.warnings.push(`อัตราการจัดส่งสำเร็จต่ำ (${deliveredPercent}%) ควรตรวจสอบการดำเนินงาน`);
    }
  }

  // เช็คยอดเฉลี่ยต่อออเดอร์
  const currentAvg = Number(current.avg_order_value);
  const prevAvg = prevOrders > 0 ? (prevRevenue / prevOrders) : 0;
  
  if (currentAvg < prevAvg * 0.9) {
    insights.warnings.push(`ยอดเฉลี่ยต่อออเดอร์ลดลง ${((1 - currentAvg/prevAvg) * 100).toFixed(1)}%`);
  }

  return insights;
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}
