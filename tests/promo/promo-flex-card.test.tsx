import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PromoFlexCard } from '@/components/promo-page/PromoFlexCard';
import { DEFAULT_PROMO_PAGE_SETTINGS } from '@/lib/promo-page-settings';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const FLEX = {
  type: 'flex',
  altText: 'ดีลใกล้หมดเวลา · 1 รายการ',
  contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'hi' }] } },
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('PromoFlexCard', () => {
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];

  beforeEach(() => {
    calls.length = 0;
    toast.mockReset();
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      if (url.endsWith('/promo-page-settings/flex')) return ok({ success: true, messages: [FLEX] });
      if (url.endsWith('/api/inbox/tags')) {
        return ok({ data: [{ id: '5', name: 'ลูกค้าร้านยา', usageCount: 40 }, { id: '6', name: 'คลินิก', usageCount: 12 }] });
      }
      if (url.endsWith('/broadcasts/estimate')) {
        return ok({ success: true, data: { totalRecipients: body?.targetTagIds ? 40 : 900 } });
      }
      if (url.endsWith('/api/inbox/broadcasts')) return ok({ success: true, data: { id: 77 } });
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;
  });

  it('saves the draft to the chosen tags, showing how many people that reaches', async () => {
    render(<PromoFlexCard settings={DEFAULT_PROMO_PAGE_SETTINGS} />);
    fireEvent.click(screen.getByRole('button', { name: /สร้าง Flex/ }));

    await screen.findByText(/เพื่อนทุกคนของ OA · 900 คน/);
    fireEvent.click(await screen.findByRole('button', { name: /ลูกค้าร้านยา/ }));
    await screen.findByText(/1 tag · 40 คน/);

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเป็นร่างบรอดแคสต์' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/inbox/broadcasts'))).toBe(true));
    const draft = calls.find((c) => c.url.endsWith('/api/inbox/broadcasts'))!.body!;
    expect(draft).toMatchObject({ messageType: 'flex', flexContents: [FLEX], targetTagIds: [5] });
  });

  it('sends no tags when none are picked, so the draft reaches every follower', async () => {
    render(<PromoFlexCard settings={DEFAULT_PROMO_PAGE_SETTINGS} />);
    fireEvent.click(screen.getByRole('button', { name: /สร้าง Flex/ }));
    await screen.findByText(/เพื่อนทุกคนของ OA · 900 คน/);

    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเป็นร่างบรอดแคสต์' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/inbox/broadcasts'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/api/inbox/broadcasts'))!.body).not.toHaveProperty('targetTagIds');
  });
});
