import type {
  Cover,
  CoverPattern,
  Currency,
  LeadStatus,
  PriceDisplay,
  Project,
  PublicationStatus,
  Service,
  ServiceCategory,
  SiteSettings,
  TerminalInfo,
} from '../src/data/types.ts'

/*
 * Серверная валидация. Каждая функция либо возвращает нормализованный
 * объект, либо бросает ValidationError с ошибками по полям
 * (сообщения — для показа в форме админ-панели).
 */

export class ValidationError extends Error {
  fields: Record<string, string>
  constructor(fields: Record<string, string>) {
    super('Проверьте выделенные поля')
    this.fields = fields
  }
}

type Obj = Record<string, unknown>

class Checker {
  errors: Record<string, string> = {}
  input: Obj

  constructor(input: unknown) {
    this.input = input && typeof input === 'object' && !Array.isArray(input) ? (input as Obj) : {}
  }

  fail(path: string, msg: string) {
    if (!this.errors[path]) this.errors[path] = msg
  }

  done() {
    if (Object.keys(this.errors).length) throw new ValidationError(this.errors)
  }

  /** строка: обрезка пробелов, ограничение длины, обязательность */
  str(src: Obj, key: string, path: string, opt: { max: number; min?: number; required?: boolean; pattern?: RegExp; patternMsg?: string }) {
    const raw = src[key]
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      this.fail(path, 'Ожидается текст')
      return ''
    }
    const v = (raw ?? '').trim()
    if (!v) {
      if (opt.required) this.fail(path, 'Обязательное поле')
      return ''
    }
    if (opt.min && v.length < opt.min) this.fail(path, `Не короче ${opt.min} символов`)
    if (v.length > opt.max) this.fail(path, `Не длиннее ${opt.max} символов`)
    if (opt.pattern && !opt.pattern.test(v)) this.fail(path, opt.patternMsg ?? 'Неверный формат')
    return v
  }

  /** список строк: пустые строки отбрасываются */
  list(src: Obj, key: string, path: string, opt: { maxItems: number; maxLen: number; minItems?: number }) {
    const raw = src[key] ?? []
    if (!Array.isArray(raw)) {
      this.fail(path, 'Ожидается список')
      return []
    }
    const out: string[] = []
    raw.forEach((item, i) => {
      if (typeof item !== 'string') return this.fail(`${path}.${i}`, 'Ожидается текст')
      const v = item.trim()
      if (!v) return
      if (v.length > opt.maxLen) this.fail(`${path}.${i}`, `Не длиннее ${opt.maxLen} символов`)
      out.push(v)
    })
    if (out.length > opt.maxItems) this.fail(path, `Не больше ${opt.maxItems} пунктов`)
    if (opt.minItems && out.length < opt.minItems) this.fail(path, `Нужно хотя бы ${opt.minItems}`)
    return out
  }

  int(src: Obj, key: string, path: string, opt: { min: number; max: number; fallback: number }) {
    const raw = src[key]
    if (raw === undefined || raw === null || raw === '') return opt.fallback
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isInteger(n) || n < opt.min || n > opt.max) {
      this.fail(path, `Целое число от ${opt.min} до ${opt.max}`)
      return opt.fallback
    }
    return n
  }

  oneOf<T extends string>(src: Obj, key: string, path: string, values: readonly T[], fallback?: T): T {
    const raw = src[key]
    if ((raw === undefined || raw === null || raw === '') && fallback) return fallback
    if (typeof raw === 'string' && (values as readonly string[]).includes(raw)) return raw as T
    this.fail(path, 'Недопустимое значение')
    return fallback ?? values[0]
  }

  bool(src: Obj, key: string) {
    return src[key] === true
  }

  obj(src: Obj, key: string): Obj {
    const v = src[key]
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {}
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG_MSG = 'Латинские буквы, цифры и дефис, например: online-store'
const PATTERNS: readonly CoverPattern[] = ['grid', 'orbit', 'stack', 'flow', 'nodes', 'bars', 'chat', 'spark']
const CURRENCIES: readonly Currency[] = ['KZT', 'RUB', 'USD', 'EUR']
const STATUSES: readonly PublicationStatus[] = ['published', 'hidden']
/** только загруженные файлы или внешние https-ссылки — без javascript: и data: */
const IMAGE_URL = /^(\/uploads\/[a-f0-9]{24,64}\.(png|jpe?g|webp)|https:\/\/[^\s"'<>]+)$/i
const HTTP_URL = /^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i

function cover(ch: Checker, src: Obj, path: string): Cover {
  const c = ch.obj(src, 'cover')
  const pattern = ch.oneOf(c, 'pattern', `${path}.pattern`, PATTERNS, 'grid')
  const img = ch.obj(c, 'image')
  const imgSrc = ch.str(img, 'src', `${path}.image`, { max: 500, pattern: IMAGE_URL, patternMsg: 'Загрузите файл или укажите https-ссылку' })
  const alt = ch.str(img, 'alt', `${path}.alt`, { max: 200 })
  return imgSrc ? { pattern, image: { src: imgSrc, alt } } : { pattern }
}

function pricing(ch: Checker, src: Obj): PriceDisplay {
  const p = ch.obj(src, 'pricing')
  const price = ch.obj(p, 'price')
  const kind = ch.oneOf(price, 'kind', 'pricing.kind', ['individual', 'fixed', 'from'] as const, 'individual')
  const note = ch.str(p, 'note', 'pricing.note', { max: 200 })
  const base = { visible: p.visible !== false, ...(note ? { note } : {}) }
  if (kind === 'individual') return { price: { kind }, ...base }
  const amount = Number(price.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) ch.fail('pricing.amount', 'Укажите сумму больше нуля')
  const currency = ch.oneOf(price, 'currency', 'pricing.currency', CURRENCIES, 'KZT')
  return { price: { kind, amount: Math.round(amount), currency }, ...base }
}

function terminal(ch: Checker, src: Obj, fallbackTitle: string): TerminalInfo {
  const t = ch.obj(src, 'terminal')
  return {
    title: ch.str(t, 'title', 'terminal.title', { max: 80 }) || fallbackTitle,
    specs: ch.list(t, 'specs', 'terminal.specs', { maxItems: 5, maxLen: 80 }),
    capabilities: ch.list(t, 'capabilities', 'terminal.capabilities', { maxItems: 5, maxLen: 80 }),
    priceText: ch.str(t, 'priceText', 'terminal.priceText', { max: 120 }),
  }
}

export function parseService(input: unknown, id: string, demo: boolean): Service {
  const ch = new Checker(input)
  const i = ch.input
  const title = ch.str(i, 'title', 'title', { required: true, min: 2, max: 120 })
  const seo = ch.obj(i, 'seo')
  const s: Service = {
    id,
    title,
    slug: ch.str(i, 'slug', 'slug', { required: true, max: 80, pattern: SLUG, patternMsg: SLUG_MSG }),
    category: ch.str(i, 'category', 'category', { required: true, max: 60 }),
    shortDescription: ch.str(i, 'shortDescription', 'shortDescription', { required: true, min: 10, max: 300 }),
    fullDescription: ch.list(i, 'fullDescription', 'fullDescription', { maxItems: 12, maxLen: 2000 }),
    features: ch.list(i, 'features', 'features', { maxItems: 12, maxLen: 120 }),
    benefits: ch.list(i, 'benefits', 'benefits', { maxItems: 12, maxLen: 160 }),
    deliverables: ch.list(i, 'deliverables', 'deliverables', { maxItems: 12, maxLen: 160 }),
    cover: cover(ch, i, 'cover'),
    related: ch.list(i, 'related', 'related', { maxItems: 6, maxLen: 64 }).filter((r) => r !== id),
    pricing: pricing(ch, i),
    terminal: terminal(ch, i, title),
    status: ch.oneOf(i, 'status', 'status', STATUSES, 'hidden'),
    seo: {
      title: ch.str(seo, 'title', 'seo.title', { max: 120 }),
      description: ch.str(seo, 'description', 'seo.description', { max: 300 }),
    },
    order: ch.int(i, 'order', 'order', { min: 0, max: 9999, fallback: 100 }),
    demo,
  }
  ch.done()
  return s
}

export function parseCategory(input: unknown): ServiceCategory {
  const ch = new Checker(input)
  const i = ch.input
  const c: ServiceCategory = {
    id: ch.str(i, 'id', 'id', { required: true, max: 60, pattern: SLUG, patternMsg: SLUG_MSG }),
    title: ch.str(i, 'title', 'title', { required: true, min: 2, max: 80 }),
    summary: ch.str(i, 'summary', 'summary', { max: 120 }),
    description: ch.str(i, 'description', 'description', { max: 1000 }),
    image: ch.str(i, 'image', 'image', { max: 500, pattern: IMAGE_URL, patternMsg: 'Загрузите файл или укажите https-ссылку' }) || null,
    order: ch.int(i, 'order', 'order', { min: 0, max: 9999, fallback: 100 }),
    hidden: ch.bool(i, 'hidden'),
  }
  ch.done()
  return c
}

export function parseProject(input: unknown, id: string): Project {
  const ch = new Checker(input)
  const i = ch.input
  const p: Project = {
    id,
    title: ch.str(i, 'title', 'title', { required: true, min: 2, max: 120 }),
    slug: ch.str(i, 'slug', 'slug', { required: true, max: 80, pattern: SLUG, patternMsg: SLUG_MSG }),
    summary: ch.str(i, 'summary', 'summary', { required: true, min: 10, max: 400 }),
    services: ch.list(i, 'services', 'services', { maxItems: 8, maxLen: 64 }),
    tags: ch.list(i, 'tags', 'tags', { maxItems: 8, maxLen: 40 }),
    cover: cover(ch, i, 'cover'),
    status: ch.oneOf(i, 'status', 'status', STATUSES, 'hidden'),
    kind: ch.oneOf(i, 'kind', 'kind', ['concept', 'case'] as const, 'concept'),
    url: ch.str(i, 'url', 'url', { max: 500, pattern: /^https?:\/\/[^\s"'<>]+$/i, patternMsg: 'Ссылка вида https://…' }) || null,
    order: ch.int(i, 'order', 'order', { min: 0, max: 9999, fallback: 100 }),
  }
  ch.done()
  return p
}

export function parseSettings(input: unknown): SiteSettings {
  const ch = new Checker(input)
  const c = ch.obj(ch.input, 'contacts')
  const cta = ch.obj(ch.input, 'cta')
  const rawLinks = Array.isArray(c.links) ? c.links : []
  if (rawLinks.length > 10) ch.fail('contacts.links', 'Не больше 10 ссылок')
  const links = rawLinks
    .map((l, idx) => {
      const o = l && typeof l === 'object' ? (l as Obj) : {}
      const label = ch.str(o, 'label', `contacts.links.${idx}.label`, { max: 40 })
      const url = ch.str(o, 'url', `contacts.links.${idx}.url`, { max: 300, pattern: HTTP_URL, patternMsg: 'https://…, mailto: или tel:' })
      if (url && !label) ch.fail(`contacts.links.${idx}.label`, 'Подпись ссылки')
      return { label, url }
    })
    .filter((l) => l.label && l.url)
    .slice(0, 10)
  const t = (key: keyof SiteSettings['cta'], max: number) => ch.str(cta, key, `cta.${key}`, { required: true, max })
  const s: SiteSettings = {
    contacts: {
      email: ch.str(c, 'email', 'contacts.email', { max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Неверный email' }),
      phone: ch.str(c, 'phone', 'contacts.phone', { max: 40, pattern: /^\+?[\d\s()-]{6,}$/, patternMsg: 'Только цифры, пробелы, +, -, ()' }),
      telegram: ch.str(c, 'telegram', 'contacts.telegram', { max: 60 }),
      hours: ch.str(c, 'hours', 'contacts.hours', { max: 80 }),
      address: ch.str(c, 'address', 'contacts.address', { max: 200 }),
      links,
    },
    cta: {
      heroPrimary: t('heroPrimary', 40),
      heroSecondary: t('heroSecondary', 40),
      navButton: t('navButton', 30),
      catalogTitle: t('catalogTitle', 80),
      catalogText: t('catalogText', 240),
      catalogButton: t('catalogButton', 40),
      serviceButton: t('serviceButton', 40),
      contactTitle: t('contactTitle', 80),
      contactLead: t('contactLead', 300),
      contactSubmit: t('contactSubmit', 40),
    },
  }
  ch.done()
  return s
}

/** Публичная форма заявки — те же правила, что и в браузере. */
export function parseLead(input: unknown) {
  const ch = new Checker(input)
  const i = ch.input
  const name = ch.str(i, 'name', 'name', { required: true, min: 2, max: 100 })
  const contact = ch.str(i, 'contact', 'contact', { required: true, max: 120 })
  if (contact) {
    const ok =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^\+?[\d\s()-]{7,}$/.test(contact) || /^@[\w]{4,}$/.test(contact)
    if (!ok) ch.fail('contact', 'Email, телефон или @username в Telegram')
  }
  const message = ch.str(i, 'message', 'message', { required: true, min: 10, max: 4000 })
  const service = ch.str(i, 'service', 'service', { max: 80, pattern: SLUG }) || null
  const page = ch.str(i, 'page', 'page', { max: 200 }) || null
  if (i.consent !== true) ch.fail('consent', 'Нужно согласие на обработку данных')
  ch.done()
  return { name, contact, message, service, page }
}

export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'in_progress', 'done', 'spam']

export function parseLeadPatch(input: unknown) {
  const ch = new Checker(input)
  const i = ch.input
  const out: { status?: LeadStatus; note?: string } = {}
  if (i.status !== undefined) out.status = ch.oneOf(i, 'status', 'status', LEAD_STATUSES)
  if (i.note !== undefined) out.note = ch.str(i, 'note', 'note', { max: 2000 })
  ch.done()
  return out
}
