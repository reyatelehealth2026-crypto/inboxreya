import type { MessageMetadata } from '@/types'

export type DeliveryState = 'failed' | 'delivered' | 'saved'

export interface DeliveryDescription {
  state: DeliveryState
  mark: string
  title: string
}

/**
 * Delivery status of an outgoing message, derived from what the send path
 * recorded in metadata:
 * - `sendError`     → the push to LINE never succeeded (message only saved in DB)
 * - `lineMessageId` → LINE accepted the push and returned an id
 * - neither         → saved, but no confirmation either way (older rows, bot
 *                     replies saved by PHP, broadcasts)
 */
export function describeDelivery(
  metadata: MessageMetadata | null | undefined
): DeliveryDescription {
  if (metadata?.sendError) {
    return { state: 'failed', mark: '⚠ ส่งไม่ถึง', title: `ส่งไม่ถึงลูกค้า: ${metadata.sendError}` }
  }
  if (metadata?.lineMessageId) {
    return { state: 'delivered', mark: '✓✓', title: 'LINE รับข้อความแล้ว' }
  }
  return { state: 'saved', mark: '✓', title: 'บันทึกแล้ว ยังไม่มีการยืนยันจาก LINE' }
}
