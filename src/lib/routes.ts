/*
 * Таблица маршрутов. Единственное место, где описаны пути, заголовки
 * и пункты навигации. Механизм — History API (см. router.tsx).
 */

export type RouteId = 'home' | 'services' | 'service' | 'projects' | 'about' | 'contact' | 'notFound'

export type RouteDef = {
  id: RouteId
  /** шаблон пути; `:param` — именованный сегмент */
  pattern: string
  title: string
  description: string
}

export const ROUTES: Record<Exclude<RouteId, 'notFound'>, RouteDef> = {
  home: {
    id: 'home',
    pattern: '/',
    title: 'WebCraft — Сайты и автоматизация',
    description: 'Студия разработки сайтов, каталогов и автоматизации бизнеса.',
  },
  services: {
    id: 'services',
    pattern: '/services',
    title: 'Услуги',
    description: 'Каталог услуг WebCraft: сайты, интернет-магазины, каталоги, боты, автоматизация и интеграции.',
  },
  service: {
    id: 'service',
    pattern: '/services/:slug',
    title: 'Услуга',
    description: '',
  },
  projects: {
    id: 'projects',
    pattern: '/projects',
    title: 'Проекты',
    description: 'Направления и демонстрационные концепты студии WebCraft.',
  },
  about: {
    id: 'about',
    pattern: '/about',
    title: 'О студии',
    description: 'Команда, подход к разработке и принципы качества WebCraft.',
  },
  contact: {
    id: 'contact',
    pattern: '/contact',
    title: 'Контакты',
    description: 'Обсудить проект с WebCraft.',
  },
}

export const NAV_ITEMS: { route: Exclude<RouteId, 'notFound' | 'service' | 'home'>; label: string }[] = [
  { route: 'services', label: 'Услуги' },
  { route: 'projects', label: 'Проекты' },
  { route: 'about', label: 'О студии' },
  { route: 'contact', label: 'Контакты' },
]

export type Match = { id: RouteId; params: Record<string, string> }

const compiled = Object.values(ROUTES).map((r) => {
  const keys: string[] = []
  const source = r.pattern
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1))
        return '([^/]+)'
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { id: r.id, keys, re: new RegExp(`^${source || '/'}/?$`) }
})

export function matchPath(pathname: string): Match {
  for (const c of compiled) {
    const m = c.re.exec(pathname)
    if (m) {
      const params: Record<string, string> = {}
      c.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
      return { id: c.id, params }
    }
  }
  return { id: 'notFound', params: {} }
}

/** Путь до маршрута с подстановкой параметров. */
export function pathFor(id: Exclude<RouteId, 'notFound'>, params: Record<string, string> = {}) {
  return ROUTES[id].pattern.replace(/:([a-zA-Z]+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ''))
}

/** Старые hash-ссылки этапа 1 (#/services, #/contacts) → реальные пути. */
export function legacyHashRedirect(): string | null {
  const h = window.location.hash
  if (!h.startsWith('#/')) return null
  const p = h.slice(1)
  const map: Record<string, string> = { '/contacts': '/contact', '/brief': '/contact' }
  return map[p] ?? p
}
