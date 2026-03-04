// Daily Work Dashboard - Queries with Real Data Integration
// Using the existing Inbox API + Odoo Webhooks

import { getOdooOrders, mapOdooOrderToWorkItem, OdooOrder } from './odooOrders';

export type Priority = "urgent" | "high" | "normal" | "low";
export type WorkStatus = "pending" | "in_progress" | "waiting" | "completed";
export type WorkType = "chat" | "order" | "inquiry" | "complaint";

export interface CustomerWork {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  lineDisplayName?: string;
  type: WorkType;
  status: WorkStatus;
  priority: Priority;
  title: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  orderAmount?: number;
  tags: string[];
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  source?: "inbox" | "odoo";      // แหล่งที่มาของข้อมูล
  odooOrderId?: number;           // ถ้าเป็นออเดอร์จาก Odoo
  odooEventType?: string;         // event type จาก Odoo
  odooPayload?: any;              // ข้อมูลเต็มจาก Odoo
}

export interface WorkSummaryData {
  totalPending: number;
  inProgress: number;
  waitingResponse: number;
  completedToday: number;
  urgentCount: number;
  odooOrdersCount?: number;       // จำนวนออเดอร์จาก Odoo
  conversationsCount?: number;    // จำนวนแชทจาก Inbox
}

/**
 * Mapping Dashboard -> API
 * pending -> new
 * in_progress -> in_progress
 * waiting -> waiting
 * completed -> resolved
 */

// Helper to map API status to Dashboard status
const mapStatusToDashboard = (apiStatus: string | null): WorkStatus => {
  if (!apiStatus) return "pending";
  const s = apiStatus.toLowerCase();
  if (s === "new") return "pending";
  if (s === "in_progress") return "in_progress";
  if (s === "waiting") return "waiting";
  if (s === "resolved") return "completed";
  return "pending"; // default
};

// Helper to map Dashboard status to API status
const mapStatusToApi = (dashboardStatus: WorkStatus): string => {
  if (dashboardStatus === "pending") return "new";
  if (dashboardStatus === "in_progress") return "in_progress";
  if (dashboardStatus === "waiting") return "waiting";
  if (dashboardStatus === "completed") return "resolved";
  return "new";
};

