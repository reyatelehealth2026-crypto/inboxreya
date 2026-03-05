/**
 * Order Types
 * Desktop-optimized sales order dashboard types
 */

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type OrderTaskType = 'follow_up' | 'send_bill' | 'contact' | 'issue';

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  lineAccountId: number | null;
  customerName: string;
  customerPhone: string | null;
  customerAvatar: string | null;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  grandTotal: number;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingTracking: string | null;
  shippingProvider: string | null;
  note: string | null;
  adminNote: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;
  isPinned?: boolean;
  isSelected?: boolean;
}

export interface OrderTask {
  id: string;
  type: OrderTaskType;
  orderId: number;
  orderNumber: string;
  customerName: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  dueDate: string | null;
}

export interface OrderQueue {
  followUp: OrderTask[];
  sendBill: OrderTask[];
  contact: OrderTask[];
  issue: OrderTask[];
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | 'all';
  dateRange?: 'today' | 'week' | 'month' | 'all';
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'urgent';
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface OrderUpdatePayload {
  status?: OrderStatus;
  adminNote?: string;
  shippingTracking?: string;
  shippingProvider?: string;
}

export interface BulkOrderUpdatePayload {
  orderIds: number[];
  status: OrderStatus;
}

// Kanban column configuration
export interface KanbanColumn {
  id: OrderStatus;
  title: string;
  color: string;
  bgColor: string;
  count: number;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'pending', title: 'รอดำเนินการ', color: '#F59E0B', bgColor: '#FEF3C7', count: 0 },
  { id: 'processing', title: 'กำลังจัดส่ง', color: '#F97316', bgColor: '#FFEDD5', count: 0 },
  { id: 'shipped', title: 'จัดส่งแล้ว', color: '#3B82F6', bgColor: '#DBEAFE', count: 0 },
  { id: 'delivered', title: 'สำเร็จ', color: '#22C55E', bgColor: '#DCFCE7', count: 0 },
];

// Keyboard shortcuts
export interface KeyboardShortcut {
  key: string;
  modifier?: 'ctrl' | 'meta' | 'alt' | 'shift';
  description: string;
  action: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'k', modifier: 'meta', description: 'ค้นหา', action: 'search' },
  { key: 'n', modifier: 'meta', description: 'สร้างออเดอร์ใหม่', action: 'new_order' },
  { key: '1', description: 'เปลี่ยนเป็นรอดำเนินการ', action: 'status_pending' },
  { key: '2', description: 'เปลี่ยนเป็นกำลังจัดส่ง', action: 'status_processing' },
  { key: '3', description: 'เปลี่ยนเป็นจัดส่งแล้ว', action: 'status_shipped' },
  { key: '4', description: 'เปลี่ยนเป็นสำเร็จ', action: 'status_delivered' },
  { key: 'e', description: 'แก้ไขออเดอร์', action: 'edit' },
  { key: 'Enter', description: 'เปิดรายละเอียด', action: 'open_detail' },
  { key: 'ArrowUp', description: 'เลือกออเดอร์ก่อนหน้า', action: 'navigate_up' },
  { key: 'ArrowDown', description: 'เลือกออเดอร์ถัดไป', action: 'navigate_down' },
  { key: 'a', modifier: 'meta', description: 'เลือกทั้งหมด', action: 'select_all' },
  { key: 'Escape', description: 'ยกเลิก/ปิด', action: 'cancel' },
];
