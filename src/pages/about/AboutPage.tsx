import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { detectWebGL, isLowPowerDevice } from '../../lib/device'
import { ROUTES } from '../../lib/routes'
import { about, useAboutController, useAboutPhase, type AboutPhase } from './aboutStore'
import { TRANSCRIPT } from './script'
import './about.css'

const AboutScene = lazy(() => import('./AboutScene'))

const PHASE_LABEL: Record<AboutPhase, string> = {
  idle: 'STANDBY',
  assembling: 'ASSEMBLING',
  opening: 'BOOT SEQUENCE',
  splash: 'BOOT SEQUENCE',
  terminal: 'SESSION ACTIVE',
  closing: 'SHUTDOWN',
  disassembling: 'SHUTDOWN',
}

/**
 * «О студии»: кнопка в центре превращается в 3D-ноутбук, на экране —
 * заставка WebCraft и терминал с историей студии, затем всё
 * собирается обратно в кнопку. Цикл можно повторять бесконечно.
 */
export default function AboutPage() {
  useDocumentMeta(ROUTES.about.title, 'WebCraft — студия цифровых решений: сайты, автоматизация, интеграции и ИИ для бизнеса.')
  const reducedMotion = useReducedMotion()
  const webgl = useMemo(() => detectWebGL(), [])
  const lowPower = useMemo(() => isLowPowerDevice(), [])
  const [failed, setFailed] = useState(false)
  const phase = useAboutPhase()
  const button = useRef<HTMLButtonElement>(null)
  const [buttonPx, setButtonPx] = useState({ w: 320, h: 78 })
  const [announce, setAnnounce] = useState('')

  // размер DOM-кнопки → размер светящегося контура в 3D
  useLayoutEffect(() => {
    const el = button.current
    if (!el) return
    const measure = () => setButtonPx({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onIdle = useCallback(() => {
    setAnnounce('Презентация завершена. Кнопка «Узнать, кто мы» снова доступна.')
    requestAnimationFrame(() => button.current?.focus({ preventScroll: true }))
  }, [])
  const ctl = useAboutController(reducedMotion, onIdle)

  const start = () => {
    if (phase !== 'idle') return
    setAnnounce('Презентация запущена. Полный текст доступен ниже.')
    ctl.start()
  }

  // Esc — пропустить к завершению
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ctl.skip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctl])

  const use3d = webgl && !failed
  const canSkip = phase === 'opening' || phase === 'splash' || phase === 'terminal'

  return (
    <main className={`about is-${phase}`} id="main" tabIndex={-1}>
      <h1 className="sr-only">О студии WebCraft</h1>

      <div className="about__stage" aria-hidden="true">
        {use3d ? (
          <ErrorBoundary fallback={null} onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <AboutScene
                buttonPx={buttonPx}
                reducedMotion={reducedMotion}
                lowPower={lowPower}
                onScreenDone={ctl.screenDone}
                onError={() => setFailed(true)}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <div className="about__lines" />
        )}
      </div>

      <div className="about__center">
        <button
          ref={button}
          type="button"
          className={`about-cta${phase !== 'idle' ? ' is-hidden' : ''}${use3d ? '' : ' is-flat'}`}
          onClick={use3d ? start : () => setAnnounce('')}
          onPointerEnter={() => (about.hover = 1)}
          onPointerLeave={() => (about.hover = 0)}
          onFocus={() => (about.hover = 1)}
          onBlur={() => (about.hover = 0)}
          tabIndex={phase === 'idle' ? 0 : -1}
          aria-hidden={phase !== 'idle'}
          aria-describedby="about-transcript"
        >
          <span className="about-cta__label">УЗНАТЬ, КТО МЫ</span>
        </button>
      </div>

      {/* без WebGL — тот же текст в терминальной панели, без 3D */}
      {!use3d && (
        <section className="about__flat" aria-label="О студии">
          {TRANSCRIPT.map((l, i) => (
            <p key={i} className={`about__flat-line is-${l.kind}`}>
              {l.text}
            </p>
          ))}
        </section>
      )}

      {canSkip && (
        <button type="button" className="about__skip" onClick={ctl.skip}>
          Пропустить <kbd>Esc</kbd>
        </button>
      )}

      <p className="about__status" aria-hidden="true">
        <span className="about__status-dot" />
        WEBCRAFT / ABOUT · {PHASE_LABEL[phase]}
      </p>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {/* полный текст презентации для скринридеров — без ожидания анимации */}
      <section id="about-transcript" className="sr-only" aria-label="Текст презентации">
        {TRANSCRIPT.map((l, i) => (
          <p key={i}>{l.text.replace(/^> /, '')}</p>
        ))}
      </section>
    </main>
  )
}
