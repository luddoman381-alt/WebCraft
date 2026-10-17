import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useRouter } from '../lib/router'
import { LogoMark } from '../components/Logo'
import { ApiError } from '../data/http'
import { adminApi, setUnauthorizedHandler } from './api'
import { ConfirmProvider, ToastProvider } from './ui'
import { Dashboard } from './pages/Dashboard'
import { ServicesList } from './pages/ServicesList'
import { ServiceEditor } from './pages/ServiceEditor'
import { CategoriesPage } from './pages/Categories'
import { ProjectsPage } from './pages/Projects'
import { SettingsPage } from './pages/Settings'
import { LeadsPage } from './pages/Leads'
import './admin.css'

const NAV = [
  { to: '/admin', label: 'Обзор', icon: '◧', match: (p: string) => p === '/admin' },
  { to: '/admin/services', label: 'Услуги', icon: '▤', match: (p: string) => p.startsWith('/admin/services') },
  { to: '/admin/categories', label: 'Категории', icon: '◫', match: (p: string) => p.startsWith('/admin/categories') },
  { to: '/admin/projects', label: 'Портфолио', icon: '◩', match: (p: string) => p.startsWith('/admin/projects') },
  { to: '/admin/leads', label: 'Заявки', icon: '✉', match: (p: string) => p.startsWith('/admin/leads') },
  { to: '/admin/settings', label: 'Настройки сайта', icon: '⚙', match: (p: string) => p.startsWith('/admin/settings') },
]

type Session = { status: 'checking' } | { status: 'guest'; expired?: boolean } | { status: 'admin'; email: string }

export default function AdminApp() {
  const [session, setSession] = useState<Session>({ status: 'checking' })

  useEffect(() => {
    document.title = 'Админ-панель — WebCraft'
    // панель не индексируется поисковиками
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    adminApi.me().then(
      (me) => setSession({ status: 'admin', email: me.email }),
      () => setSession({ status: 'guest' }),
    )
    return () => meta.remove()
  }, [])

  // сессия истекла посреди работы — показываем вход
  useEffect(() => {
    setUnauthorizedHandler(() => setSession({ status: 'guest', expired: true }))
    return () => setUnauthorizedHandler(null)
  }, [])

  if (session.status === 'checking') {
    return (
      <div className="admin admin--center">
        <span className="a-spinner" aria-label="Проверка сессии" />
      </div>
    )
  }
  if (session.status === 'guest') {
    return <Login expired={session.expired} onLogin={(email) => setSession({ status: 'admin', email })} />
  }
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell email={session.email} onLogout={() => setSession({ status: 'guest' })} />
      </ConfirmProvider>
    </ToastProvider>
  )
}

/* ------------------------------------------------------------------ вход */

function Login({ onLogin, expired }: { onLogin: (email: string) => void; expired?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(expired ? 'Сессия завершена. Войдите снова.' : '')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const me = await adminApi.login(email, password)
      setPassword('')
      onLogin(me.email)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin admin--center">
      <form className="a-login" onSubmit={submit} noValidate>
        <div className="a-login__brand">
          <span className="nav__mark">
            <LogoMark />
          </span>
          <div>
            <p className="a-login__name">WebCraft</p>
            <p className="a-login__sub">Панель управления</p>
          </div>
        </div>
        <h1>Вход</h1>
        <label className="a-login__field">
          <span>Email</span>
          <input className="a-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="a-login__field">
          <span>Пароль</span>
          <input
            className="a-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="a-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="a-btn a-btn--primary a-btn--block" disabled={busy || !email || !password}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
        <p className="a-login__note">
          Учётная запись создаётся на сервере командой <code>npm run admin:create</code>.
        </p>
        <Link to="/" className="a-login__back">
          ← На сайт
        </Link>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ оболочка */

function Shell({ email, onLogout }: { email: string; onLogout: () => void }) {
  const { location } = useRouter()
  const path = location.pathname.replace(/\/+$/, '') || '/admin'
  const [menuOpen, setMenuOpen] = useState(false)

  // закрываем меню планшета при переходе
  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setMenuOpen(false)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => {})
    onLogout()
  }, [onLogout])

  const seg = path.split('/').slice(2) // ['services', ':id']
  let page: React.ReactNode
  switch (seg[0]) {
    case undefined:
      page = <Dashboard />
      break
    case 'services':
      page = seg[1] ? <ServiceEditor key={seg[1]} id={seg[1] === 'new' ? null : decodeURIComponent(seg[1])} /> : <ServicesList />
      break
    case 'categories':
      page = <CategoriesPage />
      break
    case 'projects':
      page = <ProjectsPage />
      break
    case 'leads':
      page = <LeadsPage openId={seg[1] ? Number(seg[1]) : null} />
      break
    case 'settings':
      page = <SettingsPage />
      break
    default:
      page = (
        <div className="a-state">
          <p>Раздел не найден</p>
          <Link to="/admin" className="a-btn">
            К обзору
          </Link>
        </div>
      )
  }

  return (
    <div className={`admin${menuOpen ? ' is-menu' : ''}`}>
      <aside className="a-side" aria-label="Разделы панели">
        <div className="a-side__brand">
          <span className="nav__mark">
            <LogoMark size={22} />
          </span>
          <div>
            <p className="a-side__name">WebCraft</p>
            <p className="a-side__sub">Панель управления</p>
          </div>
          <button type="button" className="a-side__toggle" aria-expanded={menuOpen} aria-label="Меню" onClick={() => setMenuOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </div>
        <nav className="a-side__nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`a-side__link${n.match(path) ? ' is-active' : ''}`} aria-current={n.match(path) ? 'page' : undefined}>
              <span className="a-side__icon" aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="a-side__foot">
          <a href="/" target="_blank" rel="noopener" className="a-side__link">
            <span className="a-side__icon" aria-hidden="true">
              ↗
            </span>
            Открыть сайт
          </a>
          <p className="a-side__user" title={email}>
            {email}
          </p>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm a-btn--block" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="a-main" id="main" tabIndex={-1}>
        {page}
      </main>
    </div>
  )
}
