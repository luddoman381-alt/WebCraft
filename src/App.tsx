import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { FocusPanel } from './components/FocusPanel'
import { Loader } from './components/Loader'
import { StubPage } from './components/StubPage'
import { SceneFallback } from './components/SceneFallback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Hotspots } from './components/Hotspots'
import { hotspotEls } from './scene/hotspotBridge'
import { useReducedMotion } from './hooks/useMediaQuery'
import { detectWebGL, isLowPowerDevice } from './lib/device'
import { useRoute } from './lib/routes'
import type { FocusTarget } from './lib/theme'

// Сцена грузится отдельным чанком: интерфейс и навигация доступны сразу.
const Scene = lazy(() => import('./scene/Scene'))

const ORDER: Exclude<FocusTarget, null>[] = ['laptop', 'phone']

export default function App() {
  const reducedMotion = useReducedMotion()
  const { route, navigate } = useRoute()
  const webgl = useMemo(() => detectWebGL(), [])
  const lowPower = useMemo(() => isLowPowerDevice(), [])

  const [focus, setFocus] = useState<FocusTarget>(null)
  const [hovered, setHovered] = useState<FocusTarget>(null)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0)
  const [ready, setReady] = useState(false)

  const useFallback = !webgl || sceneFailed
  const isHome = route === 'home'

  // Этапы загрузки: шрифты (canvas-текстуры экранов используют их) → сцена → первый кадр
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let alive = true
    const timeout = new Promise((r) => setTimeout(r, 2500))
    Promise.race([document.fonts?.ready ?? Promise.resolve(), timeout]).then(() => {
      if (!alive) return
      setFontsReady(true)
      setStage((s) => (s < 2 ? 2 : s))
    })
    setStage(1)
    return () => {
      alive = false
    }
  }, [])

  const handleReady = useCallback(() => {
    setStage(3)
    setReady(true)
  }, [])

  // Fallback-режим не ждёт WebGL; страховка на случай зависания сцены
  useEffect(() => {
    if (useFallback && fontsReady) handleReady()
  }, [useFallback, fontsReady, handleReady])
  useEffect(() => {
    const t = setTimeout(handleReady, 10000)
    return () => clearTimeout(t)
  }, [handleReady])

  // При уходе со сцены сбрасываем фокус камеры
  useEffect(() => {
    if (!isHome) {
      setFocus(null)
      setHovered(null)
    }
  }, [isHome])

  const back = useCallback(() => setFocus(null), [])

  // После выхода из приближения возвращаем фокус клавиатуры на хотспот объекта
  const prevFocus = useRef<FocusTarget>(null)
  useEffect(() => {
    const prev = prevFocus.current
    prevFocus.current = focus
    if (prev && !focus && document.activeElement === document.body) {
      const el = hotspotEls[prev]
      // кнопка снова становится доступной после снятия is-hidden
      requestAnimationFrame(() => el?.focus({ preventScroll: true }))
    }
  }, [focus])

  // Клавиатура: Esc — назад
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focus && !document.body.classList.contains('menu-open')) setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])

  // Колесо / свайп переводят между объектами сцены (вместо обычной прокрутки)
  const lock = useRef(0)
  useEffect(() => {
    if (!isHome || !ready) return
    const step = (dir: 1 | -1) => {
      const now = performance.now()
      if (now - lock.current < 1100) return
      lock.current = now
      setFocus((f) => {
        const idx = f ? ORDER.indexOf(f) : -1
        const next = idx + dir
        if (next < 0) return null
        return ORDER[Math.min(next, ORDER.length - 1)]
      })
    }
    const onWheel = (e: WheelEvent) => {
      if (document.body.classList.contains('menu-open')) return
      if (Math.abs(e.deltaY) < 24) return
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
      if (Math.abs(dy) > 60) step(dy > 0 ? 1 : -1)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isHome, ready])

  const sceneVisible = isHome

  return (
    <div className={`app${focus ? ' is-focused' : ''}${isHome ? '' : ' is-sub'}`}>
      <a href="#hero-title" className="skip-link">
        Перейти к содержимому
      </a>

      <Navbar current={route} onHome={back} />

      {isHome ? (
        <main className="stage">
          <Hero ready={ready} hidden={!!focus} reducedMotion={reducedMotion} onExplore={() => setFocus('laptop')} />
          {!useFallback && (
            <Hotspots hidden={!!focus || !ready} hovered={hovered} onSelect={setFocus} onHover={setHovered} />
          )}
          <FocusPanel focus={focus} reducedMotion={reducedMotion} onBack={back} />
          {hovered && !focus && (
            <p className="scene-hint" aria-hidden="true">
              Нажмите, чтобы приблизить
            </p>
          )}
          {focus && (
            <nav className="scene-switch" aria-label="Объекты сцены">
              {ORDER.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={focus === t ? 'is-active' : ''}
                  aria-pressed={focus === t}
                  onClick={() => setFocus(t)}
                >
                  0{i + 1}
                  <span className="sr-only">{t === 'laptop' ? ' Сайты и каталоги' : ' Мобильные решения'}</span>
                </button>
              ))}
            </nav>
          )}
        </main>
      ) : (
        <StubPage route={route} />
      )}

      {/* Сцена в DOM после интерфейса — порядок Tab: навигация → hero → объекты */}
      <div className={`scene${sceneVisible ? '' : ' is-muted'}`} aria-hidden={!sceneVisible}>
        {useFallback ? (
          <SceneFallback
            reason={webgl ? 'error' : 'unsupported'}
            onSelect={(t) => {
              if (!isHome) navigate('home')
              setFocus(t)
            }}
          />
        ) : (
          fontsReady && (
            <ErrorBoundary fallback={null} onError={() => setSceneFailed(true)}>
              <Suspense fallback={null}>
                <Scene
                  focus={isHome ? focus : null}
                  hovered={hovered}
                  onFocus={(t) => isHome && setFocus(t)}
                  onHover={setHovered}
                  reducedMotion={reducedMotion}
                  lowPower={lowPower}
                  paused={!isHome && ready}
                  onReady={handleReady}
                  onError={() => setSceneFailed(true)}
                />
              </Suspense>
            </ErrorBoundary>
          )
        )}
      </div>

      <Loader stage={stage} done={ready} />
    </div>
  )
}
