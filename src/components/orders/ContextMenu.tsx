/**
 * ContextMenu Component
 * Right-click menu for quick status change
 */

'use client';

import { useEffect, useRef } from 'react';
import { Order, OrderStatus } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import {
  Eye,
  Edit,
  Truck,
  CheckCircle,
  Package,
  Clock,
  Download,
  Phone,
  MessageSquare,
  Pin,
  Trash2,
  X,
} from 'lucide-react';

interface ContextMenuProps {
  order: Order | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onViewDetail: () => void;
  onEdit: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onPin: () => void;
  onDownloadBill: () => void;
  onCallCustomer: () => void;
  onSendMessage: () => void;
  onDelete?: () => void;
  isPinned?: boolean;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'pending', label: 'รอดำเนินการ', icon: <Clock className="h-4 w-4" /> },
  { value: 'processing', label: 'กำลังจัดส่ง', icon: <Package className="h-4 w-4" /> },
  { value: 'shipped', label: 'จัดส่งแล้ว', icon: <Truck className="h-4 w-4" /> },
  { value: 'delivered', label: 'สำเร็จ', icon: <CheckCircle className="h-4 w-4" /> },
];

export function ContextMenu({
  order,
  position,
  onClose,
  onViewDetail,
  onEdit,
  onStatusChange,
  onPin,
  onDownloadBill,
  onCallCustomer,
  onSendMessage,
  onDelete,
  isPinned = false,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!order || !position) return null;

  // Adjust position to keep menu within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 240),
    top: Math.min(position.y, window.innerHeight - 300),
    zIndex: 9999,
  };

  return (
    <div
      ref={menuRef}
      className="w-60 bg-white rounded-lg shadow-xl border border-gray-200 py-1 animate-in fade-in zoom-in-95 duration-100"
      style={menuStyle}
    >
      {/* Order Info */}
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="font-medium text-sm text-gray-900 truncate">
          #{order.orderNumber}
        </p>
        <p className="text-xs text-gray-500 truncate">{order.customerName}</p>
      </div>

      {/* Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onViewDetail();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
          ดูรายละเอียด
        </button>

        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Edit className="h-4 w-4 text-gray-500" />
          แก้ไขออเดอร์
        </button>

        <button
          onClick={() => {
            onPin();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Pin className={cn('h-4 w-4', isPinned && 'fill-amber-500 text-amber-500')} />
          {isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}
        </button>
      </div>

      <hr className="my-1 border-gray-100" />

      {/* Status Change */}
      <div className="py-1">
        <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
          เปลี่ยนสถานะ
        </p>
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onStatusChange(option.value);
              onClose();
            }}
            disabled={order.status === option.value}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
              order.status === option.value
                ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <span
              className={cn(
                order.status === option.value && 'opacity-50'
              )}
            >
              {option.icon}
            </span>
            {option.label}
            {order.status === option.value && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </button>
        ))}
      </div>

      <hr className="my-1 border-gray-100" />

      {/* Quick Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onDownloadBill();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Download className="h-4 w-4 text-gray-500" />
          ดาวน์โหลดบิล
        </button>

        {order.customerPhone && (
          <button
            onClick={() => {
              onCallCustomer();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Phone className="h-4 w-4 text-gray-500" />
            โทรหาลูกค้า
          </button>
        )}

        <button
          onClick={() => {
            onSendMessage();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <MessageSquare className="h-4 w-4 text-gray-500" />
          ส่งข้อความ LINE
        </button>
      </div>

      {onDelete && (
        <>
          <hr className="my-1 border-gray-100" />
          <div className="py-1">
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              ลบออเดอร์
            </button>
          </div>
        </>
      )}
    </div>
  );
}
