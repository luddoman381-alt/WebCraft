import type { CategoryId, ProjectConcept, Service, ServiceCategory, ServiceQuery } from './types'
import { DEMO_CATEGORIES, DEMO_PROJECTS, DEMO_SERVICES } from './demo/catalog'

/*
 * Единый слой доступа к контенту. Компоненты не знают, откуда данные:
 * сейчас — демонстрационный источник, позднее — backend API.
 * Чтобы переключиться, достаточно реализовать ContentSource и передать
 * его в setContentSource().
 */

export interface ContentSource {
  listServices(): Promise<Service[]>
  listCategories(): Promise<ServiceCategory[]>
  listProjects(): Promise<ProjectConcept[]>
}

/** Имитация сетевой задержки демо-источника — чтобы состояния загрузки были видны и проверяемы. */
const DEMO_LATENCY_MS = 350

const wait = <T,>(value: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), DEMO_LATENCY_MS))

const demoSource: ContentSource = {
  listServices: () => wait(DEMO_SERVICES),
  listCategories: () => wait(DEMO_CATEGORIES),
  listProjects: () => wait(DEMO_PROJECTS),
}

let source: ContentSource = demoSource

export function setContentSource(next: ContentSource) {
  source = next
  cache.clear()
}

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
  cache.set(key, entry as Entry<unknown>)
  return entry
}

export type CatalogData = { services: Service[]; categories: ServiceCategory[] }

/** Опубликованные услуги и категории. Один запрос на сессию, далее — из кэша. */
export function catalogResource() {
  return cached<CatalogData>('catalog', async () => {
    const [services, categories] = await Promise.all([source.listServices(), source.listCategories()])
    return {
      services: services.filter((s) => s.status === 'published'),
      categories: [...categories].sort((a, b) => a.order - b.order),
    }
  })
}

export function projectsResource() {
  return cached<ProjectConcept[]>('projects', async () =>
    (await source.listProjects()).filter((p) => p.status === 'published'),
  )
}

/** Сбросить кэш (после ошибки или при обновлении данных). */
export function invalidate(key?: 'catalog' | 'projects') {
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
    const hay = normalize([s.title, s.shortDescription, ...s.fullDescription, ...s.features].join(' '))
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
  const extra = data.services.filter(
    (s) => s.id !== service.id && s.category === service.category && !explicit.includes(s),
  )
  return [...explicit, ...extra].slice(0, limit)
}

export const isCategoryId = (v: string | null, data: CatalogData): v is CategoryId =>
  !!v && data.categories.some((c) => c.id === v)
