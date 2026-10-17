import type { ApiErrorBody } from './types'

/** Ошибка запроса к API: статус, понятное сообщение и ошибки по полям формы. */
export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message || (status === 0 ? 'Нет связи с сервером' : `Ошибка ${status}`))
    this.status = status
    this.code = body.error ?? 'error'
    this.fields = body.fields ?? {}
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal; raw?: BodyInit }

/**
 * Запрос к собственному API. Заголовок X-WebCraft обязателен для изменяющих
 * запросов (защита от CSRF на сервере); cookie сессии уходит автоматически.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-WebCraft': '1', Accept: 'application/json' }
  let body: BodyInit | undefined = opts.raw
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body, credentials: 'same-origin', signal: opts.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, { message: 'Нет связи с сервером. Проверьте подключение.' })
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) throw new ApiError(res.status, (data as ApiErrorBody) ?? {})
  return data as T
}
