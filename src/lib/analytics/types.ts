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

export interface AnalyticsData {
  segments: CustomerSegment[];
  topCustomers: TopCustomer[];
  stats: SalesStats;
  behaviorPatterns: BehaviorPattern[];
}
