import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FocusTarget } from '../lib/theme'
import { hrefFor, type RouteId } from '../lib/routes'

type Content = {
  index: string
  kicker: string
  title: string
  text: string
  points: string[]
  cta: { label: string; route: RouteId }
}

const CONTENT: Record<'laptop' | 'phone', Content> = {
  laptop: {
    index: '01',
    kicker: 'Веб-платформы',
    title: 'Сайты и каталоги',
    text: 'Корпоративные сайты, интернет-магазины и каталоги с быстрой загрузкой, продуманной структурой и удобной админ-панелью.',
    points: ['Дизайн-система и UI', 'Каталоги на тысячи позиций', 'SEO и производительность'],
    cta: { label: 'Услуги разработки', route: 'services' },
  },
  phone: {
    index: '02',
    kicker: 'Мобильный опыт',
    title: 'Мобильные решения и автоматизация',
    text: 'Интерфейсы, которые одинаково хорошо работают на смартфоне, и автоматизация процессов: заявки, CRM, уведомления, интеграции.',
    points: ['Mobile-first интерфейсы', 'Telegram-боты и уведомления', 'Интеграции с CRM и 1С'],
    cta: { label: 'Автоматизация', route: 'services' },
  },
}

type Props = {
  focus: FocusTarget
  reducedMotion: boolean
  onBack: () => void
}

export function FocusPanel({ focus, reducedMotion, onBack }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!focus || !root.current) return
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.fromTo(
        '[data-panel-reveal]',
        { opacity: 0, x: -24 },
        { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.35, clearProps: 'transform' },
      )
    }, root)
    return () => ctx.revert()
  }, [focus, reducedMotion])

  // Перевод фокуса клавиатуры на кнопку «Назад»
  useEffect(() => {
    if (focus) backRef.current?.focus({ preventScroll: true })
  }, [focus])

  if (!focus) return null
  const c = CONTENT[focus]

  return (
    <div ref={root} className="focus-panel" role="dialog" aria-modal="false" aria-labelledby="focus-title">
      <button ref={backRef} type="button" className="focus-panel__back" onClick={onBack} data-panel-reveal>
        <span aria-hidden="true">←</span> Назад к сцене
        <kbd>Esc</kbd>
      </button>
      <p className="focus-panel__kicker" data-panel-reveal>
        <span>{c.index}</span> {c.kicker}
      </p>
      <h2 id="focus-title" className="focus-panel__title" data-panel-reveal>
        {c.title}
      </h2>
      <p className="focus-panel__text" data-panel-reveal>
        {c.text}
      </p>
      <ul className="focus-panel__points" data-panel-reveal>
        {c.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="focus-panel__actions" data-panel-reveal>
        <a href={hrefFor(c.cta.route)} className="btn btn--primary btn--sm">
          {c.cta.label} <span aria-hidden="true">→</span>
        </a>
        <span className="focus-panel__demo">Демо-состояние · этап 1</span>
      </div>
    </div>
  )
}
