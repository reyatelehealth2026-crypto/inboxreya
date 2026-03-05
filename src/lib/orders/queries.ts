/**
 * Order Database Queries
 * Direct MySQL queries for Odoo orders data
 */

import { prisma } from '@/lib/prisma';
import { Order, OrderStatus, OrderTask, OrderTaskType, OrdersResponse, OrderFilters } from './types';

// Helper to map database transaction to Order type
function mapTransactionToOrder(tx: any): Order {
  return {
    id: tx.id,
    orderNumber: tx.order_number,
    userId: tx.user_id,
    lineAccountId: tx.line_account_id,
    customerName: tx.shipping_name || 'ไม่ระบุชื่อ',
    customerPhone: tx.shipping_phone,
    customerAvatar: null,
    totalAmount: Number(tx.total_amount),
    shippingFee: Number(tx.shipping_fee || 0),
    discountAmount: Number(tx.discount_amount || 0),
    grandTotal: Number(tx.grand_total),
    status: mapStatus(tx.status),
    paymentMethod: tx.payment_method,
    paymentStatus: tx.payment_status || 'pending',
    shippingName: tx.shipping_name,
    shippingPhone: tx.shipping_phone,
    shippingAddress: tx.shipping_address,
    shippingTracking: tx.shipping_tracking,
    shippingProvider: tx.shipping_provider,
    note: tx.note,
    adminNote: tx.admin_note,
    itemCount: 0, // Will be populated separately if needed
    createdAt: tx.created_at.toISOString(),
    updatedAt: tx.updated_at.toISOString(),
    shippedAt: tx.shipped_at?.toISOString() || null,
  };
}

// Map database status to OrderStatus
function mapStatus(status: string | null): OrderStatus {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'pending';
    case 'paid':
    case 'processing':
      return 'processing';
    case 'shipping':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

// Map OrderStatus to database status values
function mapStatusToDb(status: OrderStatus): string[] {
  switch (status) {
    case 'pending':
      return ['pending', 'confirmed'];
    case 'processing':
      return ['paid', 'processing'];
    case 'shipped':
      return ['shipping'];
    case 'delivered':
      return ['delivered'];
    case 'cancelled':
      return ['cancelled'];
    default:
      return [status];
  }
}

/**
 * Get orders by status
 */
export async function getOrdersByStatus(
  status: OrderStatus,
  lineAccountId?: number,
  limit: number = 50,
  offset: number = 0
): Promise<Order[]> {
  const dbStatuses = mapStatusToDb(status);
  
  const transactions = await prisma.transactions.findMany({
    where: {
      status: { in: dbStatuses },
      ...(lineAccountId && { line_account_id: lineAccountId }),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });

  return transactions.map(mapTransactionToOrder);
}

/**
 * Get all orders with filters
 */
export async function getOrders(
  filters: OrderFilters = {},
  lineAccountId?: number,
  page: number = 1,
  limit: number = 20
): Promise<OrdersResponse> {
  const { search, status, dateRange, sortBy } = filters;
  
  // Build where clause
  const where: any = {
    ...(lineAccountId && { line_account_id: lineAccountId }),
  };

  if (status && status !== 'all') {
    where.status = { in: mapStatusToDb(status) };
  }

  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }
    
    where.created_at = { gte: startDate };
  }

  if (search) {
    where.OR = [
      { order_number: { contains: search } },
      { shipping_name: { contains: search } },
      { shipping_phone: { contains: search } },
    ];
  }

  // Build orderBy
  let orderBy: any = { created_at: 'desc' };
  switch (sortBy) {
    case 'date_asc':
      orderBy = { created_at: 'asc' };
      break;
    case 'amount_desc':
      orderBy = { grand_total: 'desc' };
      break;
    case 'amount_asc':
      orderBy = { grand_total: 'asc' };
      break;
    case 'urgent':
      orderBy = [{ created_at: 'asc' }, { grand_total: 'desc' }];
      break;
  }

  const [transactions, total] = await Promise.all([
    prisma.transactions.findMany({
      where,
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.transactions.count({ where }),
  ]);

  return {
    orders: transactions.map(mapTransactionToOrder),
    total,
    page,
    limit,
    hasMore: total > page * limit,
  };
}

/**
 * Get order by ID
 */
export async function getOrderById(id: number): Promise<Order | null> {
  const transaction = await prisma.transactions.findUnique({
    where: { id },
  });

  if (!transaction) return null;
  return mapTransactionToOrder(transaction);
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus
): Promise<Order | null> {
  const dbStatus = mapStatusToDb(status)[0];
  
  const updateData: any = { status: dbStatus };
  
  // Set shipped_at timestamp when status changes to shipped
  if (status === 'shipped') {
    updateData.shipped_at = new Date();
  }

  const transaction = await prisma.transactions.update({
    where: { id: orderId },
    data: updateData,
  });

  return mapTransactionToOrder(transaction);
}

/**
 * Bulk update order status
 */
export async function bulkUpdateOrderStatus(
  orderIds: number[],
  status: OrderStatus
): Promise<number> {
  const dbStatus = mapStatusToDb(status)[0];
  
  const updateData: any = { status: dbStatus };
  
  if (status === 'shipped') {
    updateData.shipped_at = new Date();
  }

  const result = await prisma.transactions.updateMany({
    where: { id: { in: orderIds } },
    data: updateData,
  });

  return result.count;
}

/**
 * Get order counts by status
 */
export async function getOrderCountsByStatus(
  lineAccountId?: number
): Promise<Record<OrderStatus, number>> {
  const where: any = lineAccountId ? { line_account_id: lineAccountId } : {};
  
  const counts = await prisma.transactions.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  });

  const result: Record<string, number> = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  counts.forEach((c) => {
    const status = mapStatus(c.status);
    result[status] = (result[status] || 0) + c._count.status;
  });

  return result as Record<OrderStatus, number>;
}

