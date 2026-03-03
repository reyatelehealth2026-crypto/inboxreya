/**
 * Order Types Tests
 */

import { describe, it, expect } from 'vitest';
import { KANBAN_COLUMNS, OrderStatus } from '@/lib/orders/types';

describe('Order Types', () => {
  describe('KANBAN_COLUMNS', () => {
    it('should have 4 columns', () => {
      expect(KANBAN_COLUMNS).toHaveLength(4);
    });

    it('should have correct status columns', () => {
      const statuses = KANBAN_COLUMNS.map((col) => col.id);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('processing');
      expect(statuses).toContain('shipped');
      expect(statuses).toContain('delivered');
    });

    it('should have correct column configuration', () => {
      KANBAN_COLUMNS.forEach((col) => {
        expect(col).toHaveProperty('id');
        expect(col).toHaveProperty('title');
        expect(col).toHaveProperty('color');
        expect(col).toHaveProperty('bgColor');
        expect(col).toHaveProperty('count');
      });
    });
  });
});
