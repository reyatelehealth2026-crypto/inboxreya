/**
 * KanbanColumn Component
 * Scrollable column with drop zone for desktop
 */

'use client';

import { useDroppable } from '@dnd-kit/core';
import { Order, OrderStatus, KanbanColumn as KanbanColumnType } from '@/lib/orders/types';
import { OrderCard } from './OrderCard';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  column: KanbanColumnType;
  orders: Order[];
  selectedOrders: Set<number>;
  pinnedOrders: Set<number>;
  onOrderClick: (order: Order) => void;
  onOrderSelect: (orderId: number, selected: boolean) => void;
  onOrderContextMenu: (e: React.MouseEvent, order: Order) => void;
  onOrderDragStart: (order: Order) => void;
}

export function KanbanColumn({
  column,
  orders,
  selectedOrders,
  pinnedOrders,
  onOrderClick,
  onOrderSelect,
  onOrderContextMenu,
  onOrderDragStart,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status: column.id },
  });

  // Sort orders: pinned first, then by date
  const sortedOrders = [...orders].sort((a, b) => {
    const aPinned = pinnedOrders.has(a.id);
    const bPinned = pinnedOrders.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col h-full rounded-lg border-2 transition-colors',
        'bg-gray-50/50',
        isOver && 'border-blue-400 bg-blue-50/50',
        !isOver && 'border-gray-200'
      )}
    >
      {/* Column Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200"
        style={{ backgroundColor: column.bgColor }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <span className="font-semibold text-sm text-gray-900">
            {column.title}
          </span>
        </div>
        <Badge 
          variant="secondary" 
          className="text-xs font-medium"
        >
          {orders.length}
        </Badge>
      </div>

      {/* Orders List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2 min-h-[100px]">
          {sortedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={selectedOrders.has(order.id)}
              isPinned={pinnedOrders.has(order.id)}
              onSelect={(selected) => onOrderSelect(order.id, selected)}
              onClick={() => onOrderClick(order)}
              onContextMenu={(e) => onOrderContextMenu(e, order)}
              onDragStart={() => onOrderDragStart(order)}
              dragHandleProps={{}}
            />
          ))}
          
          
          {/* Empty State */}
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <p className="text-sm">ไม่มีออเดอร์</p>
              <p className="text-xs mt-1">ลากออเดอร์มาที่นี่</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
