import { useCallback, useEffect, useState } from 'react'

type Res<T> = { status: 'pending' | 'ready' | 'error'; promise: Promise<T>; value?: T }

export type ResourceState<T> =
  | { status: 'loading'; data: null; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void }
  | { status: 'error'; data: null; retry: () => void }

/**
 * Читает закэшированный ресурс. Если данные уже загружены (например,
 * превью на экране ноутбука уже запросило каталог), первый рендер
 * сразу получает их — без кадра со скелетоном.
 */
export function useResource<T>(get: () => Res<T>, invalidateFn?: () => void): ResourceState<T> {
  const [version, setVersion] = useState(0)
  const [res, setRes] = useState(get)
  const [, force] = useState(0)

  useEffect(() => {
    let alive = true
    const r = get()
    setRes(r)
    if (r.status === 'pending') {
      r.promise.then(
        () => alive && force((n) => n + 1),
        () => alive && force((n) => n + 1),
      )
    }
    return () => {
      alive = false
    }
    // get — стабильная функция модуля; version перезапускает загрузку
  }, [get, version])

  const retry = useCallback(() => {
    invalidateFn?.()
    setVersion((v) => v + 1)
  }, [invalidateFn])

  if (res.status === 'ready') return { status: 'ready', data: res.value as T, retry }
  if (res.status === 'error') return { status: 'error', data: null, retry }
  return { status: 'loading', data: null, retry }
}