// Get Conversations from Inbox API
export const getInboxConversations = async (assignedToMe: boolean = false): Promise<CustomerWork[]> => {
  try {
    const url = assignedToMe 
      ? '/api/inbox/conversations?limit=200&assignedTo=me' 
      : '/api/inbox/conversations?limit=200';
    
    console.log('[DEBUG] getInboxConversations - url:', url);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    const result = await response.json();
    const { data } = result;
    
    console.log('[DEBUG] getInboxConversations - items:', data?.length);
    
    if (!data) return [];

    return data.map((conv: any): CustomerWork => ({
      id: conv.id,
      customerId: conv.user.id,
      customerName: conv.user.displayName || conv.user.firstName || "Unknown",
      customerAvatar: conv.user.pictureUrl,
      lineDisplayName: conv.user.lineUserId,
      type: "chat",
      status: mapStatusToDashboard(conv.status),
      priority: (conv.unreadCount > 5) ? "urgent" : "normal",
      title: conv.lastMessage?.content?.slice(0, 30) || "No message",
      lastMessage: conv.lastMessage?.content || "",
      lastMessageTime: conv.updatedAt || new Date().toISOString(),
      unreadCount: conv.unreadCount || 0,
      tags: conv.tags?.map((t: any) => t.name) || [],
      assignedTo: conv.assignees?.[0]?.id,
      createdAt: conv.user.createdAt,
      updatedAt: conv.updatedAt || new Date().toISOString(),
      source: "inbox",
    }));
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
};

// Get Odoo Orders
export const getOdooWorkOrders = async (assignedToMe: boolean = false): Promise<CustomerWork[]> => {
  try {
    const result = await getOdooOrders({ assignedToMe, limit: 100 });
    
    if (!result.success) {
      console.error('[DEBUG] getOdooWorkOrders - failed:', result);
      return [];
    }

    console.log('[DEBUG] getOdooWorkOrders - items:', result.data?.length);
    
    return result.data.map(mapOdooOrderToWorkItem);
  } catch (error) {
    console.error("Error fetching Odoo orders:", error);
    return [];
  }
};

// Get ALL Work Items (Inbox + Odoo) - ฟังก์ชันหลักที่ใช้ใน Dashboard
export const getAllWork = async (assignedToMe: boolean = false): Promise<CustomerWork[]> => {
  console.log('[DEBUG] getAllWork - START, assignedToMe:', assignedToMe);
  
  // ดึงข้อมูลทั้งสองแหล่งพร้อมกัน
  const [conversations, odooOrders] = await Promise.all([
    getInboxConversations(assignedToMe),
    getOdooWorkOrders(assignedToMe),
  ]);
  
  console.log('[DEBUG] getAllWork - Conversations:', conversations.length, 'Odoo Orders:', odooOrders.length);
  
  // รวมข้อมูลและเรียงตามเวลาล่าสุด
  const combined = [...conversations, ...odooOrders].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  
  console.log('[DEBUG] getAllWork - TOTAL:', combined.length);
  
  return combined;
};

// Get work summary
export const getWorkSummary = async (assignedToMe: boolean = false): Promise<WorkSummaryData> => {
  const items = await getAllWork(assignedToMe);
  
  // แยกนับตามแหล่งที่มา
  const conversationsCount = items.filter(i => i.source === "inbox" || !i.source).length;
  const odooOrdersCount = items.filter(i => i.source === "odoo").length;
  
  return {
    totalPending: items.filter(w => w.status === "pending").length,
    inProgress: items.filter(w => w.status === "in_progress").length,
    waitingResponse: items.filter(w => w.status === "waiting").length,
    completedToday: items.filter(w => w.status === "completed").length,
    urgentCount: items.filter(w => w.priority === "urgent" && w.status !== "completed").length,
    conversationsCount,
    odooOrdersCount,
  };
};

// Search and filter work items
export const searchWork = async (
  query: string,
  filters?: {
    status?: WorkStatus[];
    priority?: Priority[];
    type?: WorkType[];
    assignedToMe?: boolean;
  }
): Promise<CustomerWork[]> => {
  let results = await getAllWork(filters?.assignedToMe);
  
  if (query.trim()) {
    const searchTerm = query.toLowerCase();
    results = results.filter(w => 
      w.customerName.toLowerCase().includes(searchTerm) ||
      w.lineDisplayName?.toLowerCase().includes(searchTerm) ||
      w.title.toLowerCase().includes(searchTerm) ||
      w.lastMessage.toLowerCase().includes(searchTerm) ||
      w.tags.some(t => t.toLowerCase().includes(searchTerm)) ||
      w.odooOrderId?.toString().includes(searchTerm)  // ค้นหาจาก Order ID
    );
  }
  
  if (filters?.status?.length) {
    results = results.filter(w => filters.status!.includes(w.status));
  }
  
  if (filters?.type?.length) {
    results = results.filter(w => filters.type!.includes(w.type));
  }
  
  return results;
};

// Update work status
export const updateWorkStatus = async (
  workId: string, 
  newStatus: WorkStatus
): Promise<CustomerWork | null> => {
  // ถ้าเป็น Odoo Order (id ขึ้นต้นด้วย odoo-)
  if (workId.startsWith('odoo-')) {
    console.log('[DEBUG] Updating Odoo order status - not implemented yet:', workId);
    // TODO: ส่งคำขอไปยัง Odoo API หรือบันทึกลง database
    return null;
  }
  
  // สำหรับ Inbox Conversations
  const apiStatus = mapStatusToApi(newStatus);

  try {
    const response = await fetch(`/api/inbox/conversations/${workId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: apiStatus })
    });
    
    if (!response.ok) throw new Error('Failed to update status');
    return null;
  } catch (error) {
    console.error("Error updating status:", error);
    throw error;
  }
};
