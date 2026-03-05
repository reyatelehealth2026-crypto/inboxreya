'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { callPhpApi } from '@/lib/php-bridge';
import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Users,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebhookStats {
  today: number;
  total: number;
  success: number;
  failed: number;
  retry: number;
  dead_letter: number;
  unique_orders_today: number;
  notified_today: number;
  avg_latency_ms: number | null;
  last_webhook: string | null;
  events_by_type: Array<{ event_type: string; count: number }>;
  top_failed_events: Array<{ event_type: string; count: number }>;
}

interface WebhookLog {
  id: number;
  event_type: string;
  status: string;
  order_id: string | null;
  order_name: string | null;
  customer_name: string | null;
  customer_ref: string | null;
  amount_total: number | null;
  line_user_id: string | null;
  processed_at: string | null;
  created_at: string;
  error_message: string | null;
  new_state_display: string | null;
}

const eventLabels: Record<string, string> = {
  'sale.order.created': 'สร้างออเดอร์',
  'sale.order.confirmed': 'ยืนยันออเดอร์',
  'sale.order.done': 'ออเดอร์สำเร็จ',
  'sale.order.cancelled': 'ยกเลิกออเดอร์',
  'delivery.validated': 'เริ่มจัดเตรียม',
  'delivery.in_transit': 'กำลังจัดส่ง',
  'delivery.done': 'ส่งเสร็จแล้ว',
  'delivery.cancelled': 'ยกเลิกการส่ง',
  'invoice.created': 'สร้างใบแจ้งหนี้',
  'invoice.posted': 'ออกใบแจ้งหนี้',
  'invoice.paid': 'ชำระเงินแล้ว',
  'invoice.cancelled': 'ยกเลิกใบแจ้งหนี้',
  'order.validated': 'ยืนยันออเดอร์',
  'order.picker_assigned': 'มอบหมาย Picker',
  'order.picking': 'กำลังจัดสินค้า',
  'order.packed': 'แพ็คเสร็จ',
  'order.to_delivery': 'เตรียมจัดส่ง',
  'order.delivered': 'จัดส่งสำเร็จ',
  'order.cancelled': 'ยกเลิกออเดอร์',
};

const eventIcons: Record<string, string> = {
  'sale.order.confirmed': '🛒',
  'sale.order.cancelled': '❌',
  'sale.order.done': '✅',
  'delivery.validated': '📦',
  'delivery.in_transit': '🚚',
  'delivery.done': '✅',
  'invoice.posted': '🧾',
  'invoice.paid': '💰',
  'order.validated': '✅',
  'order.picking': '📦',
  'order.packed': '✅',
  'order.to_delivery': '🚚',
  'order.delivered': '✅',
  'order.cancelled': '❌',
};

const statusBadges: Record<string, { label: string; className: string }> = {
  success: { label: 'OK', className: 'bg-emerald-100 text-emerald-700' },
  retry: { label: 'RETRY', className: 'bg-amber-100 text-amber-700' },
  dead_letter: { label: 'DLQ', className: 'bg-red-100 text-red-700' },
  processing: { label: 'PROC', className: 'bg-blue-100 text-blue-700' },
  received: { label: 'RCV', className: 'bg-sky-100 text-sky-700' },
  duplicate: { label: 'DUP', className: 'bg-violet-100 text-violet-700' },
};

