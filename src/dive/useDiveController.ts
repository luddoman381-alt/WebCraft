import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { dive, resetDiveChannels, screenDom, setPhase } from './diveStore'
import { ROUTES } from '../lib/routes'
import type { NavigateOptions } from '../lib/router'

type Options = {
  /** сцена готова и экран ноутбука — живой DOM */
  canDive: () => boolean
  reducedMotion: boolean
  lowPower: boolean
  navigateDirect: (to: string, opts?: NavigateOptions) => void
}

/*
 * Режиссура перехода «главная → каталог».
 *
 *  0.0s  подлёт камеры: ноутбук растёт, экран становится главным объектом
 *  1.05s внутри экрана прокручивается настоящая страница каталога
 *  2.4s  камера приближается к плоскости экрана, рамка уходит за края окна
 *  3.05s навигация и блик превью растворяются — под ними настоящая шапка
 *  3.75s экран стыкуется с окном 1:1 и расширяется до полной высоты
 *  ~4.3s URL → /services, настоящая страница на той же прокрутке
 */
const TIMINGS = {
  approach: { at: 0, dur: 1.55, ease: 'power2.inOut' },
  scroll: { at: 1.05, dur: 1.6, ease: 'power2.inOut' },
  push: { at: 2.4, dur: 1.35, ease: 'power3.inOut' },
  chrome: { at: 3.05, dur: 0.6, ease: 'power1.in' },
  expand: { at: 3.75, dur: 0.55, ease: 'power2.out' },
}
const TOTAL = TIMINGS.expand.at + TIMINGS.expand.dur

/** Прокрутка, на которой окажется каталог: панель фильтров — сразу под шапкой. */
function computeScrollTarget(): number {
  const page = screenDom.page
  if (!page) return 0
  const anchor = page.querySelector<HTMLElement>('[data-dive-anchor]')
  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76
  const target = anchor ? anchor.offsetTop - navH - 20 : 0
  const max = Math.max(0, page.scrollHeight - window.innerHeight)
  return Math.round(Math.min(Math.max(0, target), max))
}

export function useDiveController({ canDive, reducedMotion, lowPower, navigateDirect }: Options) {
  const tl = useRef<gsap.core.Timeline | null>(null)
  const watchdog = useRef<number | undefined>(undefined)
  const fadeTimer = useRef<number | undefined>(undefined)

  const clearTimers = () => {
    window.clearTimeout(watchdog.current)
    window.clearTimeout(fadeTimer.current)
  }

  const finish = useCallback(() => {
    clearTimers()
    tl.current = null
    // Фаза handoff замораживает сцену до размонтирования главной — никаких промежуточных кадров
    setPhase('handoff')
    navigateDirect(ROUTES.services.pattern, { state: { dive: true, scroll: dive.scrollPx } })
  }, [navigateDirect])

  /** Прервать без анимации (уход на другую страницу, ошибка). */
  const abort = useCallback(() => {
    clearTimers()
    tl.current?.kill()
    tl.current = null
    resetDiveChannels()
    setPhase('idle')
  }, [])

  const start = useCallback(() => {
    if (dive.phase !== 'idle') return // защита от повторных нажатий

    // Сокращённый переход: без полёта камеры
    if (reducedMotion || !canDive()) {
      setPhase('fading')
      fadeTimer.current = window.setTimeout(() => {
        setPhase('handoff')
        navigateDirect(ROUTES.services.pattern)
      }, reducedMotion ? 220 : 380)
      return
    }

    try {
      resetDiveChannels()
      dive.scrollPx = computeScrollTarget()
      setPhase('diving')

      const t = gsap.timeline({ onComplete: finish })
      const ch = (key: keyof typeof TIMINGS) =>
        t.to(dive, { [key]: 1, duration: TIMINGS[key].dur, ease: TIMINGS[key].ease }, TIMINGS[key].at)
      ch('approach')
      ch('scroll')
      ch('push')
      ch('chrome')
      // экран поднимается над canvas ровно в момент стыковки (кадры совпадают 1:1)
      t.call(() => {
        dive.onTop = true
        setPhase('docking')
      }, [], TIMINGS.expand.at)
      ch('expand')
      // слабые устройства — тот же сценарий, но короче
      if (lowPower) t.timeScale(1.45)
      tl.current = t

      // страховка: если кадры не идут (вкладка в фоне, сбой) — завершаем переход сами
      watchdog.current = window.setTimeout(
        () => {
          if (dive.phase === 'diving' || dive.phase === 'docking') {
            tl.current?.progress(1)
            if (dive.phase === 'diving' || dive.phase === 'docking') finish()
          }
        },
        (TOTAL / (lowPower ? 1.45 : 1)) * 1000 + 4000,
      )
    } catch (err) {
      console.error('[WebCraft] Переход не запустился:', err)
      abort()
      navigateDirect(ROUTES.services.pattern)
    }
  }, [abort, canDive, finish, lowPower, navigateDirect, reducedMotion])

  /** Отмена пользователем: плавный откат назад, пока экран не поднят над сценой. */
  const cancel = useCallback(() => {
    const t = tl.current
    if (dive.phase !== 'diving' || !t || dive.onTop) return false
    clearTimers()
    setPhase('cancelling')
    t.eventCallback('onReverseComplete', () => {
      tl.current = null
      resetDiveChannels()
      setPhase('idle')
    })
    t.timeScale(1.9).reverse()
    return true
  }, [])

  useEffect(() => () => abort(), [abort])

  return { start, cancel, abort }
}
