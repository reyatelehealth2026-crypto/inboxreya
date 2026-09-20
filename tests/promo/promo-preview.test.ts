import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_PROMO_PAGE_SETTINGS } from '@/lib/promo-page-settings';
import { readPreview, signPreview } from '@/lib/promo-preview';

const DRAFT = {
  ...DEFAULT_PROMO_PAGE_SETTINGS,
  heroBanners: [{ imageUrl: 'https://cdn.example.com/a.png', href: '' }],
  sections: [{ id: 'section-6', imageUrl: 'https://cdn.example.com/b.png', href: '' }],
};

describe('promo preview token', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
  });

  it('round-trips the draft settings', () => {
    const token = signPreview(DRAFT, 1_000);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(readPreview(token!, 2_000)).toEqual(DRAFT);
  });

  it('rejects a tampered, expired, malformed or missing token', () => {
    const token = signPreview(DRAFT, 1_000)!;
    const [body] = token.split('.');
    expect(readPreview(`${body}.not-the-signature`, 2_000)).toBeNull();
    expect(readPreview(token, 1_000 + 61 * 60_000)).toBeNull();
    expect(readPreview('garbage', 2_000)).toBeNull();
    expect(readPreview(undefined, 2_000)).toBeNull();
  });

  it('is unavailable without a signing secret', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    expect(signPreview(DRAFT)).toBeNull();
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
    const token = signPreview(DRAFT)!;
    vi.stubEnv('NEXTAUTH_SECRET', '');
    expect(readPreview(token)).toBeNull();
  });
});