export function OdooDashboardFromPhp() {
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchStats = useCallback(async () => {
    try {
      const result = await callPhpApi('/api/odoo-webhooks-dashboard.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'stats' }),
      });
      
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await callPhpApi('/api/odoo-webhooks-dashboard.php', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'list', 
          limit: pageSize, 
          offset,
        }),
      });
      
      if (result.success && result.data) {
        setWebhooks(result.data.webhooks || []);
        setTotal(result.data.total || 0);
      } else {
        setError(result.error || 'Failed to fetch webhooks');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchStats();
    fetchWebhooks();
  }, [fetchStats, fetchWebhooks]);

  const refreshData = () => {
    fetchStats();
    fetchWebhooks();
  };

  if (loading && !stats) return <DashboardSkeleton />;
  if (error) return (
    <div className="p-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-red-600">{error}</p>
      <Button onClick={refreshData} className="mt-4">ลองใหม่</Button>
    </div>
  );

  const successRate = stats && stats.total > 0 
    ? ((stats.success / stats.total) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📦 Odoo Dashboard</h2>
          <p className="text-gray-500">ข้อมูลจากระบบ PHP (Real-time)</p>
        </div>
        <Button variant="outline" onClick={refreshData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            title="วันนี้"
            value={stats.today.toLocaleString()}
            icon={<Clock className="h-4 w-4" />}
            color="blue"
          />
          <StatCard
            title="ทั้งหมด"
            value={stats.total.toLocaleString()}
            icon={<Package className="h-4 w-4" />}
            color="gray"
          />
          <StatCard
            title="สำเร็จ"
            value={`${stats.success.toLocaleString()} (${successRate}%)`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="green"
          />
          <StatCard
            title="ล้มเหลว"
            value={stats.failed.toLocaleString()}
            icon={<AlertCircle className="h-4 w-4" />}
            color={stats.failed > 0 ? 'red' : 'gray'}
          />
          <StatCard
            title="Retry"
            value={stats.retry.toLocaleString()}
            icon={<RefreshCw className="h-4 w-4" />}
            color={stats.retry > 0 ? 'amber' : 'gray'}
          />
          <StatCard
            title="Dead Letter"
            value={stats.dead_letter.toLocaleString()}
            icon={<AlertCircle className="h-4 w-4" />}
            color={stats.dead_letter > 0 ? 'red' : 'gray'}
          />
        </div>
      )}

      {/* Additional Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ออเดอร์วันนี้</p>
                  <p className="text-2xl font-bold">{stats.unique_orders_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">แจ้งเตือน LINE</p>
                  <p className="text-2xl font-bold">{stats.notified_today}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Latency</p>
                  <p className="text-2xl font-bold">{stats.avg_latency_ms ? `${parseFloat(String(stats.avg_latency_ms)).toFixed(1)} ms` : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events by Type */}
      {stats && stats.events_by_type && stats.events_by_type.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Events วันนี้</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.events_by_type.map((event) => (
                <Badge 
                  key={event.event_type} 
                  variant="secondary"
                  className="text-sm py-1 px-3"
                >
                  {eventIcons[event.event_type] || '📦'} {' '}
                  {eventLabels[event.event_type] || event.event_type} {' '}
                  <span className="font-bold">{event.count}</span>
                </Badge>
              ))}
            </div>          
          </CardContent>
        </Card>
      )}

      {/* Failed Events */}
      {stats && stats.top_failed_events && stats.top_failed_events.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">Events ที่มีปัญหา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.top_failed_events.map((event) => (
                <Badge 
                  key={event.event_type}
                  className="text-sm py-1 px-3 bg-red-100 text-red-700 hover:bg-red-200"
                >
                  {eventLabels[event.event_type] || event.event_type} {' '}
                  <span className="font-bold">{event.count}</span>
                </Badge>
              ))}
            </div>          
          </CardContent>
        </Card>
      )}

      {/* Recent Webhooks Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Webhook Logs ล่าสุด</CardTitle>
          <span className="text-sm text-gray-500">{total.toLocaleString()} รายการ</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">เวลา</th>
                    <th className="text-left py-3 px-2">Event</th>
                    <th className="text-left py-3 px-2">ออเดอร์</th>
                    <th className="text-left py-3 px-2">ลูกค้า</th>
                    <th className="text-center py-3 px-2">สถานะ</th>
                    <th className="text-right py-3 px-2">ยอด</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((w) => {
                    const statusBadge = statusBadges[w.status?.toLowerCase()] || { 
                      label: w.status, 
                      className: 'bg-gray-100 text-gray-700' 
                    };
                    const eventLabel = eventLabels[w.event_type] || w.event_type;
                    const eventIcon = eventIcons[w.event_type] || '📦';
                    const processedDate = w.processed_at 
                      ? new Date(w.processed_at).toLocaleString('th-TH', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short'
                        }) 
                      : '-';
                    
                    return (
                      <tr key={w.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 text-gray-500 whitespace-nowrap">{processedDate}</td>
                        <td className="py-3 px-2">
                          <span title={w.event_type}>
                            {eventIcon} {w.new_state_display || eventLabel}
                          </span>
                        </td>
                        <td className="py-3 px-2">{w.order_name || w.order_id || '-'}</td>
                        <td className="py-3 px-2 max-w-[150px] truncate">
                          {w.customer_name || w.customer_ref || '-'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusBadge.className)}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {w.amount_total ? `฿${Number(w.amount_total).toLocaleString()}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
                disabled={offset === 0}
              >
                ก่อนหน้า
              </Button>
              <span className="py-2 px-4 text-sm">
                หน้า {Math.floor(offset / pageSize) + 1} / {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + pageSize)}
                disabled={offset + pageSize >= total}
              >
                ถัดไป
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'amber' | 'gray';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <Card className={cn("border", colorClasses[color])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-80">{title}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
          <div className="opacity-60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
