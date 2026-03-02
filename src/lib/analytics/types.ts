export interface CustomerSegment {
  name: string;
  tier: 'vip' | 'gold' | 'silver' | 'bronze';
  minSpent: number;
  maxSpent?: number;
  count: number;
  percentage: number;
}

export interface TopCustomer {
  memberId: string;
  name: string | null;
  totalSpent: number;
  orderCount: number;
  tier: string;
  avgOrderValue?: number;
}

export interface SalesStats {
  totalRevenue: number;
  totalCustomers: number;
  avgOrderValue: number;
  totalOrders: number;
}

export interface BehaviorPattern {
  name: string;
  description: string;
  count: number;
  percentage: number;
}

// --- New Unified Analytics Types ---

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ComplaintCategory {
  category: string;
  count: number;
  percentage: number;
}

export interface RecentIssue {
  id: string;
  userId: number;
  userName: string | null;
  message: string;
  category: string;
  urgency: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
  detectedAt: string;
}

export interface TopComplainer {
  userId: number;
  userName: string | null;
  complaintCount: number;
  lastComplaintAt: string;
}

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  keywords: string[];
  categories: string[];
  summary: string;
  isComplaint: boolean;
  urgency: 'high' | 'medium' | 'low';
}

export interface MessageForAnalysis {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
}

export interface UnifiedAnalyticsData {
  // Overview
  stats: SalesStats & { avgSentiment: number };
  
  // Sales
  salesTrend: SalesTrendPoint[];
  
  // Customers
  segments: CustomerSegment[];
  topCustomers: TopCustomer[];
  behaviorPatterns: BehaviorPattern[];
  
  // AI Insights
  sentimentDistribution: SentimentDistribution;
  complaintCategories: ComplaintCategory[];
  recentIssues: RecentIssue[];
  topComplainers: TopComplainer[];
}

export interface DailyMetrics {
  date: string;
  metricType: 'sales' | 'sentiment' | 'complaints';
  metricData: Record<string, unknown>;
  updatedAt: string;
}
