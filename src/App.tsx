import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { FocusPanel } from './components/FocusPanel'
import { Loader } from './components/Loader'
import { StubPage } from './components/StubPage'
import { SceneFallback } from './components/SceneFallback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Hotspots } from './components/Hotspots'
import { LaptopSite } from './components/LaptopSite'
import { ServicesPage } from './pages/ServicesPage'
import { ServicePage } from './pages/ServicePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ContactPage } from './pages/ContactPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { hotspotEls } from './scene/hotspotBridge'
import { dive, resetDiveChannels, screenAnchor, screenDom, setPhase, useDivePhase } from './dive/diveStore'
import { useDiveController } from './dive/useDiveController'
import { useReducedMotion } from './hooks/useMediaQuery'
import { useDocumentMeta } from './hooks/useDocumentMeta'
import { detectWebGL, isLowPowerDevice } from './lib/device'
import { useRouter, useScrollManagement } from './lib/router'
import { ROUTES, type Match } from './lib/routes'
import type { FocusTarget } from './lib/theme'

// Сцена грузится отдельным чанком и только когда нужна главная:
// прямой заход на /services не тянет three.js.
const Scene = lazy(() => import('./scene/Scene'))

const isCatalogRoot = (to: string) => {
  const url = new URL(to, window.location.href)
  return url.pathname === ROUTES.services.pattern && !url.search
}

