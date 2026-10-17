import { useEffect, useMemo, useRef, useState } from 'react'
import type { PriceDisplay, TerminalInfo } from '../../data/types'
import { priceSentence } from './PriceTag'

type Line = { kind: 'title' | 'spec' | 'cap' | 'price'; text: string }

/** Строки терминала из данных услуги (без «системных команд» — только содержание). */
export function terminalLines(info: TerminalInfo, fallbackTitle: string, pricing: PriceDisplay): Line[] {
  return [
    { kind: 'title', text: info.title || fallbackTitle },
    ...info.specs.map((t) => ({ kind: 'spec' as const, text: t })),
    ...info.capabilities.map((t) => ({ kind: 'cap' as const, text: t })),
    { kind: 'price', text: info.priceText || `Стоимость: ${priceSentence(pricing)}` },
  ]
}

const PREFIX: Record<Line['kind'], string> = { title: '', spec: '› ', cap: '+ ', price: '» ' }

/**
 * Расписание печати: момент появления каждого символа (мс от старта).
 * Неравномерная скорость и паузы в конце строк — как живой вывод.
 */
function schedule(lines: Line[]): number[] {
  const times: number[] = []
  let t = 120
  lines.forEach((line, li) => {
    const full = PREFIX[line.kind] + line.text
    for (let i = 0; i < full.length; i++) {
      t += line.kind === 'title' ? 11 + Math.random() * 10 : 4.5 + Math.random() * 6.5
      if (full[i] === ' ' && Math.random() < 0.12) t += 40
      times.push(t)
    }
    t += li === 0 ? 150 : 55
  })
  return times
}

type Props = {
  info: TerminalInfo
  title: string
  pricing: PriceDisplay
  active: boolean
  reducedMotion: boolean
  /** для сенсорных экранов: кнопка закрытия */
  onClose?: () => void
  id?: string
}

export function TerminalLayer({ info, title, pricing, active, reducedMotion, onClose, id }: Props) {
  const lines = useMemo(() => terminalLines(info, title, pricing), [info, title, pricing])
  const total = useMemo(() => lines.reduce((n, l) => n + PREFIX[l.kind].length + l.text.length, 0), [lines])
  const [count, setCount] = useState(0)
  const raf = useRef(0)

  // Каждое включение — новый проход с нуля; выключение останавливает печать.
  // Видимый текст — всегда префикс одной строки, поэтому наложение анимаций невозможно.
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!active) return
    if (reducedMotion) {
      setCount(total)
      return
    }
    const times = schedule(lines)
    const start = performance.now()
    let shown = -1
    setCount(0)
    const tick = (now: number) => {
      const elapsed = now - start
      let n = shown < 0 ? 0 : shown
      while (n < times.length && times[n] <= elapsed) n++
      if (n !== shown) {
        shown = n
        setCount(n)
      }
      if (n < times.length) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active, reducedMotion, lines, total])

  let left = count
  const done = count >= total
  let cursorPlaced = false

  return (
    <div className={`term${active ? ' is-active' : ''}`} id={id} aria-hidden="true">
      <div className="term__screen">
        {lines.map((line, i) => {
          const full = PREFIX[line.kind] + line.text
          const visible = full.slice(0, Math.max(0, left))
          left -= full.length
          // курсор — в конце печатаемой строки, а после завершения — в последней
          const typing = !cursorPlaced && (visible.length < full.length || (done && i === lines.length - 1))
          if (typing) cursorPlaced = true
          if (!visible && !typing) return null
          return (
            <p key={i} className={`term__line term__line--${line.kind}`}>
              {visible}
              {typing && <span className="term__cursor" />}
            </p>
          )
        })}
      </div>
      {onClose && (
        <button type="button" className="term__close" onClick={onClose} tabIndex={active ? 0 : -1} aria-hidden={!active}>
          Скрыть
        </button>
      )}
    </div>
  )
}
