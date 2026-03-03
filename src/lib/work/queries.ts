// Daily Work Dashboard - Queries & Mock Data
// Phase 1: Client-side data with optimistic UI

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

// Generate realistic mock data - 45 items for performance testing
const generateMockData = (): CustomerWork[] => {
  const customers = [
    { name: "คุณสมชาย วงษ์ใหญ่", line: "Somchai_W" },
    { name: "คุณมานี สวยงาม", line: "Maneeya_S" },
    { name: "คุณประเสริฐ รุ่งโรจน์", line: "Prasert_R" },
    { name: "คุณนภา แสงอรุณ", line: "Napa_Sunrise" },
    { name: "คุณวิชัย เก่งกาจ", line: "Wichai_K" },
    { name: "คุณรัตนา มงคล", line: "Rattana_M" },
    { name: "คุณสมศักดิ์ ใจดี", line: "Somsak_JD" },
    { name: "คุณอรทัย สุขสันต์", line: "Onthai_Happy" },
    { name: "คุณชัยวัฒน์ พัฒนา", line: "Chaiwat_P" },
    { name: "คุณพรทิพย์ ดาวเด่น", line: "Pornthip_Star" },
    { name: "คุณสุรชัย รักไทย", line: "Surachai_Love" },
    { name: "คุณนิภา ใจเย็น", line: "Nipa_Calm" },
    { name: "คุณธนพล กำลังดี", line: "Thanapol_OK" },
    { name: "คุณวันดี มีชัย", line: "Wandee_Win" },
    { name: "คุณสมพงษ์ เข็มแข็ง", line: "Sompong_Strong" },
    { name: "ร้านขายยาบ้านสวน", line: "BaanSuan_Pharmacy" },
    { name: "คลินิกหมอใจดี", line: "Kind_Doctor" },
    { name: "คุณลุงสมหมาย", line: "Sommai_Uncle" },
    { name: "คุณป้าแก้วใจดี", line: "Kaew_Auntie" },
    { name: "โรงพยาบาลส่งเสริมสุขภาพ", line: "Health_Promote" },
  ];

  const tags = ["VIP", "ประจำ", "ใหม่", "ติดตาม", "ส่งฟรี", "เก็บเงินปลายทาง", "ต้องรีบ", "สอบถามยา"];
  
  const messages = [
    "อยากสั่งยาแก้ปวดหัวค่ะ",
    "สอบถามราคายาตัวนี้หน่อยครับ",
    "สั่งซื้อตามเดิมอีกชุดนะคะ",
    "มีโปรโมชั่นไหมคะ?",
    "ยาที่สั่งไปถึงไหนแล้วครับ",
    "ขอเปลี่ยนที่จัดส่งค่ะ",
    "มีอาการแพ้ยาควรทำยังไงดี",
    "ขอใบเสร็จด้วยค่ะ",
    "ส่งของวันนี้ได้ไหมครับ",
    "ต้องการยาสามัญประจำบ้าน",
    "มีคูปองส่วนลดไหมคะ",
    "ขอคำปรึกษาเรื่องยาค่ะ",
  ];

  const statuses: WorkStatus[] = ["pending", "in_progress", "waiting", "completed"];
  const priorities: Priority[] = ["urgent", "high", "normal", "low"];
  const types: WorkType[] = ["chat", "order", "inquiry", "complaint"];

  return Array.from({ length: 45 }, (_, i) => {
    const customer = customers[i % customers.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    // Urgent items usually have high priority
    const finalPriority = status === "pending" && Math.random() > 0.7 ? "urgent" : priority;
    
    const now = new Date();
    const timeOffset = Math.floor(Math.random() * 28800000); // 0-8 hours ago
    const updatedAt = new Date(now.getTime() - timeOffset);
    
    return {
      id: `work-${i + 1}`,
      customerId: `cust-${(i % 20) + 1}`,
      customerName: customer.name,
      lineDisplayName: customer.line,
      type,
      status,
      priority: finalPriority,
      title: type === "order" ? `ออเดอร์ #ORD-${2024000 + i}` : message.slice(0, 30),
      lastMessage: message,
      lastMessageTime: updatedAt.toISOString(),
      unreadCount: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : 0,
      orderAmount: type === "order" ? Math.floor(Math.random() * 5000) + 100 : undefined,
      tags: [tags[Math.floor(Math.random() * tags.length)]],
      assignedTo: Math.random() > 0.3 ? "current-user" : undefined,
      createdAt: new Date(updatedAt.getTime() - 86400000).toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  });
};

// Mock data store
let mockData: CustomerWork[] = generateMockData();

// Get all work items
export const getAllWork = async (): Promise<CustomerWork[]> => {
  // Simulate API delay (optimistic UI will handle this smoothly)
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [...mockData].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

// Get work summary
export const getWorkSummary = async (): Promise<WorkSummaryData> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  return {
    totalPending: mockData.filter(w => w.status === "pending").length,
    inProgress: mockData.filter(w => w.status === "in_progress").length,
    waitingResponse: mockData.filter(w => w.status === "waiting").length,
    completedToday: mockData.filter(w => w.status === "completed").length,
    urgentCount: mockData.filter(w => w.priority === "urgent" && w.status !== "completed").length,
  };
};

// Search and filter work items (client-side for Phase 1)
export const searchWork = async (
  query: string,
  filters?: {
    status?: WorkStatus[];
    priority?: Priority[];
    type?: WorkType[];
  }
): Promise<CustomerWork[]> => {
  await new Promise((resolve) => setTimeout(resolve, 80));
  
  let results = [...mockData];
  
  // Text search
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
  
  // Apply filters
  if (filters?.status?.length) {
    results = results.filter(w => filters.status!.includes(w.status));
  }
  if (filters?.priority?.length) {
    results = results.filter(w => filters.priority!.includes(w.priority));
  }
  if (filters?.type?.length) {
    results = results.filter(w => filters.type!.includes(w.type));
  }
  
  return results.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

// Update work status (optimistic UI support)
export const updateWorkStatus = async (
  workId: string, 
  newStatus: WorkStatus
): Promise<CustomerWork> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  const index = mockData.findIndex(w => w.id === workId);
  if (index === -1) throw new Error("Work not found");
  
  mockData[index] = {
    ...mockData[index],
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  
  return mockData[index];
};

// Get work by status (for Kanban columns)
export const getWorkByStatus = async (status: WorkStatus): Promise<CustomerWork[]> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockData
    .filter(w => w.status === status)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};
