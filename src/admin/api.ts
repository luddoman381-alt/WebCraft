import { api, ApiError } from '../data/http'
import { invalidate } from '../data/repository'
import type { Lead, LeadStatus, Project, Service, ServiceCategory, SiteSettings } from '../data/types'

/*
 * Клиент административного API. Сессия — httpOnly-cookie, которую
 * JavaScript не видит; при 401 панель показывает экран входа.
 */

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

async function call<T>(path: string, opts: Parameters<typeof api>[1] = {}): Promise<T> {
  try {
    const res = await api<T>(path, opts)
    // любое изменение сбрасывает кэш публичного сайта — правки видны сразу
    if (opts.method && opts.method !== 'GET') invalidate()
    return res
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) onUnauthorized?.()
    throw err
  }
}

export type CategoryWithCount = ServiceCategory & { services: number }

export type Stats = {
  services: { total: number; published: number; hidden: number; demo: number }
  categories: { total: number; hidden: number }
  projects: { total: number }
  leads: { byStatus: Record<LeadStatus, number>; recent: Lead[] }
}

export type LeadPage = { items: Lead[]; total: number; page: number; limit: number }

export const adminApi = {
  me: () => api<{ email: string }>('/api/auth/me'),
  login: (email: string, password: string) => api<{ email: string }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),

  stats: () => call<Stats>('/api/admin/stats'),

  services: () => call<Service[]>('/api/admin/services'),
  service: (id: string) => call<Service>(`/api/admin/services/${encodeURIComponent(id)}`),
  createService: (s: Partial<Service>) => call<Service>('/api/admin/services', { method: 'POST', body: s }),
  updateService: (id: string, s: Partial<Service>) =>
    call<Service>(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'PUT', body: s }),
  deleteService: (id: string) => call(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  categories: () => call<CategoryWithCount[]>('/api/admin/categories'),
  createCategory: (c: ServiceCategory) => call<ServiceCategory>('/api/admin/categories', { method: 'POST', body: c }),
  updateCategory: (id: string, c: ServiceCategory) =>
    call<ServiceCategory>(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: c }),
  deleteCategory: (id: string) => call(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  projects: () => call<Project[]>('/api/admin/projects'),
  createProject: (p: Partial<Project>) => call<Project>('/api/admin/projects', { method: 'POST', body: p }),
  updateProject: (id: string, p: Partial<Project>) =>
    call<Project>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: p }),
  deleteProject: (id: string) => call(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  settings: () => call<SiteSettings>('/api/admin/settings'),
  saveSettings: (s: SiteSettings) => call<SiteSettings>('/api/admin/settings', { method: 'PUT', body: s }),

  leads: (q: { q?: string; status?: string; page?: number }) => {
    const p = new URLSearchParams()
    if (q.q) p.set('q', q.q)
    if (q.status) p.set('status', q.status)
    if (q.page && q.page > 1) p.set('page', String(q.page))
    return call<LeadPage>(`/api/admin/leads?${p}`)
  },
  lead: (id: number) => call<Lead>(`/api/admin/leads/${id}`),
  updateLead: (id: number, patch: { status?: LeadStatus; note?: string }) =>
    call<Lead>(`/api/admin/leads/${id}`, { method: 'PATCH', body: patch }),
  deleteLead: (id: number) => call(`/api/admin/leads/${id}`, { method: 'DELETE' }),

  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<{ url: string }>('/api/admin/uploads', { method: 'POST', raw: form })
  },
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Завершена',
  spam: 'Спам',
}

/** Транслитерация для автоматического URL-slug. */
export function slugify(s: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  }
  return s
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
