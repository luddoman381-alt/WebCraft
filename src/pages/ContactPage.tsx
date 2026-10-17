import { useId, useState, type FormEvent } from 'react'
import { catalogResource } from '../data/repository'
import { useResource } from '../data/useResource'
import { useSiteSettings } from '../data/useSiteSettings'
import { api, ApiError } from '../data/http'
import { Footer } from '../components/Footer'
import { useRouter } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

type Fields = { name: string; contact: string; service: string; message: string; consent: boolean }
type Errors = Partial<Record<keyof Fields, string>>

/** Те же правила, что и на сервере — ошибки видны до отправки. */
function validate(f: Fields): Errors {
  const e: Errors = {}
  if (f.name.trim().length < 2) e.name = 'Укажите имя'
  const c = f.contact.trim()
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || /^\+?[\d\s()-]{7,}$/.test(c) || /^@\w{4,}$/.test(c)
  if (!ok) e.contact = 'Email, телефон или @username в Telegram'
  if (f.message.trim().length < 10) e.message = 'Опишите задачу хотя бы в паре предложений'
  if (!f.consent) e.consent = 'Нужно согласие на обработку данных'
  return e
}

const telegramUrl = (t: string) => (t.startsWith('@') ? `https://t.me/${t.slice(1)}` : t.startsWith('https://') ? t : null)

export function ContactPage() {
  const { query } = useRouter()
  const catalog = useResource(catalogResource)
  const { contacts, cta } = useSiteSettings()
  useDocumentMeta(ROUTES.contact.title, ROUTES.contact.description)
  const uid = useId()

  const [fields, setFields] = useState<Fields>(() => ({
    name: '',
    contact: '',
    service: query.get('service') ?? '',
    message: '',
    consent: false,
  }))
  // поле-ловушка для ботов: скрыто от людей
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [serverError, setServerError] = useState('')

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setFields((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const focusFirst = (errs: Errors) => {
    const first = Object.keys(errs)[0]
    if (first) document.getElementById(`${uid}-${first}`)?.focus()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    const errs = validate(fields)
    setErrors(errs)
    if (Object.keys(errs).length) return focusFirst(errs)
    setState('sending')
    setServerError('')
    try {
      await api('/api/leads', {
        method: 'POST',
        body: { ...fields, service: fields.service || null, website, page: window.location.pathname + window.location.search },
      })
      setState('sent')
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      if (apiErr && Object.keys(apiErr.fields).length) {
        setErrors(apiErr.fields as Errors)
        focusFirst(apiErr.fields as Errors)
      }
      setServerError(apiErr?.message ?? 'Не удалось отправить заявку')
      setState('error')
    }
  }

  const services = catalog.data?.services ?? []
  const fieldProps = (k: keyof Fields) => ({
    id: `${uid}-${k}`,
    'aria-invalid': !!errors[k] || undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  })
  const tg = contacts.telegram ? telegramUrl(contacts.telegram) : null

  return (
    <main className="page contact" id="main">
      <div className="contact__layout">
        <header className="contact__intro">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            КОНТАКТЫ
          </p>
          <h1 className="page-hero__title">{cta.contactTitle}</h1>
          <p className="page-hero__lead">{cta.contactLead}</p>
          <dl className="contact__channels">
            {contacts.email && (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
                </dd>
              </div>
            )}
            {contacts.phone && (
              <div>
                <dt>Телефон</dt>
                <dd>
                  <a href={`tel:${contacts.phone.replace(/[^\d+]/g, '')}`}>{contacts.phone}</a>
                </dd>
              </div>
            )}
            {contacts.telegram && (
              <div>
                <dt>Telegram</dt>
                <dd>{tg ? <a href={tg} target="_blank" rel="noopener noreferrer">{contacts.telegram}</a> : contacts.telegram}</dd>
              </div>
            )}
            {contacts.hours && (
              <div>
                <dt>Время работы</dt>
                <dd>{contacts.hours}</dd>
              </div>
            )}
            {contacts.address && (
              <div>
                <dt>Адрес</dt>
                <dd>{contacts.address}</dd>
              </div>
            )}
          </dl>
          {contacts.links.length > 0 && (
            <ul className="contact__links">
              {contacts.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="contact__form-wrap">
          {state === 'sent' ? (
            <div className="form-done" role="status">
              <p className="form-done__badge form-done__badge--ok">ЗАЯВКА ОТПРАВЛЕНА</p>
              <h2 className="form-done__title">Спасибо! Мы получили вашу заявку</h2>
              <p className="form-done__text">Свяжемся с вами по указанному контакту в рабочее время.</p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setFields((f) => ({ ...f, message: '' }))
                  setState('idle')
                }}
              >
                Отправить ещё одну
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit} noValidate aria-busy={state === 'sending'}>
              <div className="form__row">
                <label htmlFor={`${uid}-name`}>Имя</label>
                <input {...fieldProps('name')} value={fields.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" maxLength={100} />
                {errors.name && <p className="form__error" id={`${uid}-name-err`}>{errors.name}</p>}
              </div>
              <div className="form__row">
                <label htmlFor={`${uid}-contact`}>Как с вами связаться</label>
                <input
                  {...fieldProps('contact')}
                  value={fields.contact}
                  onChange={(e) => set('contact', e.target.value)}
                  placeholder="Email, телефон или @telegram"
                  maxLength={120}
                />
                {errors.contact && <p className="form__error" id={`${uid}-contact-err`}>{errors.contact}</p>}
              </div>
              <div className="form__row">
                <label htmlFor={`${uid}-service`}>Услуга</label>
                <div className="select select--block">
                  <select {...fieldProps('service')} value={fields.service} onChange={(e) => set('service', e.target.value)}>
                    <option value="">Не выбрана / несколько</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form__row">
                <label htmlFor={`${uid}-message`}>Задача</label>
                <textarea
                  {...fieldProps('message')}
                  rows={5}
                  value={fields.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Что нужно сделать, есть ли сроки и текущий сайт"
                  maxLength={4000}
                />
                {errors.message && <p className="form__error" id={`${uid}-message-err`}>{errors.message}</p>}
              </div>
              <div className="form__hp" aria-hidden="true">
                <label htmlFor={`${uid}-website`}>Сайт</label>
                <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="form__row form__row--check">
                <input type="checkbox" {...fieldProps('consent')} checked={fields.consent} onChange={(e) => set('consent', e.target.checked)} />
                <label htmlFor={`${uid}-consent`}>Согласен на обработку персональных данных</label>
                {errors.consent && <p className="form__error" id={`${uid}-consent-err`}>{errors.consent}</p>}
              </div>
              {state === 'error' && serverError && (
                <p className="form__alert" role="alert">
                  {serverError}
                </p>
              )}
              <button type="submit" className="btn btn--primary" disabled={state === 'sending'}>
                {state === 'sending' ? 'Отправляем…' : cta.contactSubmit} {state !== 'sending' && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </main>
  )
}
