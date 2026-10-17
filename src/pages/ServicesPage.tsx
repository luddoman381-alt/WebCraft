import { useEffect, useMemo, useRef, useState } from 'react'
import { catalogResource, invalidate, isCategoryId, queryServices, type CatalogData } from '../data/repository'
import { useResource } from '../data/useResource'
import type { CategoryId, ServiceSort } from '../data/types'
import { ServiceCard, ServiceCardSkeleton } from '../components/catalog/ServiceCard'
import { Footer } from '../components/Footer'
import { Link, useRouter } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useReducedMotion } from '../hooks/useMediaQuery'

const SORTS: { id: ServiceSort; label: string }[] = [
  { id: 'recommended', label: 'Рекомендуемые' },
  { id: 'title-asc', label: 'По названию: А–Я' },
  { id: 'title-desc', label: 'По названию: Я–А' },
  { id: 'category', label: 'По направлению' },
]

const isSort = (v: string | null): v is ServiceSort => SORTS.some((s) => s.id === v)

const invalidateCatalog = () => invalidate('catalog')

type Props = {
  /**
   * Превью на экране 3D-ноутбука: та же вёрстка, но без URL-синхронизации,
   * фокуса и анимаций входа. Контейнер превью помечен inert.
   */
  preview?: boolean
}

