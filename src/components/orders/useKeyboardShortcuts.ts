/**
 * Keyboard shortcuts hook for orders dashboard
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { Order, OrderStatus } from '@/lib/orders/types';

interface UseKeyboardShortcutsProps {
  orders: Order[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number | null) => void;
  onOpenSearch: () => void;
  onNewOrder: () => void;
  onEditOrder: () => void;
  onOpenDetail: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onSelectAll: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts({
  orders,
  selectedOrderId,
  onSelectOrder,
  onOpenSearch,
  onNewOrder,
  onEditOrder,
  onOpenDetail,
  onStatusChange,
  onSelectAll,
  onEscape,
}: UseKeyboardShortcutsProps) {
  const [isEnabled, setIsEnabled] = useState(true);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled) return;

      const { key, metaKey, ctrlKey, altKey, shiftKey } = event;
      const isMod = metaKey || ctrlKey;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape even in inputs
        if (key === 'Escape') {
          onEscape();
        }
        return;
      }

      switch (key) {
        case 'k':
          if (isMod) {
            event.preventDefault();
            onOpenSearch();
          }
          break;

        case 'n':
          if (isMod) {
            event.preventDefault();
            onNewOrder();
          }
          break;

        case 'a':
          if (isMod) {
            event.preventDefault();
            onSelectAll();
          }
          break;

        case 'e':
          event.preventDefault();
          onEditOrder();
          break;

        case 'Enter':
          event.preventDefault();
          onOpenDetail();
          break;

        case 'Escape':
          event.preventDefault();
          onEscape();
          break;

        case '1':
          event.preventDefault();
          onStatusChange('pending');
          break;

        case '2':
          event.preventDefault();
          onStatusChange('processing');
          break;

        case '3':
          event.preventDefault();
          onStatusChange('shipped');
          break;

        case '4':
          event.preventDefault();
          onStatusChange('delivered');
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (orders.length > 0) {
            const currentIndex = selectedOrderId
              ? orders.findIndex((o) => o.id === selectedOrderId)
              : -1;
            const newIndex = currentIndex <= 0 ? orders.length - 1 : currentIndex - 1;
            onSelectOrder(orders[newIndex]?.id || null);
          }
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (orders.length > 0) {
            const currentIndex = selectedOrderId
              ? orders.findIndex((o) => o.id === selectedOrderId)
              : -1;
            const newIndex = currentIndex >= orders.length - 1 ? 0 : currentIndex + 1;
            onSelectOrder(orders[newIndex]?.id || null);
          }
          break;

        default:
          break;
      }
    },
    [
      isEnabled,
      orders,
      selectedOrderId,
      onSelectOrder,
      onOpenSearch,
      onNewOrder,
      onEditOrder,
      onOpenDetail,
      onStatusChange,
      onSelectAll,
      onEscape,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    isEnabled,
    setIsEnabled,
  };
}