/**
 * Get order tasks (smart calculation)
 * 1. ติดตามออเดอร์: created > 3 days AND status != 'delivered'
 * 2. ส่งบิล: payment_status != 'paid' AND status = 'delivered'
 * 3. ติดต่อลูกค้า: status = 'shipped' AND shipped > 3 days
 * 4. แจ้งปัญหา: webhook logs with errors
 */
export async function getOrderTasks(
  lineAccountId?: number
): Promise<Record<OrderTaskType, OrderTask[]>> {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const baseWhere: any = lineAccountId ? { line_account_id: lineAccountId } : {};

  // 1. Follow up orders (created > 3 days, not delivered)
  const followUpOrders = await prisma.transactions.findMany({
    where: {
      ...baseWhere,
      created_at: { lt: threeDaysAgo },
      status: { notIn: ['delivered', 'cancelled'] },
    },
    orderBy: { created_at: 'asc' },
    take: 20,
  });

  // 2. Send bill orders (delivered but not paid)
  const sendBillOrders = await prisma.transactions.findMany({
    where: {
      ...baseWhere,
      status: 'delivered',
      payment_status: { not: 'paid' },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  // 3. Contact customer (shipped > 3 days ago)
  const contactOrders = await prisma.transactions.findMany({
    where: {
      ...baseWhere,
      status: 'shipping',
      shipped_at: { lt: threeDaysAgo },
    },
    orderBy: { shipped_at: 'asc' },
    take: 20,
  });

  // Map to tasks
  const followUp: OrderTask[] = followUpOrders.map((o) => ({
    id: `follow-${o.id}`,
    type: 'follow_up',
    orderId: o.id,
    orderNumber: o.order_number,
    customerName: o.shipping_name || 'ไม่ระบุชื่อ',
    title: 'ติดตามออเดอร์',
    description: `ออเดอร์เกิน 3 วัน สถานะ: ${mapStatus(o.status)}`,
    priority: o.created_at < sevenDaysAgo ? 'high' : 'medium',
    createdAt: o.created_at.toISOString(),
    dueDate: null,
  }));

  const sendBill: OrderTask[] = sendBillOrders.map((o) => ({
    id: `bill-${o.id}`,
    type: 'send_bill',
    orderId: o.id,
    orderNumber: o.order_number,
    customerName: o.shipping_name || 'ไม่ระบุชื่อ',
    title: 'ส่งบิล/ใบเสร็จ',
    description: `รอชำระเงิน ฿${Number(o.grand_total).toLocaleString()}`,
    priority: 'medium',
    createdAt: o.created_at.toISOString(),
    dueDate: null,
  }));

  const contact: OrderTask[] = contactOrders.map((o) => ({
    id: `contact-${o.id}`,
    type: 'contact',
    orderId: o.id,
    orderNumber: o.order_number,
    customerName: o.shipping_name || 'ไม่ระบุชื่อ',
    title: 'ติดต่อลูกค้า',
    description: 'จัดส่งแล้วเกิน 3 วัน ยังไม่ยืนยัน',
    priority: 'medium',
    createdAt: o.shipped_at?.toISOString() || o.created_at.toISOString(),
    dueDate: null,
  }));

  // 4. Issues - check webhook logs for errors (simplified)
  const issue: OrderTask[] = [];

  return {
    follow_up: followUp,
    send_bill: sendBill,
    contact,
    issue,
  };
}

/**
 * Get order queue counts (for badges)
 */
export async function getOrderQueueCounts(
  lineAccountId?: number
): Promise<Record<OrderTaskType, number>> {
  const tasks = await getOrderTasks(lineAccountId);
  
  return {
    follow_up: tasks.follow_up.length,
    send_bill: tasks.send_bill.length,
    contact: tasks.contact.length,
    issue: tasks.issue.length,
  };
}
