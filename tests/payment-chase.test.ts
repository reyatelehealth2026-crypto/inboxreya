import { describe, it, expect } from 'vitest'
import {
  formatBillDate,
  formatAmount,
  composeChaseMessage,
  CHASE_ROUNDS,
} from '@/lib/payment-chase'

const candidate = {
  orderId: 1,
  orderName: 'SO001',
  userId: 42,
  lineUserId: 'U123',
  salespersonName: 'อรวี  ยี่สุ่น (นิน)',
  orderDate: new Date(2026, 7, 24), // 24 Aug 2026
  amount: 12400.5,
}

describe('formatBillDate', () => {
  it('writes the Thai short form the reps type by hand', () => {
    expect(formatBillDate(new Date(2026, 7, 24))).toBe('24-8-69')
  })

  it('does not zero-pad, matching the existing messages', () => {
    expect(formatBillDate(new Date(2026, 0, 5))).toBe('5-1-69')
  })
})

describe('formatAmount', () => {
  it('groups thousands and keeps two decimals', () => {
    expect(formatAmount(12400.5)).toBe('12,400.50')
    expect(formatAmount(343586)).toBe('343,586.00')
  })
})

describe('composeChaseMessage', () => {
  it('carries the bill date and amount', () => {
    const message = composeChaseMessage(candidate)
    expect(message).toContain('บิลวันที่ 24-8-69')
    expect(message).toContain('ยอดชำระ 12,400.50 บาท')
  })

  it('keeps the bank account the reps already quote', () => {
    expect(composeChaseMessage(candidate)).toContain('068-3-84622-8')
  })

  it('stays within one LINE text message', () => {
    expect(composeChaseMessage(candidate).length).toBeLessThan(2000)
  })
})

describe('CHASE_ROUNDS', () => {
  it('escalates and never repeats an age', () => {
    expect([...CHASE_ROUNDS]).toEqual([2, 4, 7])
    expect(new Set(CHASE_ROUNDS).size).toBe(CHASE_ROUNDS.length)
  })
})
