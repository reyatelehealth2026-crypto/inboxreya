// Netlify Scheduled Function: replaces vercel.json crons on Netlify.
// Runs every 5 minutes and triggers the Next.js cron API route.
//
// Configure CRON_SECRET in Netlify env vars; the API route validates it.
import type { Config } from '@netlify/functions'

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_URL || ''
  if (!base) {
    return new Response('No site URL available', { status: 500 })
  }

  const url = `${base}/api/cron/process-scheduled-broadcasts`
  const secret = process.env.CRON_SECRET ?? ''

  const res = await fetch(url, {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })

  const body = await res.text()
  return new Response(`status=${res.status}\n${body.slice(0, 500)}`, {
    status: res.ok ? 200 : 500,
  })
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
