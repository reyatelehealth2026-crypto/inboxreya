import prisma from '@/lib/prisma'

export type PartnerSyncStage =
  | 'profile_lookup'
  | 'local_link_lookup'
  | 'customer_projection_lookup'
  | 'link_cache_lookup'
  | 'odoo_live_api'
  | 'link_write'
  | 'member_id_write'
  | 'unexpected'

export type PartnerSourceCheck = {
  source: 'customer_projection' | 'line_users_cache' | 'odoo_live_api' | 'users_profile'
  result: 'found' | 'not_found' | 'failed' | 'missing'
  reasonCode?: string
}

type IncidentInput = {
  stage: PartnerSyncStage
  reasonCode: string
  severity?: 'error' | 'warning'
  retryable?: boolean
  httpStatus?: number
  sourceChecks?: PartnerSourceCheck[]
}

export function classifyPartnerSyncFailure(error: unknown): {
  reasonCode: string
  retryable: boolean
  httpStatus?: number
} {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  const statusMatch = lower.match(/(?:error|status|http)[^0-9]{0,8}([45][0-9]{2})/)
  const httpStatus = statusMatch ? Number(statusMatch[1]) : undefined

  if (lower.includes('timeout') || lower.includes('timed out') || httpStatus === 504) {
    return { reasonCode: 'odoo_live_api_timeout', retryable: true, httpStatus }
  }
  if (lower.includes('circuit') && lower.includes('open')) {
    return { reasonCode: 'odoo_live_api_circuit_open', retryable: true, httpStatus }
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('unreachable')
  ) {
    return { reasonCode: 'odoo_live_api_unreachable', retryable: true, httpStatus }
  }
  if (httpStatus === 401 || httpStatus === 403 || lower.includes('unauthorized')) {
    return { reasonCode: 'odoo_live_api_auth_failed', retryable: false, httpStatus }
  }
  if (httpStatus === 404) {
    return { reasonCode: 'odoo_partner_not_found', retryable: false, httpStatus }
  }
  if (httpStatus && httpStatus >= 500) {
    return { reasonCode: 'odoo_live_api_server_error', retryable: true, httpStatus }
  }
  if (lower.includes('non-json') || lower.includes('unexpected token')) {
    return { reasonCode: 'odoo_live_api_invalid_response', retryable: true, httpStatus }
  }
  if (lower.includes('prisma') || lower.includes('sqlstate') || lower.includes('database')) {
    return { reasonCode: 'local_database_error', retryable: true, httpStatus }
  }

  return { reasonCode: 'partner_sync_unclassified_failure', retryable: false, httpStatus }
}

/**
 * Persist a privacy-safe partner sync incident for the operations monitor.
 * Never pass customer identifiers, member codes, names, request bodies, raw
 * errors, URLs, tokens, or stack traces to this function.
 */
export async function recordPartnerSyncIncident(input: IncidentInput): Promise<void> {
  const payload = JSON.stringify({
    schemaVersion: 1,
    stage: input.stage,
    reasonCode: input.reasonCode,
    retryable: input.retryable ?? false,
    ...(input.httpStatus ? { httpStatus: input.httpStatus } : {}),
    sourceChecks: input.sourceChecks ?? [],
  })

  try {
    // De-duplicate identical failures for five minutes so frequently opened
    // customer cards do not flood dev_logs.
    await prisma.$executeRawUnsafe(
      `INSERT INTO dev_logs (log_type, source, message, data, user_id, created_at)
       SELECT ?, 'partner_sync', ?, ?, NULL, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM dev_logs
          WHERE source = 'partner_sync'
            AND message = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       )`,
      input.severity ?? 'error',
      `partner_sync:${input.reasonCode}`,
      payload,
      `partner_sync:${input.reasonCode}`
    )
  } catch {
    // Monitoring must never break the customer workflow.
    console.warn('[partner-sync] unable to persist privacy-safe incident')
  }
}
