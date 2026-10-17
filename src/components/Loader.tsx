import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'

/**
 * Загрузочный экран. Прогресс условный (сцена процедурная и не тянет
 * тяжёлых ассетов), но привязан к реальным событиям: шрифты → сцена → первый кадр.
 */
export function Loader({ stage, done }: { stage: 0 | 1 | 2 | 3; done: boolean }) {
  // смонтирован уже после загрузки (возврат на главную) — не показываем вовсе
  const [gone, setGone] = useState(done)
  const target = [12, 48, 82, 100][stage]
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (gone) return
    let raf = 0
    let v = 0
    const tick = () => {
      setShown((prev) => {
        const next = prev + (target - prev) * 0.12
        v = Math.abs(target - next) < 0.5 ? target : next
        return v
      })
      // цикл останавливается, когда полоса дошла до текущего этапа
      if (v !== target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, gone])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 900)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null
  const pct = done ? 100 : shown

  const labels = ['Инициализация', 'Загрузка шрифтов', 'Сборка сцены', 'Готово']

  return (
    <div className={`loader${done ? ' is-done' : ''}`} role="status" aria-live="polite" aria-busy={!done}>
      <div className="loader__inner">
        <span className="loader__mark">
          <LogoMark size={40} />
        </span>
        <div className="loader__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="loader__meta">
          <span>{labels[stage]}</span>
          <span>{String(Math.round(pct)).padStart(3, '0')}%</span>
        </div>
      </div>
    </div>
  )
}
