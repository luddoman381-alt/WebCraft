import { useId, useState, type FormEvent } from 'react'
import { catalogResource } from '../data/repository'
import { useResource } from '../data/useResource'
import { SITE_CONTACTS } from '../data/site'
import { Footer } from '../components/Footer'
import { useRouter } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

type Fields = { name: string; contact: string; service: string; message: string; consent: boolean }
type Errors = Partial<Record<keyof Fields, string>>

function validate(f: Fields): Errors {
  const e: Errors = {}
  if (f.name.trim().length < 2) e.name = 'Укажите имя'
  const c = f.contact.trim()
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)
  const looksLikePhone = /^\+?[\d\s()-]{7,}$/.test(c)
  const looksLikeTg = /^@[\w\d_]{4,}$/.test(c)
  if (!looksLikeEmail && !looksLikePhone && !looksLikeTg) e.contact = 'Email, телефон или @username в Telegram'
  if (f.message.trim().length < 10) e.message = 'Опишите задачу хотя бы в паре предложений'
  if (!f.consent) e.consent = 'Нужно согласие на обработку данных'
  return e
}

export function ContactPage() {
  const { query } = useRouter()
  const catalog = useResource(catalogResource)
  useDocumentMeta(ROUTES.contact.title, ROUTES.contact.description)
  const uid = useId()

  const [fields, setFields] = useState<Fields>(() => ({
    name: '',
    contact: '',
    service: query.get('service') ?? '',
    message: '',
    consent: false,
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setFields((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    // Backend ещё не подключён: данные не отправляются и не сохраняются
    setSubmitted(true)
  }

  const services = catalog.data?.services ?? []
  const fieldProps = (k: keyof Fields) => ({
    id: `${uid}-${k}`,
    'aria-invalid': !!errors[k] || undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  })

  return (
    <main className="page contact" id="main">
      <div className="contact__layout">
        <header className="contact__intro">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            КОНТАКТЫ
          </p>
          <h1 className="page-hero__title">
            Обсудим <span className="accent">ваш проект</span>
          </h1>
          <p className="page-hero__lead">
            Опишите задачу в свободной форме. Ответим, уточним детали и предложим, как построить работу.
          </p>
          <dl className="contact__channels">
            <div>
              <dt>Email</dt>
              <dd>{SITE_CONTACTS.email}</dd>
            </div>
            <div>
              <dt>Telegram</dt>
              <dd>{SITE_CONTACTS.telegram}</dd>
            </div>
            <div>
              <dt>Время работы</dt>
              <dd>{SITE_CONTACTS.hours}</dd>
            </div>
          </dl>
          {SITE_CONTACTS.placeholder && <p className="contact__placeholder">Контакты — временные заполнители.</p>}
        </header>

        <div className="contact__form-wrap">
          {submitted ? (
            <div className="form-done" role="status">
              <p className="form-done__badge">ДЕМО-РЕЖИМ</p>
              <h2 className="form-done__title">Заявка сформирована, но не отправлена</h2>
              <p className="form-done__text">
                Отправка заявок подключается на этапе backend. Сейчас данные формы никуда не передаются и не сохраняются.
              </p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSubmitted(false)}>
                Вернуться к форме
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit} noValidate>
              <div className="form__row">
                <label htmlFor={`${uid}-name`}>Имя</label>
                <input {...fieldProps('name')} value={fields.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
                {errors.name && <p className="form__error" id={`${uid}-name-err`}>{errors.name}</p>}
              </div>
              <div className="form__row">
                <label htmlFor={`${uid}-contact`}>Как с вами связаться</label>
                <input
                  {...fieldProps('contact')}
                  value={fields.contact}
                  onChange={(e) => set('contact', e.target.value)}
                  placeholder="Email, телефон или @telegram"
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
                />
                {errors.message && <p className="form__error" id={`${uid}-message-err`}>{errors.message}</p>}
              </div>
              <div className="form__row form__row--check">
                <input
                  type="checkbox"
                  {...fieldProps('consent')}
                  checked={fields.consent}
                  onChange={(e) => set('consent', e.target.checked)}
                />
                <label htmlFor={`${uid}-consent`}>Согласен на обработку персональных данных</label>
                {errors.consent && <p className="form__error" id={`${uid}-consent-err`}>{errors.consent}</p>}
              </div>
              <button type="submit" className="btn btn--primary">
                Отправить заявку <span aria-hidden="true">→</span>
              </button>
              <p className="form__note">Демо-режим: отправка на сервер будет подключена на следующем этапе.</p>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </main>
  )
}
