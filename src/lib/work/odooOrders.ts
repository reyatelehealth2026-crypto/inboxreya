// Odoo Orders Integration - ดึงข้อมูลออเดอร์จาก Odoo Webhooks
// ใช้ร่วมกับระบบ Daily Work Dashboard

export type OdooOrderStatus = "pending" | "processing" | "completed" | "cancelled" | "unknown";
export type WebhookStatus = "received" | "processing" | "success" | "failed" | "duplicate" | "retry" | "dead_letter";

export interface OdooOrder {
  id: string;                    // รูปแบบ: odoo-{id}
  source: "odoo";                // ระบุว่ามาจาก Odoo
  orderId: number;               // Odoo Order ID
  eventType: string;             // เช่น order.validated, order.shipped
  customerName: string;
  customerPhone: string;
  customerId: string | null;     // line_user_id
  amount: number;                // ยอดเงินรวม
  status: OdooOrderStatus;       // pending, processing, completed
  webhookStatus: WebhookStatus;  // success, processing, failed
  receivedAt: Date;
  processedAt: Date | null;
  retryCount: number;
  errorMessage: string | null;
  rawPayload: any;               // ข้อมูลเต็มจาก Odoo
  lineUserId: string | null;     // สำหรับเชื่อมกับแชท
}

export interface OdooOrderSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface OdooOrdersResponse {
  success: boolean;
  data: OdooOrder[];
  summary: OdooOrderSummary;
}

/**
 * ดึงข้อมูลออเดอร์จาก Odoo Webhooks
 * @param options - ตัวเลือกการกรองข้อมูล
 */
export const getOdooOrders = async (options?: {
  status?: OdooOrderStatus;
  assignedToMe?: boolean;
  limit?: number;
}): Promise<OdooOrdersResponse> => {
  try {
    const params = new URLSearchParams();
    
    if (options?.status) {
      params.append("status", options.status);
    }
    if (options?.assignedToMe) {
      params.append("assignedToMe", "true");
    }
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }

    const response = await fetch(`/api/odoo/orders?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Odoo orders: ${response.status}`);
    }

    const result = await response.json();
    
    // แปลงวันที่ให้เป็น Date object
    if (result.data) {
      result.data = result.data.map((order: any) => ({
        ...order,
        receivedAt: new Date(order.receivedAt),
        processedAt: order.processedAt ? new Date(order.processedAt) : null,
      }));
    }

    return result;
  } catch (error: any) {
    console.error("Error fetching Odoo orders:", error);
    return {
      success: false,
      data: [],
      summary: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
    };
  }
};

/**
 * ดึงสรุปออเดอร์ทั้งหมด (สำหรับแสดงใน Dashboard Summary)
 */
export const getOdooOrdersSummary = async (): Promise<OdooOrderSummary> => {
  const response = await getOdooOrders({ limit: 1 });
  return response.summary;
};

/**
 * แปลง Odoo Order เป็นรูปแบบ Work Item (ให้เข้ากับระบบ Daily Work)
 */
export const mapOdooOrderToWorkItem = (order: OdooOrder) => {
  const priority: "urgent" | "high" | "normal" | "low" = order.amount > 5000 ? "urgent" : "normal";
  
  return {
    id: order.id,
    customerId: order.customerId || order.orderId.toString(),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    lineDisplayName: undefined,
    type: "order" as const,
    status: mapOdooStatusToWorkStatus(order.status),
    priority,
    title: `ออเดอร์ #${order.orderId} - ${order.customerName}`,
    lastMessage: `ยอดรวม: ฿${order.amount.toLocaleString()}`,
    lastMessageTime: order.receivedAt.toISOString(),
    unreadCount: order.webhookStatus === "failed" ? 1 : 0,
    orderAmount: order.amount,
    tags: [mapEventTypeToLabel(order.eventType)],
    assignedTo: undefined,
    createdAt: order.receivedAt.toISOString(),
    updatedAt: order.processedAt?.toISOString() || order.receivedAt.toISOString(),
    source: "odoo" as const,
    odooOrderId: order.orderId,
    odooEventType: order.eventType,
    odooPayload: order.rawPayload,
  };
};

