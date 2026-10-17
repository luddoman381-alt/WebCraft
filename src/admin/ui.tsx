import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../data/http'
import { adminApi } from './api'

/* ------------------------------------------------------------------ загрузка данных */

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void; setData: (d: T) => void }

/** Загрузка данных панели с повтором и ручным обновлением. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loadRef.current().then(
      (d) => {
        if (!alive) return
        setData(d)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
    // deps задаёт вызывающий
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])

  return { data, error, loading, reload: () => setVersion((v) => v + 1), setData }
}

export function LoadState({ state, children }: { state: Pick<Loadable<unknown>, 'data' | 'error' | 'loading' | 'reload'>; children: ReactNode }) {
  if (state.loading && !state.data) {
    return (
      <div className="a-state" role="status">
        <span className="a-spinner" aria-hidden="true" /> Загрузка…
      </div>
    )
  }
  if (state.error && !state.data) {
    return (
      <div className="a-state a-state--error" role="alert">
        <p>{state.error}</p>
        <button type="button" className="a-btn" onClick={state.reload}>
          Повторить
        </button>
      </div>
    )
  }
  return <>{children}</>
}

/* ------------------------------------------------------------------ уведомления */

type Toast = { id: number; kind: 'ok' | 'error'; text: string }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="a-toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`a-toast a-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.text}
          </p>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Неизвестная ошибка')
export const fieldErrors = (e: unknown) => (e instanceof ApiError ? e.fields : {})

/* ------------------------------------------------------------------ подтверждение */

type ConfirmOpts = { title: string; text: string; confirm: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])

  useEffect(() => {
    if (state) dialog.current?.showModal()
  }, [state])

  const close = (v: boolean) => {
    state?.resolve(v)
    dialog.current?.close()
    setState(null)
  }

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <dialog ref={dialog} className="a-dialog" onCancel={() => close(false)} aria-labelledby="a-dialog-title">
        {state && (
          <>
            <h2 id="a-dialog-title">{state.title}</h2>
            <p>{state.text}</p>
            <div className="a-dialog__actions">
              <button type="button" className="a-btn" onClick={() => close(false)} autoFocus>
                Отмена
              </button>
              <button type="button" className={`a-btn ${state.danger ? 'a-btn--danger' : 'a-btn--primary'}`} onClick={() => close(true)}>
                {state.confirm}
              </button>
            </div>
          </>
        )}
      </dialog>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)

/* ------------------------------------------------------------------ несохранённые изменения */

/** Предупреждение при уходе со страницы с несохранёнными правками (вкладка и ссылки панели). */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    // перехват кликов по внутренним ссылкам до SPA-навигации (фаза захвата)
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}

/* ------------------------------------------------------------------ поля */

type FieldProps = { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode; count?: [number, number] }