export default function App() {
  const reducedMotion = useReducedMotion()
  const { match, location, navigateDirect, setInterceptor } = useRouter()
  const phase = useDivePhase()
  useScrollManagement()

  const webgl = useMemo(() => detectWebGL(), [])
  const lowPower = useMemo(() => isLowPowerDevice(), [])
  const isHome = match.id === 'home'

  const [focus, setFocus] = useState<FocusTarget>(null)
  const [hovered, setHovered] = useState<FocusTarget>(null)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const useFallback = !webgl || sceneFailed

  // Сцена монтируется при первом посещении главной и дальше живёт (на паузе) —
  // возврат «Назад» на главную не перезагружает 3D.
  const [sceneWanted, setSceneWanted] = useState(isHome)
  if (isHome && !sceneWanted) setSceneWanted(true)

  /* ---------------------------------------------------------- загрузка */

  // Шрифты нужны canvas-текстурам → затем сцена → первый кадр
  const [fontsReady, setFontsReady] = useState(false)
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(1)
  useEffect(() => {
    if (!sceneWanted) return
    let alive = true
    const timeout = new Promise((r) => setTimeout(r, 2500))
    Promise.race([document.fonts?.ready ?? Promise.resolve(), timeout]).then(() => {
      if (!alive) return
      setFontsReady(true)
      setStage((s) => (s < 2 ? 2 : s))
    })
    return () => {
      alive = false
    }
  }, [sceneWanted])

  const handleReady = useCallback(() => {
    setStage(3)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!sceneWanted) return
    if (useFallback && fontsReady) {
      handleReady()
      return
    }
    // страховка на случай зависания сцены
    const t = setTimeout(handleReady, 10000)
    return () => clearTimeout(t)
  }, [sceneWanted, useFallback, fontsReady, handleReady])

  /* ---------------------------------------------------------- переход в каталог */

  const readyRef = useRef(ready)
  readyRef.current = ready
  const fallbackRef = useRef(useFallback)
  fallbackRef.current = useFallback
  const canDive = useCallback(
    () => readyRef.current && !fallbackRef.current && !!screenDom.frame && !!screenAnchor.current,
    [],
  )
  const diveCtl = useDiveController({ canDive, reducedMotion, lowPower, navigateDirect })

  const startDive = useCallback(() => {
    setFocus(null)
    setHovered(null)
    diveCtl.start()
  }, [diveCtl])

  // Любой переход с главной на /services (кнопка, пункт меню, ноутбук) — через погружение
  const matchRef = useRef<Match>(match)
  matchRef.current = match
  useEffect(() => {
    setInterceptor((to) => {
      if (dive.phase === 'diving' || dive.phase === 'docking' || dive.phase === 'cancelling' || dive.phase === 'fading') {
        if (isCatalogRoot(to)) return true // уже летим туда — повторный клик игнорируем
        diveCtl.abort() // ушли в другой раздел посреди перехода
        return false
      }
      if (matchRef.current.id === 'home' && isCatalogRoot(to)) {
        startDive()
        return true
      }
      return false
    })
    return () => setInterceptor(null)
  }, [setInterceptor, diveCtl, startDive])

  // Смена страницы: завершённый переход сбрасывается, незавершённый (кнопка «Назад» браузера) — прерывается
  useLayoutEffect(() => {
    if (isHome) return
    setFocus(null)
    setHovered(null)
    if (dive.phase === 'handoff') {
      resetDiveChannels()
      setPhase('idle')
    } else if (dive.phase !== 'idle') {
      diveCtl.abort()
    }
  }, [isHome, diveCtl])

  // Перевод фокуса на содержимое новой страницы (для клавиатуры и скринридеров)
  useEffect(() => {
    if (location.action === 'init' || location.action === 'replace' || isHome) return
    const main = document.getElementById('main')
    if (!main) return
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1
    main.focus({ preventScroll: true })
  }, [location.pathname, location.action, isHome])

  /* ---------------------------------------------------------- управление на главной */

  const back = useCallback(() => setFocus(null), [])

  const prevFocus = useRef<FocusTarget>(null)
  useEffect(() => {
    const prev = prevFocus.current
    prevFocus.current = focus
    if (prev && !focus && document.activeElement === document.body) {
      requestAnimationFrame(() => hotspotEls[prev]?.focus({ preventScroll: true }))
    }
  }, [focus])

  // Esc: отменить переход или выйти из приближения
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.classList.contains('menu-open')) return
      if (dive.phase === 'diving') diveCtl.cancel()
      else if (focus) setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, diveCtl])

  // Колесо / свайп: вниз — погружение в каталог, вверх — отмена или выход из приближения
  const lock = useRef(0)
  useEffect(() => {
    if (!isHome || !ready) return
    const step = (dir: 1 | -1) => {
      const now = performance.now()
      if (now - lock.current < 900) return
      lock.current = now
      if (dir > 0 && dive.phase === 'idle') startDive()
      else if (dir < 0) {
        if (dive.phase === 'diving') diveCtl.cancel()
        else setFocus(null)
      }
    }
    const onWheel = (e: WheelEvent) => {
      if (document.body.classList.contains('menu-open') || Math.abs(e.deltaY) < 24) return
      step(e.deltaY > 0 ? 1 : -1)
    }
    let startY: number | null = null
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (startY === null || document.body.classList.contains('menu-open')) return
      const dy = startY - (e.changedTouches[0]?.clientY ?? startY)
      startY = null
      if (Math.abs(dy) > 70) step(dy > 0 ? 1 : -1)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isHome, ready, startDive, diveCtl])

  /* ---------------------------------------------------------- разметка */

  const diving = phase === 'diving' || phase === 'docking' || phase === 'cancelling'
  const busy = phase !== 'idle'
  const showLiveScreen = isHome && !useFallback && fontsReady

  return (
    <div
      className={[
        'app',
        focus ? 'is-focused' : '',
        isHome ? 'is-home' : 'is-sub',
        diving ? 'is-diving' : '',
        phase === 'fading' ? 'is-fading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>

      <Navbar onHome={back} />

      {isHome ? (
        <HomeOverlay
          ready={ready}
          busy={busy}
          focus={focus}
          hovered={hovered}
          reducedMotion={reducedMotion}
          useFallback={useFallback}
          onExplore={startDive}
          onFocus={setFocus}
          onHover={setHovered}
          onBack={back}
          onLaptop={startDive}
        />
      ) : (
        <RouteView match={match} />
      )}

      {sceneWanted && (
        <div className={`scene${isHome ? '' : ' is-hidden'}`} aria-hidden={!isHome || undefined}>
          {showLiveScreen && <LaptopSite />}
          {useFallback ? (
            <SceneFallback
              reason={webgl ? 'error' : 'unsupported'}
              onSelect={(t) => (t === 'laptop' ? startDive() : setFocus(t))}
            />
          ) : (
            fontsReady && (
              <ErrorBoundary fallback={null} onError={() => setSceneFailed(true)}>
                <Suspense fallback={null}>
                  <Scene
                    focus={isHome ? focus : null}
                    hovered={hovered}
                    onFocus={(t) => isHome && !busy && setFocus(t)}
                    onHover={(t) => !busy && setHovered(t)}
                    onLaptopSelect={() => isHome && startDive()}
                    reducedMotion={reducedMotion}
                    lowPower={lowPower}
                    liveScreen={showLiveScreen}
                    diving={busy}
                    paused={!isHome && ready}
                    onReady={handleReady}
                    onError={() => setSceneFailed(true)}
                  />
                </Suspense>
              </ErrorBoundary>
            )
          )}
        </div>
      )}

      {phase === 'diving' && (
        <button type="button" className="dive-cancel" onClick={() => diveCtl.cancel()}>
          Отменить переход <kbd>Esc</kbd>
        </button>
      )}

      {/* загрузчик — только у 3D-главной; остальные страницы доступны сразу */}
      {isHome && !useFallback && <Loader stage={stage} done={ready} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function RouteView({ match }: { match: Match }) {
  switch (match.id) {
    case 'services':
      return <ServicesPage />
    case 'service':
      return <ServicePage slug={match.params.slug} />
    case 'projects':
      return <ProjectsPage />
    case 'contact':
      return <ContactPage />
    case 'about':
      return <StubPage route="about" />
    default:
      return <NotFoundPage />
  }
}

type HomeProps = {
  ready: boolean
  busy: boolean
  focus: FocusTarget
  hovered: FocusTarget
  reducedMotion: boolean
  useFallback: boolean
  onExplore: () => void
  onFocus: (t: FocusTarget) => void
  onHover: (t: FocusTarget) => void
  onBack: () => void
  onLaptop: () => void
}

function HomeOverlay({ ready, busy, focus, hovered, reducedMotion, useFallback, onExplore, onFocus, onHover, onBack, onLaptop }: HomeProps) {
  useDocumentMeta(ROUTES.home.title, ROUTES.home.description)
  const hideHero = !!focus || busy

  return (
    <main className="stage" id="main" tabIndex={-1}>
      <Hero ready={ready} hidden={hideHero} reducedMotion={reducedMotion} onExplore={onExplore} />
      {!useFallback && (
        <Hotspots
          hidden={!!focus || !ready || busy}
          hovered={hovered}
          onSelect={(id) => (id === 'laptop' ? onLaptop() : onFocus(id))}
          onHover={onHover}
        />
      )}
      <FocusPanel focus={focus === 'phone' ? 'phone' : null} reducedMotion={reducedMotion} onBack={onBack} />
      {hovered && !focus && !busy && (
        <p className="scene-hint" aria-hidden="true">
          {hovered === 'laptop' ? 'Нажмите, чтобы открыть каталог' : 'Нажмите, чтобы приблизить'}
        </p>
      )}
      {focus === 'phone' && (
        <nav className="scene-switch" aria-label="Объекты сцены">
          <button type="button" onClick={onLaptop}>
            01<span className="sr-only"> Сайты и каталоги: открыть каталог</span>
          </button>
          <button type="button" className="is-active" aria-pressed="true">
            02<span className="sr-only"> Мобильные решения</span>
          </button>
        </nav>
      )}
    </main>
  )
}
