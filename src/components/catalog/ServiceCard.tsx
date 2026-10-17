import { useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react'
import type { Service, ServiceCategory } from '../../data/types'
import { Link } from '../../lib/router'
import { pathFor } from '../../lib/routes'
import { useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery'
import { ServiceCover } from './ServiceCover'
import { PriceTag } from './PriceTag'
import { TerminalLayer, terminalLines } from './TerminalLayer'

/**
 * Последний ввод — клавиатура? Фокус карточки включает терминал только при навигации
 * с клавиатуры: после тапа/клика фокус не должен удерживать эффект открытым.
 */
let keyboardModality = false
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (keyboardModality = true), true)
  window.addEventListener('pointerdown', () => (keyboardModality = false), true)
}

type Props = {
  service: Service
  category?: ServiceCategory | null
  index?: number
  animate?: boolean
  /** терминальный эффект: наведение / фокус, на сенсорных экранах — по кнопке */
  terminal?: boolean
  /** принудительно показать терминал (предпросмотр в админке) */
  forceTerminal?: boolean
  /** ссылка неактивна (предпросмотр) */
  inertLink?: boolean
}

export function ServiceCard({ service, category, index = 0, animate = false, terminal = false, forceTerminal, inertLink }: Props) {
  const reducedMotion = useReducedMotion()
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tapped, setTapped] = useState(false)
  const active = terminal && (forceTerminal ?? (hover || focused || tapped))
  const termId = `term-${service.id}`
  const href = pathFor('service', { slug: service.slug })

  const onPointerEnter = (e: PointerEvent) => e.pointerType !== 'touch' && setHover(true)
  const onPointerLeave = (e: PointerEvent) => e.pointerType !== 'touch' && setHover(false)
  // клавиатура: эффект, пока фокус внутри карточки
  const onFocus = () => keyboardModality && setFocused(true)
  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
  }

  return (
    <article
      className={`card${animate ? ' card--animate' : ''}${terminal ? ' card--terminal' : ''}${active ? ' is-terminal' : ''}`}
      style={{ '--i': index } as CSSProperties}
      aria-labelledby={`card-${service.id}`}
      // наведение — только на устройствах с мышью; на сенсорных экранах — кнопка «Характеристики»
      onPointerEnter={terminal && canHover ? onPointerEnter : undefined}
      onPointerLeave={terminal && canHover ? onPointerLeave : undefined}
      onFocus={terminal ? onFocus : undefined}
      onBlur={terminal ? onBlur : undefined}
    >
      <ServiceCover cover={service.cover} />
      <div className="card__body">
        <p className="card__meta">
          <span className="card__index">{String(service.order).padStart(2, '0')}</span>
          {category?.title}
        </p>
        <h3 className="card__title" id={`card-${service.id}`}>
          {/* растянутая ссылка: вся карточка кликабельна, в дереве доступности — одна ссылка */}
          {inertLink ? (
            <span className="card__link">{service.title}</span>
          ) : (
            <Link to={href} className="card__link">
              {service.title}
            </Link>
          )}
        </h3>
        <p className="card__text">{service.shortDescription}</p>
        <ul className="card__features" aria-label="Возможности">
          {service.features.slice(0, 3).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <div className="card__foot">
          <PriceTag pricing={service.pricing} />
          {terminal && !canHover && !forceTerminal ? (
            <button
              type="button"
              className="card__info"
              aria-expanded={tapped}
              aria-controls={termId}
              onClick={() => setTapped((v) => !v)}
            >
              {tapped ? 'Скрыть' : 'Характеристики'}
            </button>
          ) : (
            <span className="card__arrow" aria-hidden="true">
              →
            </span>
          )}
        </div>
      </div>

      {terminal && (
        <>
          <TerminalLayer
            id={termId}
            info={service.terminal}
            title={service.title}
            pricing={service.pricing}
            active={active}
            reducedMotion={reducedMotion}
            onClose={!canHover && !forceTerminal ? () => setTapped(false) : undefined}
          />
          {/* полный текст терминала для скринридеров — без анимации */}
          <div className="sr-only">
            {terminalLines(service.terminal, service.title, service.pricing)
              .map((l) => l.text)
              .join('. ')}
          </div>
        </>
      )}
    </article>
  )
}

export function ServiceCardSkeleton() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="cover cover--card skeleton" />
      <div className="card__body">
        <span className="skeleton skeleton--line" style={{ width: '38%' }} />
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line" style={{ width: '72%' }} />
      </div>
    </div>
  )
}
