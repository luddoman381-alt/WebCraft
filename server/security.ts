import type { Context, MiddlewareHandler } from 'hono'
import { env } from './env.ts'

/* ------------------------------------------------------------------ IP клиента */

export function clientIp(c: Context): string {
  if (env.trustProxy) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (fwd) return fwd
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming
  return incoming?.socket?.remoteAddress ?? 'unknown'
}

/* ------------------------------------------------------------------ лимиты */

/** Простой лимитер в памяти процесса: окно фиксированной длины на ключ. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>()
  const sweep = setInterval(() => {
    const t = Date.now()
    for (const [k, v] of hits) if (v.reset < t) hits.delete(k)
  }, windowMs)
  sweep.unref()
  return {
    /** true — лимит исчерпан */
    blocked(key: string) {
      const h = hits.get(key)
      return !!h && h.reset > Date.now() && h.count >= max
    },
    hit(key: string) {
      const t = Date.now()
      const h = hits.get(key)
      if (!h || h.reset < t) hits.set(key, { count: 1, reset: t + windowMs })
      else h.count++
    },
    clear(key: string) {
      hits.delete(key)
    },
    retryAfter(key: string) {
      const h = hits.get(key)
      return h ? Math.max(1, Math.ceil((h.reset - Date.now()) / 1000)) : 0
    },
  }
}

/* ------------------------------------------------------------------ CSRF */

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Для изменяющих запросов к API требуем:
 *  1) собственный заголовок X-WebCraft — его нельзя отправить с чужого сайта без CORS-preflight
 *     (а CORS сервер не разрешает);
 *  2) совпадение Origin (если браузер его прислал) с адресом сайта.
 * Вместе с SameSite=Strict cookie это закрывает CSRF.
 */
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE.has(c.req.method)) return next()
  if (c.req.header('x-webcraft') !== '1') {
    return c.json({ error: 'forbidden', message: 'Запрос отклонён' }, 403)
  }
  const origin = c.req.header('origin')
  if (origin) {
    const allowed = env.publicOrigin ?? new URL(c.req.url).origin
    const host = c.req.header('host')
    const sameHost = host && (origin === `http://${host}` || origin === `https://${host}`)
    if (origin !== allowed && !sameHost) {
      return c.json({ error: 'forbidden', message: 'Запрос с чужого источника отклонён' }, 403)
    }
  }
  return next()
}

/* ------------------------------------------------------------------ заголовки */

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (env.production) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const type = c.res.headers.get('content-type') ?? ''
  if (type.includes('text/html')) {
    c.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; '),
    )
  }
}
