// Daily Work Dashboard - Queries with Real Data Integration
// Using the existing Inbox API

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
}

export interface WorkSummaryData {
  totalPending: number;
  inProgress: number;
  waitingResponse: number;
  completedToday: number;
  urgentCount: number;
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

// Get all work items from real API
export const getAllWork = async (): Promise<CustomerWork[]> => {
  try {
    const response = await fetch('/api/inbox/conversations?limit=200');
    if (!response.ok) throw new Error('Failed to fetch real data');
    const { data } = await response.json();
    
    if (!data) return [];

    return data.map((conv: any): CustomerWork => ({
      id: conv.id,
      customerId: conv.user.id,
      customerName: conv.user.displayName || conv.user.firstName || "Unknown",
      customerAvatar: conv.user.pictureUrl,
      lineDisplayName: conv.user.lineUserId,
      type: "chat",
      status: mapStatusToDashboard(conv.status),
      priority: (conv.unreadCount > 5) ? "urgent" : "normal", // Simple logic for priority
      title: conv.lastMessage?.content?.slice(0, 30) || "No message",
      lastMessage: conv.lastMessage?.content || "",
      lastMessageTime: conv.updatedAt || new Date().toISOString(),
      unreadCount: conv.unreadCount || 0,
      tags: conv.tags?.map((t: any) => t.name) || [],
      assignedTo: conv.assignees?.[0]?.id,
      createdAt: conv.user.createdAt,
      updatedAt: conv.updatedAt || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching real work data:", error);
    return [];
  }
};

// Get work summary
export const getWorkSummary = async (): Promise<WorkSummaryData> => {
  const items = await getAllWork();
  
  return {
    totalPending: items.filter(w => w.status === "pending").length,
    inProgress: items.filter(w => w.status === "in_progress").length,
    waitingResponse: items.filter(w => w.status === "waiting").length,
    completedToday: items.filter(w => w.status === "completed").length,
    urgentCount: items.filter(w => w.priority === "urgent" && w.status !== "completed").length,
  };
};

// Search and filter work items
export const searchWork = async (
  query: string,
  filters?: {
    status?: WorkStatus[];
    priority?: Priority[];
    type?: WorkType[];
  }
): Promise<CustomerWork[]> => {
  let results = await getAllWork();
  
  if (query.trim()) {
    const searchTerm = query.toLowerCase();
    results = results.filter(w => 
      w.customerName.toLowerCase().includes(searchTerm) ||
      w.lineDisplayName?.toLowerCase().includes(searchTerm) ||
      w.title.toLowerCase().includes(searchTerm) ||
      w.lastMessage.toLowerCase().includes(searchTerm) ||
      w.tags.some(t => t.toLowerCase().includes(searchTerm))
    );
  }
  
  if (filters?.status?.length) {
    results = results.filter(w => filters.status!.includes(w.status));
  }
  
  return results;
};

// Update work status
export const updateWorkStatus = async (
  workId: string, 
  newStatus: WorkStatus
): Promise<CustomerWork | null> => {
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
