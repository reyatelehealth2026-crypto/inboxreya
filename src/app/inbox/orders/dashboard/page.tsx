/**
 * Orders Dashboard Page
 * Desktop-optimized layout with Kanban board
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order, OrderStatus, OrderFilters, OrderTask, OrdersResponse } from '@/lib/orders/types';
import { KanbanBoard } from '@/components/orders/KanbanBoard';
import { OrderQueue } from '@/components/orders/OrderQueue';
import { QuickFilters } from '@/components/orders/QuickFilters';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { ContextMenu } from '@/components/orders/ContextMenu';
import { useKeyboardShortcuts } from '@/components/orders/useKeyboardShortcuts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Keyboard,
  LayoutGrid,
  RefreshCw,
  Package,
} from 'lucide-react';

// Keyboard shortcuts help modal
function KeyboardShortcutsHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  const shortcuts = [
    { key: '⌘K', desc: 'ค้นหา' },
    { key: '⌘N', desc: 'สร้างออเดอร์ใหม่' },
    { key: '1-4', desc: 'เปลี่ยนสถานะ (1=รอ, 2=จัดส่ง, 3=ส่งแล้ว, 4=สำเร็จ)' },
    { key: 'E', desc: 'แก้ไขออเดอร์' },
    { key: 'Enter', desc: 'เปิดรายละเอียด' },
    { key: '↑↓', desc: 'เลือกออเดอร์' },
    { key: '⌘A', desc: 'เลือกทั้งหมด' },
    { key: 'Esc', desc: 'ยกเลิก/ปิด' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">⌨️ Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex justify-between items-center py-2 border-b last:border-0">
              <span className="text-gray-600">{desc}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{key}</kbd>
            </div>
          ))}
        </div>
        <Button className="w-full mt-4" onClick={onClose}>ปิด</Button>
      </div>
    </div>
  );
}

export default function OrdersDashboardPage() {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [pinnedOrders, setPinnedOrders] = useState<Set<number>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<{
    follow_up: OrderTask[];
    send_bill: OrderTask[];
    contact: OrderTask[];
    issue: OrderTask[];
  }>({
    follow_up: [],
    send_bill: [],
    contact: [],
    issue: [],
  });
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    order: Order | null;
    position: { x: number; y: number } | null;
  }>({ order: null, position: null });

  // Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateRange) params.set('dateRange', filters.dateRange);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);

      const response = await fetch(`/api/orders?${params}`);
      const data: OrdersResponse = await response.json();
      setOrders(data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/tasks');
      const data = await response.json();
      setTasks(data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
    fetchTasks();
  }, [fetchOrders, fetchTasks]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    orders,
    selectedOrderId,
    onSelectOrder: setSelectedOrderId,
    onOpenSearch: () => {
      // Focus search input
      const searchInput = document.querySelector('input[placeholder*="ค้นหา"]') as HTMLInputElement;
      searchInput?.focus();
    },
    onNewOrder: () => {
      // TODO: Navigate to create order page
      console.log('New order');
    },
    onEditOrder: () => {
      if (selectedOrder) {
        setDetailModalOpen(true);
      }
    },
    onOpenDetail: () => {
      if (selectedOrder) {
        setDetailModalOpen(true);
      }
    },
    onStatusChange: async (status) => {
      if (selectedOrderId) {
        await handleStatusChange(selectedOrderId, status);
      }
    },
    onSelectAll: () => {
      if (selectedOrders.size === orders.length) {
        setSelectedOrders(new Set());
      } else {
        setSelectedOrders(new Set(orders.map((o) => o.id)));
      }
    },
    onEscape: () => {
      setContextMenu({ order: null, position: null });
      setDetailModalOpen(false);
      setSelectedOrderId(null);
    },
  });

  // Handlers
  const handleOrderClick = useCallback((order: Order) => {
    setSelectedOrderId(order.id);
  }, []);

  const handleOrderSelect = useCallback((orderId: number, selected: boolean) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    setContextMenu({
      order,
      position: { x: e.clientX, y: e.clientY },
    });
    setSelectedOrderId(order.id);
  }, []);

  const handleStatusChange = useCallback(async (orderId: number, status: OrderStatus) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
        // Refresh tasks since status change may affect queue
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [fetchTasks]);

  const handleBulkStatusChange = useCallback(async (status: OrderStatus) => {
    if (selectedOrders.size === 0) return;
    
    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          status,
        }),
      });
      
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            selectedOrders.has(o.id) ? { ...o, status } : o
          )
        );
        setSelectedOrders(new Set());
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to bulk update:', error);
    }
  }, [selectedOrders, fetchTasks]);

  const handlePinOrder = useCallback((orderId: number) => {
    setPinnedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  // Loading skeleton
  if (isLoading && orders.length === 0) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        
        <div className="flex-1 p-6">
          <Skeleton className="h-20 w-full mb-4" />
          <div className="grid grid-cols-4 gap-4 h-[calc(100%-120px)]">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Dashboard</h1>
            <p className="text-sm text-gray-500">จัดการออเดอร์แบบ Drag & Drop</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedOrders.size > 0 && (
            <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700">เลือก {selectedOrders.size} รายการ</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-blue-700"
                onClick={() => setSelectedOrders(new Set())}
              >
                ยกเลิก
              </Button>
              
              {/* Bulk status buttons */}
              {(['pending', 'processing', 'shipped', 'delivered'] as OrderStatus[]).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleBulkStatusChange(status)}
                >
                  → {status === 'pending' && 'รอ'}
                  {status === 'processing' && 'จัดส่ง'}
                  {status === 'shipped' && 'ส่งแล้ว'}
                  {status === 'delivered' && 'สำเร็จ'}
                </Button>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcuts(true)}
          >
            <Keyboard className="h-4 w-4 mr-1" />
            ⌘K
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOrders();
              fetchTasks();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => console.log('New order')}
          >
            <Plus className="h-4 w-4 mr-1" />
            สร้างออเดอร์
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          {/* Filters */}
          <QuickFilters
            filters={filters}
            onFiltersChange={setFilters}
            totalOrders={orders.length}
            className="mb-4"
          />

          {/* Kanban Board */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <KanbanBoard
              orders={orders}
              selectedOrders={selectedOrders}
              pinnedOrders={pinnedOrders}
              onOrderClick={handleOrderClick}
              onOrderSelect={handleOrderSelect}
              onOrderContextMenu={handleContextMenu}
              onOrderStatusChange={(orderId, status) => {
                handleStatusChange(orderId, status);
              }}
              onRefresh={fetchOrders}
            />
          </div>
        </div>

        {/* Sidebar - Queue */}
        <div className={`
          shrink-0 border-l bg-white transition-all duration-300
          ${queueCollapsed ? 'w-12' : 'w-80'}
        `}>
          <div className="h-full p-4">
            {queueCollapsed ? (
              <button
                onClick={() => setQueueCollapsed(false)}
                className="w-full flex flex-col items-center gap-1 py-2 text-gray-500 hover:text-gray-700"
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="text-xs">งาน ({Object.values(tasks).flat().length})</span>
              </button>
            ) : (
              <OrderQueue
                tasks={tasks}
                onTaskClick={(task) => {
                  const order = orders.find((o) => o.id === task.orderId);
                  if (order) {
                    handleOrderClick(order);
                    setDetailModalOpen(true);
                  }
                }}
                collapsed={queueCollapsed}
                onToggleCollapse={() => setQueueCollapsed(!queueCollapsed)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        order={contextMenu.order}
        position={contextMenu.position}
        onClose={() => setContextMenu({ order: null, position: null })}
        onViewDetail={() => setDetailModalOpen(true)}
        onEdit={() => setDetailModalOpen(true)}
        onStatusChange={(status) => {
          if (contextMenu.order) {
            handleStatusChange(contextMenu.order.id, status);
          }
        }}
        onPin={() => {
          if (contextMenu.order) {
            handlePinOrder(contextMenu.order.id);
          }
        }}
        onDownloadBill={() => console.log('Download bill')}
        onCallCustomer={() => {
          if (contextMenu.order?.customerPhone) {
            window.open(`tel:${contextMenu.order.customerPhone}`);
          }
        }}
        onSendMessage={() => console.log('Send LINE message')}
        isPinned={contextMenu.order ? pinnedOrders.has(contextMenu.order.id) : false}
      />

      {/* Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onStatusChange={(status) => {
          if (selectedOrderId) {
            handleStatusChange(selectedOrderId, status);
          }
        }}
        onSaveNote={(note) => console.log('Save note:', note)}
        onPrint={() => console.log('Print')}
        onSendMessage={() => console.log('Send message')}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
