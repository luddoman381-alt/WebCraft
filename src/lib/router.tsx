import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { legacyHashRedirect, matchPath, type Match } from './routes'

/*
 * Небольшой роутер на History API. Развитие hash-роутера этапа 1:
 * те же компоненты навигации, но реальные пути, параметры, query,
 * history.state и перехват навигации (для анимации погружения).
 */

export type NavState = {
  /** переход выполнен анимацией погружения — страница не играет вход и встаёт на scroll */
  dive?: boolean
  scroll?: number
  /** сохранённая прокрутка записи истории (для «Назад»/«Вперёд») */
  savedScroll?: number
}

export type Location = {
  pathname: string
  search: string
  state: NavState
  /** как мы сюда попали: push/replace из приложения или pop (кнопки браузера) */
  action: 'push' | 'replace' | 'pop' | 'init'
}

export type NavigateOptions = { replace?: boolean; state?: NavState }

/** Перехватчик может «забрать» переход (вернуть true) — например, чтобы сыграть анимацию. */
export type Interceptor = (to: string, opts: NavigateOptions) => boolean

type RouterValue = {
  location: Location
  match: Match
  query: URLSearchParams
  navigate: (to: string, opts?: NavigateOptions) => void
  /** переход, минуя перехватчики (используется самой анимацией) */
  navigateDirect: (to: string, opts?: NavigateOptions) => void
  setInterceptor: (fn: Interceptor | null) => void
}

const RouterContext = createContext<RouterValue | null>(null)

function read(action: Location['action']): Location {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    state: (window.history.state as NavState | null) ?? {},
    action,
  }
}

function saveScroll() {
  const st = (window.history.state as NavState | null) ?? {}
  window.history.replaceState({ ...st, savedScroll: window.scrollY }, '')
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(() => {
    const legacy = legacyHashRedirect()
    if (legacy) window.history.replaceState({}, '', legacy)
    return read('init')
  })
  const interceptor = useRef<Interceptor | null>(null)

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const onPop = () => setLocation(read('pop'))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigateDirect = useCallback((to: string, opts: NavigateOptions = {}) => {
    const url = new URL(to, window.location.href)
    const same = url.pathname === window.location.pathname && url.search === window.location.search
    saveScroll()
    const method = opts.replace || same ? 'replaceState' : 'pushState'
    window.history[method](opts.state ?? {}, '', url.pathname + url.search + url.hash)
    setLocation(read(method === 'pushState' ? 'push' : 'replace'))
  }, [])

  const navigate = useCallback(
    (to: string, opts: NavigateOptions = {}) => {
      if (interceptor.current?.(to, opts)) return
      navigateDirect(to, opts)
    },
    [navigateDirect],
  )

  const setInterceptor = useCallback((fn: Interceptor | null) => {
    interceptor.current = fn
  }, [])

  const value = useMemo<RouterValue>(
    () => ({
      location,
      match: matchPath(location.pathname),
      query: new URLSearchParams(location.search),
      navigate,
      navigateDirect,
      setInterceptor,
    }),
    [location, navigate, navigateDirect, setInterceptor],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter вне RouterProvider')
  return ctx
}

/**
 * Прокрутка при смене страницы: новая запись — наверх (или на state.scroll),
 * «Назад»/«Вперёд» — на сохранённую позицию. Срабатывает до отрисовки кадра.
 */
export function useScrollManagement() {
  const { location } = useRouter()
  const key = location.pathname
  useLayoutEffect(() => {
    if (location.action === 'init' && !location.state.savedScroll) return
    if (location.action === 'replace') return
    const y =
      location.action === 'pop' ? (location.state.savedScroll ?? 0) : (location.state.scroll ?? 0)
    window.scrollTo(0, y)
    // key — только pathname: смена query (фильтры каталога) не дёргает прокрутку
  }, [key, location.action, location.state])
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean }

/** Ссылка с настоящим href (открытие в новой вкладке, копирование) и SPA-переходом по клику. */
export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(to, { replace })
  }
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
