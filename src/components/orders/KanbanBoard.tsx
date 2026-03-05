/**
 * KanbanBoard Component
 * 4-column Kanban board with @dnd-kit drag-drop
 */

'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  DragStartEvent,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Order, OrderStatus, KANBAN_COLUMNS } from '@/lib/orders/types';
import { KanbanColumn } from './KanbanColumn';
import { OrderCard } from './OrderCard';
import { updateOrderStatus } from '@/lib/orders/queries';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  orders: Order[];
  selectedOrders: Set<number>;
  pinnedOrders: Set<number>;
  onOrderClick: (order: Order) => void;
  onOrderSelect: (orderId: number, selected: boolean) => void;
  onOrderContextMenu: (e: React.MouseEvent, order: Order) => void;
  onOrderStatusChange: (orderId: number, status: OrderStatus) => void;
  onRefresh?: () => void;
}

// Draggable Order Card for DragOverlay
function DraggableOrderCard({ order }: { order: Order }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { order },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'opacity-90 rotate-2 scale-105 shadow-xl',
        isDragging && 'opacity-50'
      )}
    >
      <OrderCard order={order} />
    </div>
  );
}

export function KanbanBoard({
  orders,
  selectedOrders,
  pinnedOrders,
  onOrderClick,
  onOrderSelect,
  onOrderContextMenu,
  onOrderStatusChange,
  onRefresh,
}: KanbanBoardProps) {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Configure sensors for drag detection
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // Drag starts after 5px movement
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200, // Touch drag starts after 200ms
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  // Group orders by status
  const ordersByStatus = {
    pending: orders.filter((o) => o.status === 'pending'),
    processing: orders.filter((o) => o.status === 'processing'),
    shipped: orders.filter((o) => o.status === 'shipped'),
    delivered: orders.filter((o) => o.status === 'delivered'),
    cancelled: orders.filter((o) => o.status === 'cancelled'),
  };

  // Update column counts
  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    count: ordersByStatus[col.id]?.length || 0,
  }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const order = orders.find((o) => `order-${o.id}` === active.id);
    if (order) {
      setActiveOrder(order);
      setIsDragging(true);
    }
  }, [orders]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);
    setActiveOrder(null);

    if (!over) return;

    const orderId = parseInt(String(active.id).replace('order-', ''), 10);
    const newStatus = over.id as OrderStatus;

    // Find the order and check if status actually changed
    const order = orders.find((o) => o.id === orderId);
    if (order && order.status !== newStatus) {
      try {
        await updateOrderStatus(orderId, newStatus);
        onOrderStatusChange(orderId, newStatus);
      } catch (error) {
        console.error('Failed to update order status:', error);
      }
    }
  }, [orders, onOrderStatusChange]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Kanban Columns */}
        <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              orders={ordersByStatus[column.id] || []}
              selectedOrders={selectedOrders}
              pinnedOrders={pinnedOrders}
              onOrderClick={onOrderClick}
              onOrderSelect={onOrderSelect}
              onOrderContextMenu={onOrderContextMenu}
              onOrderDragStart={(order) => {
                // Handled by dnd-kit
              }}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOrder ? (
          <DraggableOrderCard order={activeOrder} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
