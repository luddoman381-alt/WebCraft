/** Проверяет поддержку WebGL (WebGL2 предпочтительно, WebGL1 как запасной вариант). */
export function detectWebGL(): boolean {
  // ?no-webgl — принудительный упрощённый режим для проверки fallback
  if (new URLSearchParams(window.location.search).has('no-webgl')) return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return !!gl
  } catch {
    return false
  }
}

/**
 * Грубая оценка «слабого» устройства: мало ядер / памяти или узкий экран с тачем.
 * На таких устройствах отключаем постобработку и тени, снижаем DPR.
 */
export function isLowPowerDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const memory = nav.deviceMemory ?? 4
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return cores <= 4 || memory <= 2 || (coarse && window.innerWidth < 768)
}
