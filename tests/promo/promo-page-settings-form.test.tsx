import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PromoPageSettingsForm } from '@/components/promo-page/PromoPageSettingsForm';
import { DEFAULT_PROMO_PAGE_SETTINGS } from '@/lib/promo-page-settings';

// The real toast fn is stable across renders; a fresh vi.fn() per render would re-run load() forever.
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const SECTIONS = [
  { id: 'section-5', title: 'ดีลแบรนด์พาร์ทเนอร์', bannerUrl: 'https://cdn.example.com/s5.png', cards: 28 },
  { id: 'section-6', title: 'สินค้าราคาพิเศษ', bannerUrl: null, cards: 133 },
];

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('PromoPageSettingsForm', () => {
  const calls: { url: string; body: unknown }[] = [];

  beforeEach(() => {
    calls.length = 0;
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith('/promo-page-settings')) {
        return ok({
          success: true,
          data: { ...DEFAULT_PROMO_PAGE_SETTINGS, sections: [{ id: 'section-6', imageUrl: '', href: '' }] },
          sections: SECTIONS,
        });
      }
      if (url.endsWith('/preview')) return ok({ success: true, token: 'tok.sig' });
      if (url.includes('/clicks?')) {
        return ok({
          success: true,
          days: 30,
          data: {
            totals: { clicks: 12, recipients: 400, broadcasts: 2 },
            brands: [{ label: 'VISTRA', clicks: 9, recipients: 400, ctr: 0.0225 }],
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;
  });

  it('lists the sections in saved order and previews the draft in a frame', async () => {
    const { container } = render(<PromoPageSettingsForm />);

    await screen.findByText('สินค้าราคาพิเศษ');
    const titles = [...container.querySelectorAll('[aria-label^="แบนเนอร์ "]')].map((input) =>
      input.getAttribute('aria-label')
    );
    expect(titles).toEqual(['แบนเนอร์ สินค้าราคาพิเศษ', 'แบนเนอร์ ดีลแบรนด์พาร์ทเนอร์']);

    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('src')).toBe('/promo?preview=tok.sig')
    );
    const preview = calls.find((call) => call.url.endsWith('/preview'))!;
    expect(preview.body).toMatchObject({ sections: [{ id: 'section-6' }] });

    await screen.findByText('VISTRA');
    expect(screen.getByText('9 ครั้ง · CTR 2.3%')).not.toBeNull();
  });

  it('writes the whole section list back when one banner changes, half-typed URLs left out of the preview', async () => {
    render(<PromoPageSettingsForm />);
    const input = await screen.findByLabelText('แบนเนอร์ ดีลแบรนด์พาร์ทเนอร์');
    fireEvent.change(input, { target: { value: 'https://cdn.example.com/new.png' } });

    await waitFor(() => {
      const last = calls.filter((call) => call.url.endsWith('/preview')).at(-1)!;
      expect((last.body as { sections: { id: string; imageUrl: string }[] }).sections).toEqual([
        { id: 'section-6', imageUrl: '', href: '' },
        { id: 'section-5', imageUrl: 'https://cdn.example.com/new.png', href: '' },
      ]);
    });

    fireEvent.change(input, { target: { value: 'http://not-https' } });
    await waitFor(() => {
      const last = calls.filter((call) => call.url.endsWith('/preview')).at(-1)!;
      expect((last.body as { sections: { imageUrl: string }[] }).sections[1].imageUrl).toBe('');
    });
  });
});
