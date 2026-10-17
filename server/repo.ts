import { db, json, now, tx } from './db/index.ts'
import type {
  Lead,
  LeadStatus,
  Project,
  PublicationStatus,
  Service,
  ServiceCategory,
  SiteSettings,
} from '../src/data/types.ts'
import { DEFAULT_SETTINGS, EMPTY_TERMINAL } from '../src/data/defaults.ts'

type Row = Record<string, unknown>

/* ------------------------------------------------------------------ категории */

const toCategory = (r: Row): ServiceCategory => ({
  id: String(r.id),
  title: String(r.title),
  summary: String(r.summary),
  description: String(r.description),
  image: (r.image as string | null) ?? null,
  order: Number(r.sort_order),
  hidden: Number(r.hidden) === 1,
})

export const categories = {
  list(): ServiceCategory[] {
    return (db.prepare('SELECT * FROM categories ORDER BY sort_order, title').all() as Row[]).map(toCategory)
  },
  get(id: string): ServiceCategory | null {
    const r = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined
    return r ? toCategory(r) : null
  },
  create(c: ServiceCategory) {
    const t = now()
    db.prepare(
      `INSERT INTO categories (id, title, summary, description, image, sort_order, hidden, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(c.id, c.title, c.summary, c.description, c.image, c.order, c.hidden ? 1 : 0, t, t)
    return categories.get(c.id)!
  },
  /** id можно переименовать: ссылки в услугах обновятся каскадно */
  update(id: string, c: ServiceCategory) {
    db.prepare(
      `UPDATE categories SET id = ?, title = ?, summary = ?, description = ?, image = ?, sort_order = ?, hidden = ?, updated_at = ?
       WHERE id = ?`,
    ).run(c.id, c.title, c.summary, c.description, c.image, c.order, c.hidden ? 1 : 0, now(), id)
    return categories.get(c.id)
  },
  serviceCount(id: string): number {
    return Number((db.prepare('SELECT COUNT(*) n FROM services WHERE category_id = ?').get(id) as Row).n)
  },
  remove(id: string) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0
  },
}

/* ------------------------------------------------------------------ услуги */

const toService = (r: Row): Service => ({
  id: String(r.id),
  slug: String(r.slug),
  title: String(r.title),
  category: String(r.category_id),
  shortDescription: String(r.short_description),
  fullDescription: json.parse(r.full_description, []),
  features: json.parse(r.features, []),
  benefits: json.parse(r.benefits, []),
  deliverables: json.parse(r.deliverables, []),
  cover: json.parse(r.cover, { pattern: 'grid' }),
  related: json.parse(r.related, []),
  pricing: json.parse(r.pricing, { price: { kind: 'individual' }, visible: true }),
  terminal: json.parse(r.terminal, EMPTY_TERMINAL),
  seo: json.parse(r.seo, { title: '', description: '' }),
  status: r.status as PublicationStatus,
  order: Number(r.sort_order),
  demo: Number(r.demo) === 1,
  updatedAt: String(r.updated_at),
})

const serviceParams = (s: Service) => [
  s.slug,
  s.title,
  s.category,
  s.shortDescription,
  json.str(s.fullDescription),
  json.str(s.features),
  json.str(s.benefits),
  json.str(s.deliverables),
  json.str(s.cover),
  json.str(s.related),
  json.str(s.pricing),
  json.str(s.terminal),
  json.str(s.seo),
  s.status,
  s.order,
]

export const services = {
  list(): Service[] {
    return (db.prepare('SELECT * FROM services ORDER BY sort_order, title').all() as Row[]).map(toService)
  },
  get(id: string): Service | null {
    const r = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Row | undefined
    return r ? toService(r) : null
  },
  slugTaken(slug: string, exceptId?: string) {
    return !!db.prepare('SELECT 1 FROM services WHERE slug = ? AND id != ?').get(slug, exceptId ?? '')
  },
  create(s: Service) {
    const t = now()
    db.prepare(
      `INSERT INTO services (slug, title, category_id, short_description, full_description, features, benefits, deliverables,
         cover, related, pricing, terminal, seo, status, sort_order, id, demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(...serviceParams(s), s.id, s.demo ? 1 : 0, t, t)
    return services.get(s.id)!
  },
  update(id: string, s: Service) {
    db.prepare(
      `UPDATE services SET slug = ?, title = ?, category_id = ?, short_description = ?, full_description = ?, features = ?,
         benefits = ?, deliverables = ?, cover = ?, related = ?, pricing = ?, terminal = ?, seo = ?, status = ?, sort_order = ?,
         updated_at = ?
       WHERE id = ?`,
    ).run(...serviceParams(s), now(), id)
    return services.get(id)
  },
  /** удаление услуги убирает её и из «связанных» у других услуг */
  remove(id: string) {
    return tx(() => {
      const ok = db.prepare('DELETE FROM services WHERE id = ?').run(id).changes > 0
      if (ok) {
        for (const s of services.list()) {
          if (s.related.includes(id)) {
            db.prepare('UPDATE services SET related = ? WHERE id = ?').run(json.str(s.related.filter((r) => r !== id)), s.id)
          }
        }
      }
      return ok
    })
  },
  /** опубликованные услуги из видимых категорий */
  published(): { services: Service[]; categories: ServiceCategory[] } {
    const cats = categories.list().filter((c) => !c.hidden)
    const visible = new Set(cats.map((c) => c.id))
    const list = services.list().filter((s) => s.status === 'published' && visible.has(s.category))
    const ids = new Set(list.map((s) => s.id))
    // связанные — только из того, что реально видно на сайте
    return { services: list.map((s) => ({ ...s, related: s.related.filter((r) => ids.has(r)) })), categories: cats }
  },
}

/* ------------------------------------------------------------------ проекты */

const toProject = (r: Row): Project => ({
  id: String(r.id),
  slug: String(r.slug),
  title: String(r.title),
  summary: String(r.summary),
  services: json.parse(r.services, []),
  tags: json.parse(r.tags, []),
  cover: json.parse(r.cover, { pattern: 'grid' }),
  status: r.status as PublicationStatus,
  kind: r.kind as Project['kind'],
  url: (r.url as string | null) ?? null,
  order: Number(r.sort_order),
})

export const projects = {
  list(): Project[] {
    return (db.prepare('SELECT * FROM projects ORDER BY sort_order, title').all() as Row[]).map(toProject)
  },
  get(id: string): Project | null {
    const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined
    return r ? toProject(r) : null
  },
  slugTaken(slug: string, exceptId?: string) {
    return !!db.prepare('SELECT 1 FROM projects WHERE slug = ? AND id != ?').get(slug, exceptId ?? '')
  },
  create(p: Project) {
    const t = now()
    db.prepare(
      `INSERT INTO projects (id, slug, title, summary, services, tags, cover, status, kind, url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(p.id, p.slug, p.title, p.summary, json.str(p.services), json.str(p.tags), json.str(p.cover), p.status, p.kind, p.url, p.order, t, t)
    return projects.get(p.id)!
  },
  update(id: string, p: Project) {
    db.prepare(
      `UPDATE projects SET slug = ?, title = ?, summary = ?, services = ?, tags = ?, cover = ?, status = ?, kind = ?, url = ?,
         sort_order = ?, updated_at = ? WHERE id = ?`,
    ).run(p.slug, p.title, p.summary, json.str(p.services), json.str(p.tags), json.str(p.cover), p.status, p.kind, p.url, p.order, now(), id)
    return projects.get(id)
  },
  remove(id: string) {
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0
  },
  published(): Project[] {
    return projects.list().filter((p) => p.status === 'published')
  },
}

/* ------------------------------------------------------------------ настройки */

export const settings = {
  get(): SiteSettings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const stored = Object.fromEntries(rows.map((r) => [r.key, json.parse(r.value, {})]))
    // недостающие поля берутся из значений по умолчанию
    return {
      contacts: { ...DEFAULT_SETTINGS.contacts, ...(stored.contacts ?? {}) },
      cta: { ...DEFAULT_SETTINGS.cta, ...(stored.cta ?? {}) },
    }
  },
  save(s: SiteSettings) {
    tx(() => {
      const stmt = db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      stmt.run('contacts', json.str(s.contacts), now())
      stmt.run('cta', json.str(s.cta), now())
    })
    return settings.get()
  },
}

/* ------------------------------------------------------------------ заявки */

const toLead = (r: Row): Lead => ({
  id: Number(r.id),
  createdAt: String(r.created_at),
  name: String(r.name),
  contact: String(r.contact),
  service: (r.service_slug as string | null) ?? null,
  message: String(r.message),
  status: r.status as LeadStatus,
  page: (r.page as string | null) ?? null,
  note: String(r.note ?? ''),
})

export const leads = {
  create(l: { name: string; contact: string; service: string | null; message: string; page: string | null; userAgent: string | null }) {
    const res = db
      .prepare(
        `INSERT INTO leads (created_at, name, contact, service_slug, message, page, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(now(), l.name, l.contact, l.service, l.message, l.page, l.userAgent)
    return leads.get(Number(res.lastInsertRowid))!
  },
  get(id: number): Lead | null {
    const r = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Row | undefined
    return r ? toLead(r) : null
  },
  list(q: { search?: string; status?: LeadStatus | null; limit: number; offset: number }) {
    const where: string[] = []
    const params: (string | number)[] = []
    if (q.status) {
      where.push('status = ?')
      params.push(q.status)
    }
    if (q.search) {
      where.push(`(name LIKE ? ESCAPE '\\' OR contact LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\' OR service_slug LIKE ? ESCAPE '\\')`)
      const like = `%${q.search.replace(/[%_\\]/g, '\\$&')}%`
      params.push(like, like, like, like)
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = Number((db.prepare(`SELECT COUNT(*) n FROM leads ${w}`).get(...params) as Row).n)
    const items = (
      db.prepare(`SELECT * FROM leads ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, q.limit, q.offset) as Row[]
    ).map(toLead)
    return { items, total }
  },
  update(id: number, patch: { status?: LeadStatus; note?: string }) {
    const cur = leads.get(id)
    if (!cur) return null
    db.prepare('UPDATE leads SET status = ?, note = ? WHERE id = ?').run(patch.status ?? cur.status, patch.note ?? cur.note, id)
    return leads.get(id)
  },
  remove(id: number) {
    return db.prepare('DELETE FROM leads WHERE id = ?').run(id).changes > 0
  },
  countByStatus(): Record<LeadStatus, number> {
    const out: Record<LeadStatus, number> = { new: 0, in_progress: 0, done: 0, spam: 0 }
    for (const r of db.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all() as Row[]) {
      out[r.status as LeadStatus] = Number(r.n)
    }
    return out
  },
}

/* ------------------------------------------------------------------ администраторы и сессии */

export type Admin = { id: number; email: string; passwordHash: string; lastLoginAt: string | null }

const toAdmin = (r: Row): Admin => ({
  id: Number(r.id),
  email: String(r.email),
  passwordHash: String(r.password_hash),
  lastLoginAt: (r.last_login_at as string | null) ?? null,
})

export const admins = {
  byEmail(email: string): Admin | null {
    const r = db.prepare('SELECT * FROM admins WHERE email = ?').get(email) as Row | undefined
    return r ? toAdmin(r) : null
  },
  byId(id: number): Admin | null {
    const r = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as Row | undefined
    return r ? toAdmin(r) : null
  },
  list(): Admin[] {
    return (db.prepare('SELECT * FROM admins ORDER BY id').all() as Row[]).map(toAdmin)
  },
  count(): number {
    return Number((db.prepare('SELECT COUNT(*) n FROM admins').get() as Row).n)
  },
  create(email: string, passwordHash: string) {
    db.prepare('INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)').run(email, passwordHash, now())
    return admins.byEmail(email)!
  },
  setPassword(id: number, passwordHash: string) {
    tx(() => {
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, id)
      // смена пароля завершает все сессии
      db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(id)
    })
  },
  touchLogin(id: number) {
    db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now(), id)
  },
  remove(id: number) {
    return db.prepare('DELETE FROM admins WHERE id = ?').run(id).changes > 0
  },
}

export const sessions = {
  create(tokenHash: string, adminId: number, expiresAt: string, userAgent: string | null) {
    db.prepare('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)').run(
      tokenHash,
      adminId,
      now(),
      expiresAt,
      userAgent,
    )
  },
  find(tokenHash: string): { adminId: number; expiresAt: string } | null {
    const r = db.prepare('SELECT admin_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash) as Row | undefined
    return r ? { adminId: Number(r.admin_id), expiresAt: String(r.expires_at) } : null
  },
  remove(tokenHash: string) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  },
  purgeExpired() {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now())
  },
}
