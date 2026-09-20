/**
 * The quick-reply bar the PHP bot attaches under every reply it sends:
 * one "all promos" chip, then one chip per partner brand on the promo page.
 * LINE allows 13 items with 20-character labels.
 */
export interface LineQuickReplyItem {
  type: 'action'
  action: { type: 'uri'; label: string; uri: string }
}

export interface LineQuickReply {
  items: LineQuickReplyItem[]
}

const MAX_ITEMS = 13
const LABEL_MAX = 20

export function buildPromoQuickReply(partners: string[], origin: string): LineQuickReply {
  const base = origin.replace(/\/+$/, '')
  const item = (label: string, uri: string): LineQuickReplyItem => ({
    type: 'action',
    action: { type: 'uri', label: label.slice(0, LABEL_MAX), uri },
  })
  const brands = Array.from(new Set(partners.map((p) => p.trim()).filter(Boolean))).slice(0, MAX_ITEMS - 1)
  return {
    items: [
      item('🎁 โปรทั้งหมด', `${base}/promo`),
      ...brands.map((brand) => item(brand, `${base}/promo?k=${encodeURIComponent(brand)}`)),
    ],
  }
}
