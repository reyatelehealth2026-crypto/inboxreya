import { describe, it, expect } from 'vitest';
import { aggregateRegionClicks, regionLabel } from '@/lib/promo-clicks';

const ORIGIN = 'https://inbox.example.com';
const region = (url: string, keyword?: string) => ({ x: 0, y: 0, w: 10, h: 10, url, keyword });
const content = (regions: unknown[], flexLinks?: string[]) =>
  JSON.stringify({ messages: [], imagemapMeta: { baseKey: 'k', regions }, ...(flexLinks ? { flexLinks } : {}) });

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

  it('counts people, not taps: repeat taps and two regions of one brand are one person', () => {
    const summary = aggregateRegionClicks(
      [
        { broadcastId: 1, action: 'region:0', lineUserId: 'U1', clicks: 5 },
        { broadcastId: 1, action: 'region:1', lineUserId: 'U1', clicks: 2 },
        { broadcastId: 2, action: 'region:1', lineUserId: 'U2', clicks: 3 },
        { broadcastId: 2, action: 'region:0', lineUserId: 'U2', clicks: 1 },
        { broadcastId: 2, action: 'region:9', lineUserId: 'U3', clicks: 1 },
        { broadcastId: 3, action: 'region:0', lineUserId: 'U4', clicks: 4 },
        // The native all-followers broadcast has no identity: each anonymous tap is one person.
        { broadcastId: 1, action: 'region:0', lineUserId: 'anon', clicks: 2 },
      ],
      broadcasts,
      ORIGIN
    );

    expect(summary.totals).toEqual({ clicks: 13, people: 4, recipients: 160, broadcasts: 3 });
    expect(summary.brands).toEqual([
      { label: 'VISTRA', clicks: 11, people: 4, recipients: 150, ctr: 4 / 150 },
      { label: 'หน้ารวมโปร', clicks: 2, people: 1, recipients: 100, ctr: 0.01 },
    ]);
  });

  it('never reports more people than recipients for a push broadcast', () => {
    const summary = aggregateRegionClicks(
      [{ broadcastId: 1, action: 'region:0', lineUserId: 'U1', clicks: 40 }],
      [{ ...broadcasts[0], recipients: 1 }],
      ORIGIN
    );
    expect(summary.brands[0]).toMatchObject({ label: 'VISTRA', clicks: 40, people: 1, ctr: 1 });
  });

  it('reads flex links after the imagemap regions', () => {
    const flex = {
      id: 4,
      content: content([region(`${ORIGIN}/promo`)], [`${ORIGIN}/promo?k=SMOOTH%20E`, 'https://www.cnypharmacy.com/product/1']),
      recipients: 20,
    };
    const summary = aggregateRegionClicks(
      [
        { broadcastId: 4, action: 'region:1', lineUserId: 'U1', clicks: 1 },
        { broadcastId: 4, action: 'region:2', lineUserId: 'U2', clicks: 1 },
      ],
      [flex],
      ORIGIN
    );
    expect(summary.brands.map((b) => [b.label, b.people])).toEqual([
      ['SMOOTH E', 1],
      ['www.cnypharmacy.com', 1],
      ['หน้ารวมโปร', 0],
    ]);
  });

  it('lists brands that were sent but never tapped with zero people', () => {
    const summary = aggregateRegionClicks([], broadcasts.slice(0, 1), ORIGIN);
    expect(summary.brands.map((b) => [b.label, b.people, b.ctr])).toEqual([
      ['VISTRA', 0, 0],
      ['หน้ารวมโปร', 0, 0],
    ]);
  });
});
