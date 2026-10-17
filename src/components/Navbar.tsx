import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'
import { NAV_ITEMS, ROUTES, hrefFor, type RouteId } from '../lib/routes'

type Props = {
  current: RouteId
  onHome: () => void
}

export function Navbar({ current, onHome }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Закрываем меню при смене маршрута / Escape / расширении экрана
  useEffect(() => setOpen(false), [current])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const mql = window.matchMedia('(min-width: 961px)')
    const onMql = () => mql.matches && setOpen(false)
    window.addEventListener('keydown', onKey)
    mql.addEventListener('change', onMql)
    document.body.classList.add('menu-open')
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      mql.removeEventListener('change', onMql)
      document.body.classList.remove('menu-open')
    }
  }, [open])

  return (
    <header className={`nav${open ? ' is-open' : ''}`}>
      <div className="nav__bar">
        <a
          className="nav__brand"
          href={hrefFor('home')}
          onClick={() => {
            setOpen(false)
            onHome()
          }}
          aria-label="WebCraft — на главную"
        >
          <span className="nav__mark">
            <LogoMark />
          </span>
          <span className="nav__brand-text">
            <span className="nav__name">WebCraft</span>
            <span className="nav__tagline">Сайты и автоматизация</span>
          </span>
        </a>

        <nav className="nav__links" aria-label="Основная навигация">
          <ul>
            {NAV_ITEMS.map((id) => (
              <li key={id}>
                <a href={hrefFor(id)} className="nav__link" aria-current={current === id ? 'page' : undefined}>
                  {ROUTES[id].title}
                </a>
              </li>
            ))}
          </ul>
          <span className="nav__divider" aria-hidden="true" />
          <a href={hrefFor('brief')} className="btn btn--primary btn--sm">
            Обсудить проект
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </a>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
      <div className="nav__line" aria-hidden="true" />

      <div id="mobile-menu" ref={panelRef} className="nav__panel" hidden={!open}>
        <nav aria-label="Мобильная навигация">
          <ul>
            {NAV_ITEMS.map((id, i) => (
              <li key={id} style={{ '--i': i } as React.CSSProperties}>
                <a href={hrefFor(id)} className="nav__panel-link" aria-current={current === id ? 'page' : undefined}>
                  <span className="nav__panel-index">0{i + 1}</span>
                  {ROUTES[id].title}
                </a>
              </li>
            ))}
          </ul>
          <a href={hrefFor('brief')} className="btn btn--primary btn--block">
            Обсудить проект <span aria-hidden="true">→</span>
          </a>
          <p className="nav__panel-meta">hello@webcraft.studio · пн–пт 10:00–19:00</p>
        </nav>
      </div>
    </header>
  )
}
