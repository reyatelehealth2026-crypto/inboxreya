import { createHmac, timingSafeEqual } from 'node:crypto';
import { promoPageSettingsSchema, type PromoPageSettings } from '@/lib/promo-page-settings';

/**
 * The admin page previews unsaved settings by loading /promo?preview=<token>.
 * The token carries the draft itself, signed and expiring, so nothing is stored
 * and nobody can point the public page at settings we did not sign.
 */
const TTL_MS = 60 * 60_000;

function secret(): string | null {
  return process.env.NEXTAUTH_SECRET || null;
}

function sign(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

/** Null when the server has no signing secret (preview is then simply unavailable). */
export function signPreview(settings: PromoPageSettings, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ s: settings, exp: now + TTL_MS })).toString('base64url');
  return `${body}.${sign(body, key)}`;
}

/** The draft settings a valid, unexpired token carries; null for anything else. */
export function readPreview(token: string | undefined, now = Date.now()): PromoPageSettings | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = sign(body, key);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { s?: unknown; exp?: unknown };
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    const parsed = promoPageSettingsSchema.safeParse(payload.s);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
