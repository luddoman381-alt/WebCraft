import { Hono } from 'hono'
import { leads, projects, services, settings } from '../repo.ts'
import { parseLead } from '../validation.ts'
import { clientIp, createLimiter } from '../security.ts'

/** Публичное API сайта: только опубликованный контент. */
export const publicApi = new Hono()

publicApi.get('/catalog', (c) => {
  c.header('Cache-Control', 'no-cache')
  return c.json(services.published())
})

publicApi.get('/projects', (c) => {
  c.header('Cache-Control', 'no-cache')
  return c.json(projects.published())
})

publicApi.get('/settings', (c) => {
  c.header('Cache-Control', 'no-cache')
  return c.json(settings.get())
})

const leadLimiter = createLimiter(5, 10 * 60 * 1000)

publicApi.post('/leads', async (c) => {
  const ip = clientIp(c)
  if (leadLimiter.blocked(ip)) {
    c.header('Retry-After', String(leadLimiter.retryAfter(ip)))
    return c.json({ error: 'rate_limited', message: 'Слишком много заявок подряд. Попробуйте позже.' }, 429)
  }
  const body = await c.req.json().catch(() => null)
  // поле-ловушка: люди его не видят и не заполняют
  if (body && typeof body === 'object' && (body as Record<string, unknown>).website) {
    return c.json({ ok: true }, 201)
  }
  const data = parseLead(body)
  leadLimiter.hit(ip)
  const lead = leads.create({ ...data, userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null })
  return c.json({ ok: true, id: lead.id }, 201)
})