// Helper: แปลง Odoo status เป็น WorkStatus
function mapOdooStatusToWorkStatus(odooStatus: OdooOrderStatus): "pending" | "in_progress" | "waiting" | "completed" {
  switch (odooStatus) {
    case "pending":
      return "pending";
    case "processing":
      return "in_progress";
    case "completed":
      return "completed";
    case "cancelled":
      return "completed"; // ถือว่าจบงานแล้ว
    default:
      return "waiting";
  }
}

// Helper: แปลง event type เป็นชื่อที่อ่านง่าย
function mapEventTypeToLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "order.validated": "รอดำเนินการ",
    "order.confirmed": "ยืนยันออเดอร์",
    "order.processing": "กำลังเตรียม",
    "order.shipped": "จัดส่งแล้ว",
    "order.delivered": "ส่งถึงแล้ว",
    "order.cancelled": "ยกเลิก",
  };
  return labels[eventType] || eventType;
}

/**
 * รวมข้อมูล Conversations + Odoo Orders เข้าด้วยกัน
 * สำหรับแสดงใน Daily Work Dashboard
 */
export const getCombinedWorkItems = async (assignedToMe: boolean = false) => {
  // ดึงข้อมูลพร้อมกัน
  const [conversationsRes, odooOrdersRes] = await Promise.all([
    // Conversations จาก Inbox API
    fetch(`/api/inbox/conversations?limit=100${assignedToMe ? "&assignedTo=me" : ""}`).then(r => r.json()),
    // Odoo Orders
    getOdooOrders({ assignedToMe, limit: 100 }),
  ]);

  // แปลง Conversations เป็น Work Items
  const conversationWorkItems = (conversationsRes.data || []).map((conv: any) => ({
    id: conv.id,
    customerId: conv.user.id,
    customerName: conv.user.displayName || conv.user.firstName || "Unknown",
    customerAvatar: conv.user.pictureUrl,
    lineDisplayName: conv.user.lineUserId,
    type: "chat" as const,
    status: mapConversationStatus(conv.status),
    priority: (conv.unreadCount > 5) ? "urgent" : "normal",
    title: conv.lastMessage?.content?.slice(0, 30) || "ไม่มีข้อความ",
    lastMessage: conv.lastMessage?.content || "",
    lastMessageTime: conv.updatedAt || new Date().toISOString(),
    unreadCount: conv.unreadCount || 0,
    tags: conv.tags?.map((t: any) => t.name) || [],
    assignedTo: conv.assignees?.[0]?.id,
    createdAt: conv.user.createdAt,
    updatedAt: conv.updatedAt,
    source: "inbox",
  }));

  // แปลง Odoo Orders เป็น Work Items
  const odooWorkItems = odooOrdersRes.data.map(mapOdooOrderToWorkItem);

  // รวมและเรียงตามเวลาล่าสุด
  const combined = [...conversationWorkItems, ...odooWorkItems].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return {
    items: combined,
    summary: {
      conversations: conversationWorkItems.length,
      odooOrders: odooWorkItems.length,
      total: combined.length,
      pending: combined.filter(i => i.status === "pending").length,
      inProgress: combined.filter(i => i.status === "in_progress").length,
      completed: combined.filter(i => i.status === "completed").length,
    },
  };
};

// Helper: แปลง conversation status
function mapConversationStatus(status: string | null): "pending" | "in_progress" | "waiting" | "completed" {
  if (!status) return "pending";
  if (status === "new") return "pending";
  if (status === "in_progress") return "in_progress";
  if (status === "waiting") return "waiting";
  if (status === "resolved") return "completed";
  return "pending";
}
