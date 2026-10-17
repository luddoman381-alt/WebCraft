import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import gsap from 'gsap'

/*
 * Состояние презентации «О студии». Числовые каналы анимирует GSAP,
 * 3D-сцена читает их каждый кадр без ре-рендеров React.
 */

export type AboutPhase = 'idle' | 'assembling' | 'opening' | 'splash' | 'terminal' | 'closing' | 'disassembling'

export const about = {
  phase: 'idle' as AboutPhase,
  /** свечение кнопки / полос */
  glow: 0,
  hover: 0,
  /** 0 — полосы образуют кнопку, 1 — силуэт ноутбука */
  morph: 0,
  /** проявление цельного корпуса */
  solid: 0,
  /** 0 — поза сборки (наклон к зрителю), 1 — рабочая поза */
  pose: 0,
  /** 0 — крышка закрыта, 1 — открыта */
  lid: 0,
  /** 0 — общий план, 1 — камера у экрана */
  cam: 0,
  /** подсветка экрана */
  power: 0,
  /** время внутри заставки/терминала, мс (ведёт сцена) */
  clock: 0,
}

const listeners = new Set<() => void>()
function setPhase(p: AboutPhase) {
  if (about.phase === p) return
  about.phase = p
  listeners.forEach((l) => l())
}

export function useAboutPhase() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => about.phase,
  )
}

function resetChannels() {
  Object.assign(about, { glow: 0, morph: 0, solid: 0, pose: 0, lid: 0, cam: 0, power: 0, clock: 0 })
}

/**
 * Режиссёр цикла: кнопка → сборка → открытие → заставка → терминал →
 * закрытие → разборка → кнопка. Заставка и терминал длятся столько,
 * сколько сообщает экран (сцена вызывает screenDone()).
 */
export function useAboutController(reducedMotion: boolean, onIdle: () => void) {
  const tl = useRef<gsap.core.Timeline | null>(null)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle
  const rm = reducedMotion

  const run = (build: (t: gsap.core.Timeline) => void, next: () => void) => {
    tl.current?.kill()
    const t = gsap.timeline({ onComplete: next })
    build(t)
    tl.current = t
  }

  const disassemble = useCallback(() => {
    setPhase('disassembling')
    run(
      (t) => {
        if (rm) {
          t.to(about, { solid: 0, duration: 0.35 }).set(about, { morph: 0 }).to(about, { glow: 0, duration: 0.3 })
          return
        }
        t.to(about, { glow: 0.7, duration: 0.3, ease: 'power2.out' }, 0)
          .to(about, { solid: 0, duration: 0.9, ease: 'power2.in' }, 0)
          .to(about, { morph: 0, duration: 2.5, ease: 'power2.inOut' }, 0.45)
          .to(about, { glow: 0, duration: 0.8, ease: 'power2.out' }, 2.4)
      },
      () => {
        tl.current = null
        resetChannels()
        setPhase('idle')
        onIdleRef.current()
      },
    )
  }, [rm])

  const close = useCallback(() => {
    setPhase('closing')
    run(
      (t) => {
        const k = rm ? 0.35 : 1
        t.to(about, { power: 0, duration: 0.8 * k, ease: 'power1.in' }, 0)
          .to(about, { lid: 0, duration: 1.6 * k, ease: 'power2.inOut' }, 0.6 * k)
          .to(about, { cam: 0, duration: 1.9 * k, ease: 'power2.inOut' }, 0.7 * k)
          .to(about, { pose: 0, duration: 1.6 * k, ease: 'power2.inOut' }, 0.9 * k)
      },
      disassemble,
    )
  }, [rm, disassemble])

  const terminal = useCallback(() => {
    about.clock = 0
    setPhase('terminal')
  }, [])

  const splash = useCallback(() => {
    about.clock = 0
    setPhase('splash')
    run((t) => t.to(about, { power: 1, duration: 0.25, ease: 'power1.out' }), () => {})
  }, [])

  const open = useCallback(() => {
    setPhase('opening')
    run(
      (t) => {
        const k = rm ? 0.3 : 1
        t.to(about, { cam: 1, duration: 2.0 * k, ease: 'power2.inOut' }, 0)
          .to(about, { pose: 1, duration: 1.7 * k, ease: 'power2.inOut' }, 0)
          .to(about, { lid: 1, duration: 1.8 * k, ease: 'power3.inOut' }, 0.45 * k)
      },
      splash,
    )
  }, [rm, splash])

  /** Запуск — только из исходного состояния: повторный клик ничего не делает. */
  const start = useCallback(() => {
    if (about.phase !== 'idle') return
    setPhase('assembling')
    run(
      (t) => {
        if (rm) {
          t.to(about, { glow: 1, duration: 0.2 }).set(about, { morph: 1 }).to(about, { solid: 1, duration: 0.4 }).to(about, { glow: 0, duration: 0.2 })
          return
        }
        t.to(about, { glow: 1, duration: 0.4, ease: 'power2.out' }, 0)
          .to(about, { morph: 1, duration: 2.6, ease: 'power2.inOut' }, 0.45)
          .to(about, { solid: 1, duration: 1.1, ease: 'power2.inOut' }, 2.3)
          .to(about, { glow: 0, duration: 0.7, ease: 'power1.out' }, 2.6)
      },
      open,
    )
  }, [rm, open])

  /** Экран сообщает об окончании заставки/терминала. */
  const screenDone = useCallback(() => {
    if (about.phase === 'splash') terminal()
    else if (about.phase === 'terminal') close()
  }, [terminal, close])

  /** Пропустить: из заставки или терминала — сразу к закрытию. */
  const skip = useCallback(() => {
    if (about.phase === 'splash' || about.phase === 'terminal' || about.phase === 'opening') {
      tl.current?.kill()
      about.lid = Math.max(about.lid, 0.999)
      close()
    }
  }, [close])

  // уход со страницы: остановить анимации и вернуть исходное состояние
  useEffect(
    () => () => {
      tl.current?.kill()
      tl.current = null
      resetChannels()
      about.phase = 'idle'
    },
    [],
  )

  return { start, skip, screenDone }
}
