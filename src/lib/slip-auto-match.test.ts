import { describe, expect, it } from 'vitest'
import { bdoPayable, pickBdoForAmount, type PendingBdo } from './slip-auto-match'

/**
 * This decides where a customer's money is applied without anyone checking, so
 * the cases that must never pass matter as much as the ones that must.
 */

function bdo(overrides: Partial<PendingBdo> & { bdo_id: number }): PendingBdo {
  return {
    bdo_name: `BDO-TEST-${String(overrides.bdo_id).padStart(4, '0')}`,
    payment_status: 'pending',
    ...overrides,
  }
}

describe('bdoPayable', () => {
  it('prefers the net figure over the gross total', () => {
    expect(bdoPayable(bdo({ bdo_id: 1, amount_total: 2000, amount_net_to_pay: 1500 }))).toBe(1500)
  })

  it('falls back to the total when there is no net figure', () => {
    expect(bdoPayable(bdo({ bdo_id: 1, amount_total: 2000, amount_net_to_pay: null }))).toBe(2000)
  })

  it('returns null when neither amount is usable', () => {
    expect(bdoPayable(bdo({ bdo_id: 1, amount_total: 0, amount_net_to_pay: null }))).toBeNull()
  })
})

describe('pickBdoForAmount', () => {
  it('matches a single outstanding BDO for the exact amount', () => {
    const result = pickBdoForAmount(
      [bdo({ bdo_id: 1, amount_net_to_pay: 1500 }), bdo({ bdo_id: 2, amount_net_to_pay: 800 })],
      1500
    )

    expect(result.status).toBe('matched')
    expect(result.status === 'matched' && result.bdo.bdo_id).toBe(1)
  })

  it('tolerates float noise within half a satang', () => {
    const result = pickBdoForAmount([bdo({ bdo_id: 1, amount_net_to_pay: 100.1 })], 100.1 + 0.001)
    expect(result.status).toBe('matched')
  })

  it('refuses a near miss that is off by a whole satang', () => {
    const result = pickBdoForAmount([bdo({ bdo_id: 1, amount_net_to_pay: 100.1 })], 100.11)
    expect(result.status).toBe('none')
  })

  it('refuses to guess when two BDOs share the amount', () => {
    const result = pickBdoForAmount(
      [bdo({ bdo_id: 1, amount_net_to_pay: 1500 }), bdo({ bdo_id: 2, amount_net_to_pay: 1500 })],
      1500
    )

    expect(result.status).toBe('ambiguous')
    expect(result.status === 'ambiguous' && result.candidates).toHaveLength(2)
  })

  it('ignores BDOs that are already settled', () => {
    const result = pickBdoForAmount(
      [
        bdo({ bdo_id: 1, amount_net_to_pay: 1500, payment_status: 'paid' }),
        bdo({ bdo_id: 2, amount_net_to_pay: 1500, payment_status: 'fully_paid' }),
        bdo({ bdo_id: 3, amount_net_to_pay: 1500, payment_status: 'done' }),
      ],
      1500
    )

    expect(result.status).toBe('none')
  })

  it('matches the one unpaid BDO among settled ones with the same amount', () => {
    const result = pickBdoForAmount(
      [
        bdo({ bdo_id: 1, amount_net_to_pay: 1500, payment_status: 'paid' }),
        bdo({ bdo_id: 2, amount_net_to_pay: 1500, payment_status: 'pending' }),
      ],
      1500
    )

    expect(result.status === 'matched' && result.bdo.bdo_id).toBe(2)
  })

  it('returns none for a zero, negative or unusable amount', () => {
    const bdos = [bdo({ bdo_id: 1, amount_net_to_pay: 1500 })]
    expect(pickBdoForAmount(bdos, 0).status).toBe('none')
    expect(pickBdoForAmount(bdos, -1500).status).toBe('none')
    expect(pickBdoForAmount(bdos, Number.NaN).status).toBe('none')
  })

  it('returns none when the customer has no outstanding BDOs', () => {
    expect(pickBdoForAmount([], 1500).status).toBe('none')
  })

  it('treats the same BDO repeated by the feed as one bill', () => {
    // Real shape from customer PC210345: pending_bdo_orders returned bdo_id
    // 49648 twice, which used to read as two competing bills.
    const result = pickBdoForAmount(
      [
        bdo({ bdo_id: 49648, amount_total: 2577, amount_net_to_pay: null }),
        bdo({ bdo_id: 49648, amount_total: 2577, amount_net_to_pay: null }),
        bdo({ bdo_id: 56505, amount_total: 2501.26, amount_net_to_pay: null }),
      ],
      2577
    )

    expect(result.status).toBe('matched')
    expect(result.status === 'matched' && result.bdo.bdo_id).toBe(49648)
  })

  it('still refuses when two genuinely different BDOs share an amount', () => {
    const result = pickBdoForAmount(
      [
        bdo({ bdo_id: 49648, amount_total: 2577, amount_net_to_pay: null }),
        bdo({ bdo_id: 49649, amount_total: 2577, amount_net_to_pay: null }),
      ],
      2577
    )

    expect(result.status).toBe('ambiguous')
  })
})
