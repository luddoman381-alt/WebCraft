import { Hono } from 'hono'
import { admins } from '../repo.ts'
import { currentAdmin, endSession, startSession, timingDummy, verifyPassword } from '../auth.ts'
import { clientIp, createLimiter } from '../security.ts'

export const authApi = new Hono()

// 8 неудачных попыток с IP или 5 на один email за 15 минут
const byIp = createLimiter(8, 15 * 60 * 1000)
const byEmail = createLimiter(5, 15 * 60 * 1000)

authApi.post('/login', async (c) => {
  const ip = clientIp(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const password = typeof body.password === 'string' ? body.password.slice(0, 256) : ''

  if (byIp.blocked(ip) || (email && byEmail.blocked(email))) {
    const wait = Math.max(byIp.retryAfter(ip), byEmail.retryAfter(email))
    c.header('Retry-After', String(wait))
    return c.json({ error: 'rate_limited', message: `Слишком много попыток. Повторите через ${Math.ceil(wait / 60)} мин.` }, 429)
  }
  if (!email || !password) {
    return c.json({ error: 'validation', message: 'Введите email и пароль' }, 400)
  }

  const admin = admins.byEmail(email)
  const ok = admin ? await verifyPassword(password, admin.passwordHash) : (await verifyPassword(password, await timingDummy()), false)
  if (!admin || !ok) {
    byIp.hit(ip)
    byEmail.hit(email)
    // одинаковый ответ: не раскрываем, существует ли такой email
    return c.json({ error: 'invalid_credentials', message: 'Неверный email или пароль' }, 401)
  }
  byEmail.clear(email)
  admins.touchLogin(admin.id)
  startSession(c, admin)
  return c.json({ email: admin.email })
})

authApi.post('/logout', (c) => {
  endSession(c)
  return c.json({ ok: true })
})

authApi.get('/me', (c) => {
  c.header('Cache-Control', 'no-store')
  const admin = currentAdmin(c)
  if (!admin) return c.json({ error: 'unauthorized', message: 'Требуется вход' }, 401)
  return c.json({ email: admin.email })
})
