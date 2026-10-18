import { useEffect, useRef, useState } from 'react'
import { LogoMark, UbMark } from './Logo'
import { Link } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useReducedMotion } from '../hooks/useMediaQuery'
import type { Realm } from '../realm/realmBus'

const BRAND: Record<Realm, { name: string; tagline: string; label: string }> = {
  wc: { name: 'WEBCRAFT', tagline: 'Сайты и автоматизация', label: 'WebCraft — на главную' },
  ub: { name: 'UPBUSINESS', tagline: 'Технологии для роста бизнеса', label: 'UpBusiness — на главную раздела' },
}
const GLYPHS = '01<>/{}[]#$%&*+=ABCDEFX'

/**
 * Текст, «перешифровывающийся» в новый: символы сначала бегут случайными
 * глифами, затем слева направо встают на место. Без движения — сразу итог.
 */
function useDecode(target: string, reduced: boolean, duration: number) {
  const [text, setText] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    if (prev.current === target) return
    const from = prev.current
    prev.current = target
    if (reduced) {
      setText(target)
      return
    }
    const len = Math.max(from.length, target.length)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      let out = ''
      for (let i = 0; i < len; i++) {
        const settle = (i + 1) / len // символ i встаёт на место к этой доле времени
        if (k >= settle * 0.85 + 0.15) out += target[i] ?? ''
        else if (k < 0.12) out += from[i] ?? ''
        else if (target[i] === ' ' || (i >= target.length && k > 0.5)) out += target[i] ?? ''
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      setText(out)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, duration])
  return text
}

/** Блок бренда в левом верхнем углу: название, подпись и знак текущего направления. */
export function NavBrand({ realm, onHome, preview }: { realm: Realm; onHome?: () => void; preview?: boolean }) {
  const reduced = useReducedMotion()
  const b = BRAND[realm]
  const name = useDecode(b.name, reduced || !!preview, 620)
  const tagline = useDecode(b.tagline, reduced || !!preview, 820)
  return (
    <Link
      className={`nav__brand is-${realm}`}
      to={realm === 'ub' ? ROUTES.upbusiness.pattern : ROUTES.home.pattern}
      onClick={realm === 'wc' ? onHome : undefined}
      aria-label={b.label}
    >
      <span className="nav__mark">
        <span className="nav__mark-icon nav__mark-icon--wc">
          <LogoMark />
        </span>
        <span className="nav__mark-icon nav__mark-icon--ub">
          <UbMark />
        </span>
      </span>
      <span className="nav__brand-text" aria-hidden="true">
        {/* ширину задаёт итоговый текст — переключатель рядом не «прыгает», пока идёт расшифровка */}
        <span className="nav__name">
          <span className="nav__sizer">{b.name}</span>
          <span className="nav__live">{name}</span>
        </span>
        <span className="nav__tagline">
          <span className="nav__sizer">{b.tagline}</span>
          <span className="nav__live">{tagline}</span>
        </span>
      </span>
    </Link>
  )
}
