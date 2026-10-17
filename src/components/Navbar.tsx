import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'
import { Link, useRouter } from '../lib/router'
import { NAV_ITEMS, ROUTES, type RouteId } from '../lib/routes'

type Props = {
  onHome?: () => void
  /** статичная копия для экрана 3D-ноутбука: без id, меню и обработчиков */
  preview?: boolean
  /** активный пункт для превью (в превью нет своего маршрута) */
  previewCurrent?: RouteId
}

const isActive = (current: RouteId, item: RouteId) => current === item || (item === 'services' && current === 'service')

export function Navbar({ onHome, preview = false, previewCurrent = 'services' }: Props) {
  if (preview) return <NavbarView current={previewCurrent} preview />
  return <LiveNavbar onHome={onHome} />
}

function LiveNavbar({ onHome }: { onHome?: () => void }) {
  const { match, location } = useRouter()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Закрываем меню при смене страницы
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }

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
    <NavbarView
      current={match.id}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onHome={() => {
        setOpen(false)
        onHome?.()
      }}
      panelRef={panelRef}
      toggleRef={toggleRef}
    />
  )
}

type ViewProps = {
  current: RouteId
  preview?: boolean
  open?: boolean
  onToggle?: () => void
  onHome?: () => void
  panelRef?: React.Ref<HTMLDivElement>
  toggleRef?: React.Ref<HTMLButtonElement>
}

function NavbarView({ current, preview, open = false, onToggle, onHome, panelRef, toggleRef }: ViewProps) {
  return (
    <header className={`nav${open ? ' is-open' : ''}${preview ? ' nav--preview' : ''}`}>
      <div className="nav__bar">
        <Link className="nav__brand" to={ROUTES.home.pattern} onClick={onHome} aria-label="WebCraft — на главную">
          <span className="nav__mark">
            <LogoMark />
          </span>
          <span className="nav__brand-text">
            <span className="nav__name">WebCraft</span>
            <span className="nav__tagline">Сайты и автоматизация</span>
          </span>
        </Link>

        <nav className="nav__links" aria-label={preview ? undefined : 'Основная навигация'}>
          <ul>
            {NAV_ITEMS.map((n) => (
              <li key={n.route}>
                <Link
                  to={ROUTES[n.route].pattern}
                  className="nav__link"
                  aria-current={isActive(current, n.route) ? 'page' : undefined}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <span className="nav__divider" aria-hidden="true" />
          <Link to={ROUTES.contact.pattern} className="btn btn--primary btn--sm">
            Обсудить проект
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="nav__toggle"
          aria-expanded={preview ? undefined : open}
          aria-controls={preview ? undefined : 'mobile-menu'}
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          onClick={onToggle}
        >
          <span />
          <span />
        </button>
      </div>
      <div className="nav__line" aria-hidden="true" />

      {!preview && (
        <div id="mobile-menu" ref={panelRef} className="nav__panel" hidden={!open}>
          <nav aria-label="Мобильная навигация">
            <ul>
              {NAV_ITEMS.map((n, i) => (
                <li key={n.route} style={{ '--i': i } as React.CSSProperties}>
                  <Link
                    to={ROUTES[n.route].pattern}
                    className="nav__panel-link"
                    aria-current={isActive(current, n.route) ? 'page' : undefined}
                  >
                    <span className="nav__panel-index">0{i + 1}</span>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={ROUTES.contact.pattern} className="btn btn--primary btn--block">
              Обсудить проект <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