export function ServicesPage({ preview = false }: Props) {
  const res = useResource(catalogResource, invalidateCatalog)
  const { location, query, navigateDirect } = useRouter()
  const reducedMotion = useReducedMotion()
  const arrivedByDive = !preview && !!location.state.dive

  // Фильтры: источник истины — URL (?q=&category=&sort=), локальное состояние — для ввода
  const [q, setQ] = useState(() => (preview ? '' : (query.get('q') ?? '')))
  const [category, setCategory] = useState<string | null>(() => (preview ? null : query.get('category')))
  const [sort, setSort] = useState<ServiceSort>(() => {
    const s = preview ? null : query.get('sort')
    return isSort(s) ? s : 'recommended'
  })

  // «Назад»/«Вперёд» браузера возвращают фильтры из URL
  useEffect(() => {
    if (preview || location.action !== 'pop') return
    setQ(query.get('q') ?? '')
    setCategory(query.get('category'))
    const s = query.get('sort')
    setSort(isSort(s) ? s : 'recommended')
  }, [preview, location, query])

  // Локальные фильтры → URL (replace: фильтры не засоряют историю)
  useEffect(() => {
    if (preview) return
    const t = setTimeout(() => {
      const p = new URLSearchParams()
      if (q.trim()) p.set('q', q.trim())
      if (category) p.set('category', category)
      if (sort !== 'recommended') p.set('sort', sort)
      const next = `${ROUTES.services.pattern}${p.toString() ? `?${p}` : ''}`
      if (next !== window.location.pathname + window.location.search) {
        navigateDirect(next, { replace: true, state: window.history.state ?? {} })
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, category, sort, preview, navigateDirect])

  useDocumentMeta(ROUTES.services.title, ROUTES.services.description, !preview)

  const data = res.status === 'ready' ? res.data : null
  const activeCategory = data && isCategoryId(category, data) ? (category as CategoryId) : null
  const results = useMemo(
    () => (data ? queryServices(data, { q, category: activeCategory, sort }) : []),
    [data, q, activeCategory, sort],
  )
  const counts = useMemo(() => countByCategory(data), [data])

  const toolbarRef = useRef<HTMLDivElement>(null)
  const pickCategory = (id: CategoryId | null) => {
    setCategory(id)
    if (preview) return
    const el = toolbarRef.current
    if (el) {
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navH - 16, behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }

  const reset = () => {
    setQ('')
    setCategory(null)
    setSort('recommended')
  }

  const animateCards = !preview && !arrivedByDive && !reducedMotion
  const catById = useMemo(() => new Map(data?.categories.map((c) => [c.id, c]) ?? []), [data])

  return (
    <main className={`page services${preview ? ' is-preview' : ''}`} id={preview ? undefined : 'main'}>
      <header className="page-hero">
        <div className="page-hero__inner">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            КАТАЛОГ УСЛУГ <span className="eyebrow__sep">/</span> {data ? String(data.categories.length).padStart(2, '0') : '—'} НАПРАВЛЕНИЙ
          </p>
          <h1 className="page-hero__title">
            Цифровые решения <span className="accent">для бизнеса</span>
          </h1>
          <p className="page-hero__lead">
            Сайты, магазины, каталоги, боты и автоматизация. Каждая услуга — отдельная страница с описанием, возможностями
            и условиями расчёта.
          </p>
        </div>

        <ul className="cat-tiles" aria-label="Направления">
          {(data?.categories ?? Array.from({ length: 8 }, () => null)).map((c, i) => (
            <li key={c?.id ?? i}>
              {c ? (
                <button
                  type="button"
                  className={`cat-tile${activeCategory === c.id ? ' is-active' : ''}`}
                  onClick={() => pickCategory(activeCategory === c.id ? null : c.id)}
                  aria-pressed={activeCategory === c.id}
                >
                  <span className="cat-tile__index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cat-tile__title">{c.title}</span>
                  <span className="cat-tile__summary">{c.summary}</span>
                  <span className="cat-tile__count">{counts.get(c.id) ?? 0}</span>
                </button>
              ) : (
                <span className="cat-tile cat-tile--skeleton skeleton" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </header>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="catalog__toolbar" ref={toolbarRef} data-dive-anchor>
          <h2 id="catalog-title" className="catalog__title">
            Все услуги
            <span className="catalog__count" aria-live="polite">
              {data ? `${results.length} из ${data.services.length}` : 'загрузка…'}
            </span>
          </h2>
          <div className="catalog__controls">
            <label className="search">
              <span className="sr-only">Поиск по услугам</span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="search__icon">
                <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M13.5 13.5 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск: каталог, бот, CRM…"
                autoComplete="off"
              />
              {q && (
                <button type="button" className="search__clear" onClick={() => setQ('')} aria-label="Очистить поиск">
                  ×
                </button>
              )}
            </label>
            <label className="select">
              <span className="sr-only">Сортировка</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as ServiceSort)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="chips" role="group" aria-label="Фильтр по направлению">
            <button type="button" className={`chip${!activeCategory ? ' is-active' : ''}`} aria-pressed={!activeCategory} onClick={() => setCategory(null)}>
              Все
            </button>
            {data?.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${activeCategory === c.id ? ' is-active' : ''}`}
                aria-pressed={activeCategory === c.id}
                onClick={() => setCategory(activeCategory === c.id ? null : c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        {res.status === 'loading' && (
          <div className="grid" aria-busy="true" aria-label="Загрузка каталога">
            {Array.from({ length: 6 }, (_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {res.status === 'error' && (
          <div className="state" role="alert">
            <p className="state__title">Не удалось загрузить каталог</p>
            <p className="state__text">Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={res.retry}>
              Повторить
            </button>
          </div>
        )}

        {data && results.length > 0 && (
          <div className="grid">
            {results.map((s, i) => (
              <ServiceCard key={s.id} service={s} category={catById.get(s.category)} index={i} animate={animateCards} />
            ))}
          </div>
        )}

        {data && results.length === 0 && (
          <div className="state">
            <p className="state__title">Ничего не найдено</p>
            <p className="state__text">
              {q ? <>По запросу «{q}» </> : 'По выбранным условиям '}
              {activeCategory ? `в направлении «${catById.get(activeCategory)?.title}» ` : ''}услуг нет. Попробуйте изменить запрос или
              опишите задачу — подберём решение.
            </p>
            <div className="state__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
                Сбросить фильтры
              </button>
              <Link to={ROUTES.contact.pattern} className="btn btn--primary btn--sm">
                Обсудить проект →
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="cta-band">
        <div>
          <h2 className="cta-band__title">Не нашли подходящую услугу?</h2>
          <p className="cta-band__text">Расскажите о задаче — предложим решение и рассчитаем стоимость под ваш объём работ.</p>
        </div>
        <Link to={ROUTES.contact.pattern} className="btn btn--primary">
          Обсудить проект <span aria-hidden="true">→</span>
        </Link>
      </section>

      <Footer />
    </main>
  )
}

function countByCategory(data: CatalogData | null) {
  const m = new Map<string, number>()
  data?.services.forEach((s) => m.set(s.category, (m.get(s.category) ?? 0) + 1))
  return m
}