export function Field({ label, hint, error, children, count }: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className={`a-field${error ? ' has-error' : ''}`}>
      <div className="a-field__head">
        <label htmlFor={id}>{label}</label>
        {count && <span className={`a-field__count${count[0] > count[1] ? ' is-over' : ''}`}>{count[0]}/{count[1]}</span>}
      </div>
      {children(id, describedBy)}
      {hint && !error && (
        <p className="a-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="a-field__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}

type TextProps = {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
  max?: number
  multiline?: boolean
  rows?: number
  placeholder?: string
  type?: string
  required?: boolean
  mono?: boolean
}

export function TextField({ label, value, onChange, error, hint, max, multiline, rows = 3, placeholder, type = 'text', required, mono }: TextProps) {
  return (
    <Field label={required ? `${label} *` : label} hint={hint} error={error} count={max ? [value.length, max] : undefined}>
      {(id, describedBy) =>
        multiline ? (
          <textarea
            id={id}
            className={`a-input${mono ? ' a-input--mono' : ''}`}
            value={value}
            rows={rows}
            placeholder={placeholder}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id={id}
            type={type}
            className={`a-input${mono ? ' a-input--mono' : ''}`}
            value={value}
            placeholder={placeholder}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  error?: string
  hint?: string
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <select id={id} className="a-input" value={value} aria-invalid={!!error || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId()
  return (
    <div className="a-switch-row">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        className={`a-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
    </div>
  )
}

/** Редактор списка строк: добавление, удаление, перестановка. */
export function ListEditor({
  label,
  items,
  onChange,
  max,
  maxLen,
  placeholder,
  error,
  multiline,
  hint,
}: {
  label: string
  items: string[]
  onChange: (v: string[]) => void
  max: number
  maxLen: number
  placeholder?: string
  error?: string
  multiline?: boolean
  hint?: string
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)))
  // новая строка сразу получает фокус
  const box = useRef<HTMLFieldSetElement>(null)
  const focusLast = useRef(false)
  useEffect(() => {
    if (!focusLast.current) return
    focusLast.current = false
    const inputs = box.current?.querySelectorAll<HTMLElement>('.a-list__row .a-input')
    inputs?.[inputs.length - 1]?.focus()
  }, [items.length])
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <fieldset ref={box} className={`a-list${error ? ' has-error' : ''}`}>
      <legend>
        {label} <span className="a-field__count">{items.length}/{max}</span>
      </legend>
      {hint && <p className="a-field__hint">{hint}</p>}
      {items.map((item, i) => (
        <div className="a-list__row" key={i}>
          {multiline ? (
            <textarea className="a-input" rows={3} value={item} maxLength={maxLen} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} aria-label={`${label}, пункт ${i + 1}`} />
          ) : (
            <input className="a-input" value={item} maxLength={maxLen} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} aria-label={`${label}, пункт ${i + 1}`} />
          )}
          <div className="a-list__tools">
            <button type="button" className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше">
              ↑
            </button>
            <button type="button" className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Ниже">
              ↓
            </button>
            <button type="button" className="a-icon-btn a-icon-btn--danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Удалить пункт">
              ×
            </button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          className="a-btn a-btn--ghost a-btn--sm"
          onClick={() => {
            focusLast.current = true
            onChange([...items, ''])
          }}
        >
          + Добавить
        </button>
      )}
      {error && <p className="a-field__error">{error}</p>}
    </fieldset>
  )
}

/** Изображение: загрузка файла или https-ссылка. */
export function ImageField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast('error', 'Файл больше 5 МБ')
    setBusy(true)
    try {
      const { url } = await adminApi.upload(file)
      onChange(url)
      toast('ok', 'Изображение загружено')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <Field label={label} error={error} hint="PNG, JPG или WebP до 5 МБ, либо https-ссылка">
      {(id, describedBy) => (
        <div className="a-image">
          {value && <img src={value} alt="" className="a-image__preview" />}
          <div className="a-image__controls">
            <input id={id} className="a-input" value={value} placeholder="/uploads/… или https://…" aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
            <div className="a-image__buttons">
              <button type="button" className="a-btn a-btn--sm" onClick={() => input.current?.click()} disabled={busy}>
                {busy ? 'Загрузка…' : 'Загрузить файл'}
              </button>
              {value && (
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => onChange('')}>
                  Убрать
                </button>
              )}
            </div>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </div>
      )}
    </Field>
  )
}

/* ------------------------------------------------------------------ страница и сохранение */

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="a-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="a-head__actions">{actions}</div>}
    </header>
  )
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Нижняя панель сохранения: статус, Ctrl+S. */
export function SaveBar({ dirty, state, onSave, extra, label = 'Сохранить' }: { dirty: boolean; state: SaveState; onSave: () => void; extra?: ReactNode; label?: string }) {
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const status =
    state === 'saving'
      ? 'Сохранение…'
      : state === 'error'
        ? 'Не сохранено — проверьте ошибки'
        : dirty
          ? 'Есть несохранённые изменения'
          : state === 'saved'
            ? 'Все изменения сохранены'
            : 'Без изменений'
  return (
    <div className={`a-savebar a-savebar--${state}${dirty ? ' is-dirty' : ''}`}>
      <p className="a-savebar__status" role="status" aria-live="polite">
        <span className="a-savebar__dot" aria-hidden="true" />
        {status}
      </p>
      <div className="a-savebar__actions">
        {extra}
        <button type="button" className="a-btn a-btn--primary" onClick={onSave} disabled={state === 'saving'}>
          {state === 'saving' ? 'Сохранение…' : label}
          <kbd>Ctrl S</kbd>
        </button>
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'green' | 'muted' | 'amber' | 'red' | 'blue'; children: ReactNode }) {
  return <span className={`a-badge a-badge--${tone}`}>{children}</span>
}

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="a-drawer" onCancel={(e) => (e.preventDefault(), onClose())} aria-label={title}>
      <div className="a-drawer__head">
        <h2>{title}</h2>
        <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <div className="a-drawer__body">{open && children}</div>
    </dialog>
  )
}
