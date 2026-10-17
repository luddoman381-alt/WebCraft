import { useSyncExternalStore } from 'react'
import type { Object3D } from 'three'

/*
 * Без runtime-импорта three.js: модуль входит в основной чанк,
 * а 3D-библиотека должна грузиться только вместе со сценой.
 *
 * Общее состояние перехода «погружение в ноутбук».
 * Числовые каналы анимирует GSAP, а 3D-сцена и DOM-экран читают их
 * в одном и том же кадре useFrame — без ре-рендеров React.
 */

export type DivePhase =
  | 'idle'
  | 'diving' // камера летит, сайт прокручивается
  | 'docking' // экран состыкован с окном и расширяется — отмена уже невозможна
  | 'cancelling' // обратное воспроизведение
  | 'handoff' // URL уже /services, сцена заморожена до размонтирования
  | 'fading' // сокращённый переход (prefers-reduced-motion / fallback)

export const dive = {
  phase: 'idle' as DivePhase,
  /** 0→1 подлёт камеры к ноутбуку: экран становится главным объектом */
  approach: 0,
  /** 0→1 прокрутка сайта внутри экрана */
  scroll: 0,
  /** 0→1 приближение к плоскости экрана до размера окна */
  push: 0,
  /** 0→1 исчезновение «хрома» превью (навигация, блик стекла) перед стыковкой */
  chrome: 0,
  /** 0→1 расширение экрана до полной высоты окна */
  expand: 0,
  /** экран поверх canvas (на финальной стадии) */
  onTop: false,
  /** прокрутка (px), на которой окажется настоящая страница */
  scrollPx: 0,
  /** сцена запомнила исходную позу камеры для этого перехода */
  captured: false,
}

export function resetDiveChannels() {
  dive.approach = 0
  dive.scroll = 0
  dive.push = 0
  dive.chrome = 0
  dive.expand = 0
  dive.onTop = false
  dive.captured = false
}

/** DOM-узлы экрана ноутбука и их размер (CSS px). */
export const screenDom = {
  frame: null as HTMLDivElement | null,
  viewport: null as HTMLDivElement | null,
  page: null as HTMLDivElement | null,
  nav: null as HTMLDivElement | null,
  glass: null as HTMLDivElement | null,
  dim: null as HTMLDivElement | null,
  width: 0,
  height: 0,
}

/** Якорь в центре экрана ноутбука (локальные оси: x — вправо, y — вверх, z — нормаль). */
export const screenAnchor: { current: Object3D | null } = { current: null }

/** Размер плоскости экрана в локальных единицах ноутбука (16:10). */
export const SCREEN_SIZE = { w: 3.0, h: 3.0 / 1.6 }

/** Яркость экрана: 0 — полная, 1 — затемнён. Пишет сцена, читает проектор. */
export const screenLight = { dimTarget: 0.12, dim: 0.12 }

/* ---------------------------------------------------- подписка на фазу */

const listeners = new Set<() => void>()

export function setPhase(p: DivePhase) {
  if (dive.phase === p) return
  dive.phase = p
  listeners.forEach((l) => l())
}

export function useDivePhase(): DivePhase {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => dive.phase,
  )
}
