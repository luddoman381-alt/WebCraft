import { useEffect, useRef } from 'react'
import { DURATION, REDUCED, RealmFx, SWAP_AT, type Dir } from './realmFx'

type Props = {
  dir: Dir
  origin: { x: number; y: number }
  reducedMotion: boolean
  lowPower: boolean
  /** сменить страницу — вызывается один раз, под непрозрачной пеленой */
  onSwap: () => void
  onDone: () => void
}

/**
 * Полноэкранный слой перехода между режимами. Живёт только во время перехода
 * (≈2 с) — постоянной нагрузки нет. При prefers-reduced-motion — короткая смена через затемнение.
 */
export function RealmTransition({ dir, origin, reducedMotion, lowPower, onSwap, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const cb = useRef({ onSwap, onDone })
  cb.current = { onSwap, onDone }

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const total = reducedMotion ? REDUCED.total : DURATION[dir]
    const swapAt = reducedMotion ? REDUCED.swap : SWAP_AT[dir]
    const fx = reducedMotion ? null : new RealmFx(el, dir, origin, { lowPower })
    const ctx = el.getContext('2d')!
    if (reducedMotion) {
      el.width = window.innerWidth
      el.height = window.innerHeight
    }
    let swapped = false
    let raf = 0
    const start = performance.now()
    const onResize = () => fx?.resize()
    window.addEventListener('resize', onResize)

    const tick = (now: number) => {
      const t = now - start
      if (!swapped && t >= swapAt) {
        swapped = true
        cb.current.onSwap()
      }
      if (fx) {
        // цель логотипа — заголовок новой страницы, как только он появился в DOM
        if (swapped && dir === 'toUB' && t > swapAt + 60) {
          const target = document.querySelector('.ub-hero__brand')
          if (target || t > swapAt + 400) fx.setLogoTarget(target)
        }
        fx.frame(t)
      } else {
        // упрощённый режим: только затемнение в цвет новой среды
        const a = t < swapAt ? t / swapAt : Math.max(0, 1 - (t - swapAt) / (total - swapAt))
        ctx.clearRect(0, 0, el.width, el.height)
        ctx.fillStyle = dir === 'toUB' ? `rgba(3,6,14,${a})` : `rgba(8,11,10,${a})`
        ctx.fillRect(0, 0, el.width, el.height)
      }
      if (t >= total) {
        cb.current.onDone()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // страховка: вкладка ушла в фон и кадры не идут — всё равно завершаем переход
    const guard = window.setTimeout(() => {
      if (!swapped) {
        swapped = true
        cb.current.onSwap()
      }
      cb.current.onDone()
    }, total + 1500)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(guard)
      window.removeEventListener('resize', onResize)
    }
    // переход запускается один раз на монтирование
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvas} className="realm-fx" aria-hidden="true" />
}
