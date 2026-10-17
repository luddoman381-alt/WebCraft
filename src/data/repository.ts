import type { CategoryId, Project, Service, ServiceCategory, ServiceQuery, SiteSettings } from './types'
import { api } from './http'

/*
 * Единый слой доступа к публичному контенту. Источник — API сервера
 * (только опубликованные записи). Компоненты не знают, откуда данные.
 */

/* ------------------------------------------------------------------ кэш */

type Entry<T> = { status: 'pending' | 'ready' | 'error'; promise: Promise<T>; value?: T; error?: unknown }
const cache = new Map<string, Entry<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Entry<T> {
  const hit = cache.get(key) as Entry<T> | undefined
  if (hit && hit.status !== 'error') return hit
  const entry: Entry<T> = { status: 'pending', promise: Promise.resolve() as Promise<T> }
  entry.promise = load().then(
    (v) => {
      entry.status = 'ready'
      entry.value = v
      return v
    },
    (e) => {
      entry.status = 'error'
      entry.error = e
      throw e
    },
  )
  // необработанный отказ не должен всплывать в консоль — ошибку показывает интерфейс
  entry.promise.catch(() => {})
  cache.set(key, entry as Entry<unknown>)
  return entry
}

export type CatalogData = { services: Service[]; categories: ServiceCategory[] }

/** Опубликованные услуги и видимые категории. Один запрос, далее — из кэша. */
export function catalogResource() {
  return cached<CatalogData>('catalog', async () => {
    const data = await api<CatalogData>('/api/catalog')
    return { services: data.services, categories: [...data.categories].sort((a, b) => a.order - b.order) }
  })
}

export function projectsResource() {
  return cached<Project[]>('projects', () => api<Project[]>('/api/projects'))
}

export function settingsResource() {
  return cached<SiteSettings>('settings', () => api<SiteSettings>('/api/settings'))
}

/** Сбросить кэш: после ошибки или после сохранения в админ-панели. */
export function invalidate(key?: 'catalog' | 'projects' | 'settings') {
  if (key) cache.delete(key)
  else cache.clear()
}

/* ------------------------------------------------------------------ выборки */

const collator = new Intl.Collator('ru', { sensitivity: 'base' })

const normalize = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е')

export function queryServices(data: CatalogData, query: ServiceQuery): Service[] {
  const q = normalize(query.q?.trim() ?? '')
  const words = q ? q.split(/[^\p{L}\p{N}]+/u).filter(Boolean) : []
  const catOrder = new Map(data.categories.map((c) => [c.id, c.order]))

  const list = data.services.filter((s) => {
    if (query.category && s.category !== query.category) return false
    if (!words.length) return true
    // совпадение по началу слова: «бот» находит «боты», но не «работа»
    const hay = normalize(
      [s.title, s.shortDescription, ...s.fullDescription, ...s.features, ...s.benefits, ...s.deliverables].join(' '),
    )
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
    return words.every((w) => hay.some((h) => h.startsWith(w)))
  })

  switch (query.sort ?? 'recommended') {
    case 'title-asc':
      return list.sort((a, b) => collator.compare(a.title, b.title))
    case 'title-desc':
      return list.sort((a, b) => collator.compare(b.title, a.title))
    case 'category':
      return list.sort((a, b) => (catOrder.get(a.category) ?? 0) - (catOrder.get(b.category) ?? 0) || a.order - b.order)
    default:
      return list.sort((a, b) => a.order - b.order)
  }
}

export const findService = (data: CatalogData, slug: string) => data.services.find((s) => s.slug === slug) ?? null

export const findCategory = (data: CatalogData, id: CategoryId) => data.categories.find((c) => c.id === id) ?? null

export function relatedServices(data: CatalogData, service: Service, limit = 3): Service[] {
  const byId = new Map(data.services.map((s) => [s.id, s]))
  const explicit = service.related.map((id) => byId.get(id)).filter((s): s is Service => !!s)
  if (explicit.length >= limit) return explicit.slice(0, limit)
  // добираем услугами той же категории
  const extra = data.services.filter((s) => s.id !== service.id && s.category === service.category && !explicit.includes(s))
  return [...explicit, ...extra].slice(0, limit)
}

export const isCategoryId = (v: string | null, data: CatalogData): v is CategoryId =>
  !!v && data.categories.some((c) => c.id === v)
