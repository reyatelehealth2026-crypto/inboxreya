/**
 * OrderCard Component
 * Desktop-optimized order card with hover states and context menu
 */

'use client';

import { useState } from 'react';
import { Order, OrderStatus } from '@/lib/orders/types';
import { cn, formatTimeAgo } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Pin, GripVertical, Package, Phone, MapPin } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  isSelected?: boolean;
  isPinned?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  dragHandleProps?: any;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'รอดำเนินการ', color: '#F59E0B', bgColor: '#FEF3C7' },
  processing: { label: 'กำลังจัดส่ง', color: '#F97316', bgColor: '#FFEDD5' },
  shipped: { label: 'จัดส่งแล้ว', color: '#3B82F6', bgColor: '#DBEAFE' },
  delivered: { label: 'สำเร็จ', color: '#22C55E', bgColor: '#DCFCE7' },
  cancelled: { label: 'ยกเลิก', color: '#6B7280', bgColor: '#F3F4F6' },
};

export function OrderCard({
  order,
  isSelected = false,
  isPinned = false,
  onSelect,
  onClick,
  onContextMenu,
  onDragStart,
  dragHandleProps,
}: OrderCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const statusConfig = STATUS_CONFIG[order.status];

  const formatTime = (dateString: string) => {
    try {
      return formatTimeAgo(dateString);
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount: number) => {
    return `฿${amount.toLocaleString()}`;
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-white p-3 transition-all duration-200',
        'cursor-pointer select-none',
        'hover:shadow-md hover:border-gray-300',
        isSelected && 'ring-2 ring-blue-500 border-blue-500',
        isPinned && 'border-amber-300 bg-amber-50/30',
        'w-full'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      draggable={!!onDragStart}
    >
      {/* Selection Overlay - shows on hover or when selected */}
      {(isHovered || isSelected) && onSelect && (
        <div 
          className="absolute left-2 top-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="h-4 w-4"
          />
        </div>
      )}

      {/* Drag Handle - Desktop only */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing',
            'text-gray-300 hover:text-gray-500 transition-colors',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      )}

      {/* Content */}
      <div className={cn('space-y-2', (isHovered || isSelected) && onSelect && 'pl-6')} >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isPinned && (
              <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
            )}
            <span className="font-mono text-xs text-gray-500 shrink-0">
              #{order.orderNumber}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 truncate">
              {formatTime(order.createdAt)}
            </span>
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-gray-600">
              {order.customerName.charAt(0)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-gray-900 truncate">
              {order.customerName}
            </p>
            {order.customerPhone && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customerPhone}
              </p>
            )}
          </div>
        </div>

        {/* Amount & Status */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-gray-900">
              {formatAmount(order.grandTotal)}
            </span>
            <span className="text-xs text-gray-500">
              ({order.itemCount || 1} รายการ)
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className="text-xs font-medium px-2 py-0.5"
            style={{
              borderColor: statusConfig.color,
              color: statusConfig.color,
              backgroundColor: statusConfig.bgColor,
            }}
          >
            {statusConfig.label}
          </Badge>

          {order.shippingTracking && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Package className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{order.shippingTracking}</span>
            </div>
          )}
        </div>

        {/* Hover Actions - Desktop */}
        {isHovered && (
          <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}>
            {/* Quick action buttons could go here */}
          </div>
        )}
      </div>
    </div>
  );
}
