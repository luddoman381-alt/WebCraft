import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { Link } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useSiteSettings } from '../data/useSiteSettings'

type Props = {
  ready: boolean
  hidden: boolean
  reducedMotion: boolean
  onExplore: () => void
}

export function Hero({ ready, hidden, reducedMotion, onExplore }: Props) {
  const root = useRef<HTMLElement>(null)
  const { cta } = useSiteSettings()

  // Вход: построчное появление после загрузки сцены
  useLayoutEffect(() => {
    if (!ready || !root.current) return
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set('[data-reveal]', { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(
        '[data-reveal]',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, delay: 0.15, clearProps: 'transform' },
      )
    }, root)
    return () => ctx.revert()
  }, [ready, reducedMotion])

  return (
    <section ref={root} className={`hero${hidden ? ' is-hidden' : ''}`} aria-labelledby="hero-title" aria-hidden={hidden}>
      <div className="hero__inner">
        <p className="hero__eyebrow" data-reveal>
          <span className="hero__pulse" aria-hidden="true" />
          WEBCRAFT STUDIO <span className="hero__sep">/</span> 2026
        </p>

        <h1 id="hero-title" className="hero__title" data-reveal>
          Создаём цифровые продукты <span className="hero__accent">нового&nbsp;уровня</span>
        </h1>

        <p className="hero__lead" data-reveal>
          Сайты, каталоги и автоматизация для бизнеса.
        </p>

        <div className="hero__actions" data-reveal>
          <Link to={ROUTES.services.pattern} className="btn btn--primary" tabIndex={hidden ? -1 : 0}>
            {cta.heroPrimary}
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to={ROUTES.projects.pattern} className="btn btn--ghost" tabIndex={hidden ? -1 : 0}>
            {cta.heroSecondary}
          </Link>
        </div>

        <dl className="hero__specs" data-reveal>
          <div>
            <dt>Скорость</dt>
            <dd>
              100<span>/100</span>
            </dd>
          </div>
          <div>
            <dt>Запуск</dt>
            <dd>
              от 3<span> нед.</span>
            </dd>
          </div>
          <div>
            <dt>Интеграции</dt>
            <dd>
              CRM<span> · 1С · API</span>
            </dd>
          </div>
        </dl>
      </div>

      <button type="button" className="hero__scroll" onClick={onExplore} tabIndex={hidden ? -1 : 0} aria-label="Перейти в каталог услуг">
        <span className="hero__scroll-track" aria-hidden="true">
          <span className="hero__scroll-thumb" />
        </span>
        <span className="hero__scroll-label">SCROLL</span>
      </button>

      <div className="hero__meta" aria-hidden="true">
        <span>SCENE 01 · 2 OBJECTS · REALTIME</span>
        <span className="hero__meta-line" />
        <span>BUILD 1.0.0 · STAGE 01</span>
      </div>
    </section>
  )
}
