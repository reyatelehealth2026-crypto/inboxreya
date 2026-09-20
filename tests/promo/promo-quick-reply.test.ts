import { describe, it, expect } from 'vitest';
import { buildPromoQuickReply } from '@/lib/promo-quick-reply';

describe('buildPromoQuickReply', () => {
  it('leads with the all-promos chip and links each brand to its /promo?k= card', () => {
    const { items } = buildPromoQuickReply(['VISTRA', ' SMOOTH E ', 'VISTRA', ''], 'https://inbox.example.com/');
    expect(items.map((item) => item.action.label)).toEqual(['🎁 โปรทั้งหมด', 'VISTRA', 'SMOOTH E']);
    expect(items[0].action).toEqual({ type: 'uri', label: '🎁 โปรทั้งหมด', uri: 'https://inbox.example.com/promo' });
    expect(items[2].action.uri).toBe('https://inbox.example.com/promo?k=SMOOTH%20E');
  });

  it('stays within LINE limits: 13 items, 20-character labels', () => {
    const partners = Array.from({ length: 20 }, (_, i) => `BRAND-${i}-WITH-A-VERY-LONG-NAME`);
    const { items } = buildPromoQuickReply(partners, 'https://inbox.example.com');
    expect(items).toHaveLength(13);
    expect(items.every((item) => item.action.label.length <= 20)).toBe(true);
    expect(items[1].action.uri).toContain('k=BRAND-0-WITH-A-VERY-LONG-NAME');
  });
});
