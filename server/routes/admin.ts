import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { categories, leads, projects, services, settings } from '../repo.ts'
import { LEAD_STATUSES, parseCategory, parseLeadPatch, parseProject, parseService, parseSettings, ValidationError } from '../validation.ts'
import { requireAdmin, type AuthVars } from '../auth.ts'
import { env } from '../env.ts'
import type { LeadStatus } from '../../src/data/types.ts'

/** Административное API. Каждый маршрут — только после requireAdmin. */
export const adminApi = new Hono<AuthVars>()
adminApi.use('*', requireAdmin)

const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString('hex')}`
const notFound = (what: string) => ({ error: 'not_found', message: `${what} не найдена` })

/* ------------------------------------------------------------------ обзор */

adminApi.get('/stats', (c) => {
  const all = services.list()
  const cats = categories.list()
  const recent = leads.list({ limit: 5, offset: 0 }).items
  return c.json({
    services: {
      total: all.length,
      published: all.filter((s) => s.status === 'published').length,
      hidden: all.filter((s) => s.status === 'hidden').length,
      demo: all.filter((s) => s.demo).length,
    },
    categories: { total: cats.length, hidden: cats.filter((x) => x.hidden).length },
    projects: { total: projects.list().length },
    leads: { byStatus: leads.countByStatus(), recent },
  })
})

/* ------------------------------------------------------------------ услуги */

adminApi.get('/services', (c) => c.json(services.list()))

adminApi.get('/services/:id', (c) => {
  const s = services.get(c.req.param('id'))
  return s ? c.json(s) : c.json(notFound('Услуга'), 404)
})

function checkServiceRefs(s: ReturnType<typeof parseService>, exceptId?: string) {
  const errors: Record<string, string> = {}
  if (services.slugTaken(s.slug, exceptId)) errors.slug = 'Такой адрес уже занят другой услугой'
  if (!categories.get(s.category)) errors.category = 'Категория не найдена'
  const known = new Set(services.list().map((x) => x.id))
  if (s.related.some((r) => !known.has(r))) errors.related = 'Одна из связанных услуг не найдена'
  if (Object.keys(errors).length) throw new ValidationError(errors)
}

adminApi.post('/services', async (c) => {
  const s = parseService(await c.req.json().catch(() => null), newId('svc'), false)
  checkServiceRefs(s)
  return c.json(services.create(s), 201)
})

adminApi.put('/services/:id', async (c) => {
  const id = c.req.param('id')
  const cur = services.get(id)
  if (!cur) return c.json(notFound('Услуга'), 404)
  const s = parseService(await c.req.json().catch(() => null), id, cur.demo)
  checkServiceRefs(s, id)
  return c.json(services.update(id, s))
})

adminApi.delete('/services/:id', (c) =>
  services.remove(c.req.param('id')) ? c.json({ ok: true }) : c.json(notFound('Услуга'), 404),
)

/* ------------------------------------------------------------------ категории */

adminApi.get('/categories', (c) =>
  c.json(categories.list().map((x) => ({ ...x, services: categories.serviceCount(x.id) }))),
)

adminApi.post('/categories', async (c) => {
  const cat = parseCategory(await c.req.json().catch(() => null))
  if (categories.get(cat.id)) throw new ValidationError({ id: 'Категория с таким id уже есть' })
  return c.json(categories.create(cat), 201)
})

adminApi.put('/categories/:id', async (c) => {
  const id = c.req.param('id')
  if (!categories.get(id)) return c.json(notFound('Категория'), 404)
  const cat = parseCategory(await c.req.json().catch(() => null))
  if (cat.id !== id && categories.get(cat.id)) throw new ValidationError({ id: 'Категория с таким id уже есть' })
  return c.json(categories.update(id, cat))
})

adminApi.delete('/categories/:id', (c) => {
  const id = c.req.param('id')
  if (!categories.get(id)) return c.json(notFound('Категория'), 404)
  const n = categories.serviceCount(id)
  if (n > 0) {
    return c.json({ error: 'conflict', message: `В категории ${n} услуг. Перенесите их или скройте категорию.` }, 409)
  }
  categories.remove(id)
  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ проекты */

adminApi.get('/projects', (c) => c.json(projects.list()))

adminApi.post('/projects', async (c) => {
  const p = parseProject(await c.req.json().catch(() => null), newId('prj'))
  if (projects.slugTaken(p.slug)) throw new ValidationError({ slug: 'Такой адрес уже занят' })
  return c.json(projects.create(p), 201)
})

adminApi.put('/projects/:id', async (c) => {
  const id = c.req.param('id')
  if (!projects.get(id)) return c.json(notFound('Карточка проекта'), 404)
  const p = parseProject(await c.req.json().catch(() => null), id)
  if (projects.slugTaken(p.slug, id)) throw new ValidationError({ slug: 'Такой адрес уже занят' })
  return c.json(projects.update(id, p))
})

adminApi.delete('/projects/:id', (c) =>
  projects.remove(c.req.param('id')) ? c.json({ ok: true }) : c.json(notFound('Карточка проекта'), 404),
)

/* ------------------------------------------------------------------ настройки */

adminApi.get('/settings', (c) => c.json(settings.get()))

adminApi.put('/settings', async (c) => c.json(settings.save(parseSettings(await c.req.json().catch(() => null)))))

/* ------------------------------------------------------------------ заявки */

adminApi.get('/leads', (c) => {
  const status = c.req.query('status')
  const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1)
  const limit = 25
  return c.json({
    ...leads.list({
      search: c.req.query('q')?.trim().slice(0, 100) || undefined,
      status: status && (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : null,
      limit,
      offset: (page - 1) * limit,
    }),
    page,
    limit,
  })
})

adminApi.get('/leads/:id', (c) => {
  const l = leads.get(Number(c.req.param('id')))
  return l ? c.json(l) : c.json(notFound('Заявка'), 404)
})

adminApi.patch('/leads/:id', async (c) => {
  const l = leads.update(Number(c.req.param('id')), parseLeadPatch(await c.req.json().catch(() => null)))
  return l ? c.json(l) : c.json(notFound('Заявка'), 404)
})

adminApi.delete('/leads/:id', (c) =>
  leads.remove(Number(c.req.param('id'))) ? c.json({ ok: true }) : c.json(notFound('Заявка'), 404),
)

/* ------------------------------------------------------------------ загрузка изображений */

const MAX_UPLOAD = 5 * 1024 * 1024

/** Тип определяется по содержимому файла, а не по имени. SVG не принимаем (может содержать скрипты). */
function sniffImage(buf: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

adminApi.post(
  '/uploads',
  bodyLimit({
    maxSize: MAX_UPLOAD + 64 * 1024,
    onError: (c) => c.json({ error: 'too_large', message: 'Файл больше 5 МБ' }, 413),
  }),
  async (c) => {
    const form = await c.req.parseBody().catch(() => null)
    const file = form?.file
    if (!(file instanceof File)) return c.json({ error: 'validation', message: 'Выберите файл изображения' }, 400)
    if (file.size > MAX_UPLOAD) return c.json({ error: 'too_large', message: 'Файл больше 5 МБ' }, 413)
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = sniffImage(buf)
    if (!ext) return c.json({ error: 'validation', message: 'Поддерживаются PNG, JPG и WebP' }, 400)
    mkdirSync(env.uploadDir, { recursive: true })
    const name = `${randomBytes(16).toString('hex')}.${ext}`
    writeFileSync(join(env.uploadDir, name), buf, { flag: 'wx' })
    return c.json({ url: `/uploads/${name}` }, 201)
  },
)
