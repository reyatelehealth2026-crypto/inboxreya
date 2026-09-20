import { describe, it, expect } from 'vitest';
import { aggregateRegionClicks, regionLabel } from '@/lib/promo-clicks';

const ORIGIN = 'https://inbox.example.com';
const region = (url: string, keyword?: string) => ({ x: 0, y: 0, w: 10, h: 10, url, keyword });
const content = (regions: unknown[]) => JSON.stringify({ messages: [], imagemapMeta: { baseKey: 'k', regions } });

describe('regionLabel', () => {
  it('prefers the keyword, then the ?k= brand, then the plain promo page, then the host', () => {
    expect(regionLabel(region(`${ORIGIN}/promo?k=VISTRA`, ' Tempra '), ORIGIN)).toBe('Tempra');
    expect(regionLabel(region(`${ORIGIN}/promo?k=SMOOTH%20E`), ORIGIN)).toBe('SMOOTH E');
    expect(regionLabel(region(`${ORIGIN}/promo`), ORIGIN)).toBe('หน้ารวมโปร');
    expect(regionLabel(region('https://line.me/R/ti/p/@shop'), ORIGIN)).toBe('line.me');
  });
});

describe('aggregateRegionClicks', () => {
  const broadcasts = [
    { id: 1, content: content([region(`${ORIGIN}/promo?k=VISTRA`), region(`${ORIGIN}/promo`)]), recipients: 100 },
    { id: 2, content: content([region(`${ORIGIN}/promo?k=VISTRA`), region(`${ORIGIN}/promo?k=VISTRA`)]), recipients: 50 },
    { id: 3, content: 'not json', recipients: 10 },
  ];

  it('sums clicks per brand and counts each broadcast once in its reach', () => {
    const summary = aggregateRegionClicks(
      [
        { broadcastId: 1, action: 'region:0', clicks: 5 },
        { broadcastId: 1, action: 'region:1', clicks: 2 },
        { broadcastId: 2, action: 'region:1', clicks: 3 },
        { broadcastId: 2, action: 'region:9', clicks: 1 },
        { broadcastId: 3, action: 'region:0', clicks: 4 },
      ],
      broadcasts,
      ORIGIN
    );

    expect(summary.totals).toEqual({ clicks: 15, recipients: 160, broadcasts: 3 });
    expect(summary.brands).toEqual([
      { label: 'VISTRA', clicks: 8, recipients: 150, ctr: 8 / 150 },
      { label: 'หน้ารวมโปร', clicks: 2, recipients: 100, ctr: 0.02 },
    ]);
  });

  it('lists brands that were sent but never tapped with zero clicks', () => {
    const summary = aggregateRegionClicks([], broadcasts.slice(0, 1), ORIGIN);
    expect(summary.brands.map((b) => [b.label, b.clicks, b.ctr])).toEqual([
      ['VISTRA', 0, 0],
      ['หน้ารวมโปร', 0, 0],
    ]);
  });
});
