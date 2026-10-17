import { useMemo, useState } from 'react'
import type { SiteSettings } from '../../data/types'
import { adminApi } from '../api'
import { errorText, fieldErrors, LoadState, PageHead, SaveBar, TextField, useLoad, useToast, useUnsavedGuard, type SaveState } from '../ui'

const CTA_FIELDS: { key: keyof SiteSettings['cta']; label: string; max: number; multiline?: boolean; where: string }[] = [
  { key: 'heroPrimary', label: 'Главная: основная кнопка', max: 40, where: 'Ведёт в каталог (с анимацией погружения)' },
  { key: 'heroSecondary', label: 'Главная: вторая кнопка', max: 40, where: 'Ведёт в портфолио' },
  { key: 'navButton', label: 'Кнопка в шапке', max: 30, where: 'Ведёт на страницу контактов' },
  { key: 'catalogTitle', label: 'Каталог: заголовок призыва', max: 80, where: 'Блок под списком услуг' },
  { key: 'catalogText', label: 'Каталог: текст призыва', max: 240, multiline: true, where: 'Блок под списком услуг' },
  { key: 'catalogButton', label: 'Каталог: кнопка', max: 40, where: 'Блок под списком услуг' },
  { key: 'serviceButton', label: 'Страница услуги: кнопка', max: 40, where: 'Кнопки «Обсудить проект» на странице услуги' },
  { key: 'contactTitle', label: 'Контакты: заголовок', max: 80, where: 'Страница «Контакты»' },
  { key: 'contactLead', label: 'Контакты: подзаголовок', max: 300, multiline: true, where: 'Страница «Контакты»' },
  { key: 'contactSubmit', label: 'Контакты: кнопка отправки', max: 40, where: 'Форма заявки' },
]

export function SettingsPage() {
  const loaded = useLoad(adminApi.settings)
  return <LoadState state={loaded}>{loaded.data && <SettingsForm initial={loaded.data} />}</LoadState>
}

function SettingsForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast()
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<SaveState>('idle')
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])
  useUnsavedGuard(dirty)

  const setC = <K extends keyof SiteSettings['contacts']>(k: K, v: SiteSettings['contacts'][K]) => setForm((f) => ({ ...f, contacts: { ...f.contacts, [k]: v } }))
  const setT = (k: keyof SiteSettings['cta'], v: string) => setForm((f) => ({ ...f, cta: { ...f.cta, [k]: v } }))
  const links = form.contacts.links

  const save = async () => {
    if (state === 'saving') return
    setState('saving')
    setErrors({})
    try {
      const res = await adminApi.saveSettings(form)
      setForm(res)
      setSaved(res)
      setState('saved')
      toast('ok', 'Настройки сохранены — изменения уже на сайте')
    } catch (e) {
      setErrors(fieldErrors(e))
      setState('error')
      toast('error', errorText(e))
    }
  }

  return (
    <div className="a-editor">
      <PageHead title="Настройки сайта" sub="Контакты, ссылки и тексты кнопок. Изменения появляются на сайте сразу после сохранения." />
      <div className="a-settings">
        <section className="a-card">
          <h2 className="a-card__title">Контакты</h2>
          <div className="a-cols">
            <TextField label="Email" type="email" value={form.contacts.email} error={errors['contacts.email']} onChange={(v) => setC('email', v)} />
            <TextField label="Телефон" type="tel" value={form.contacts.phone} error={errors['contacts.phone']} placeholder="+7 700 000 00 00" onChange={(v) => setC('phone', v)} />
          </div>
          <div className="a-cols">
            <TextField label="Telegram" value={form.contacts.telegram} error={errors['contacts.telegram']} placeholder="@username" onChange={(v) => setC('telegram', v)} />
            <TextField label="Время работы" value={form.contacts.hours} error={errors['contacts.hours']} onChange={(v) => setC('hours', v)} />
          </div>
          <TextField label="Адрес" value={form.contacts.address} error={errors['contacts.address']} onChange={(v) => setC('address', v)} />
          <p className="a-field__hint">Пустые поля не показываются на странице «Контакты».</p>
        </section>

        <section className="a-card">
          <h2 className="a-card__title">Ссылки</h2>
          <p className="a-field__hint">Соцсети, мессенджеры, площадки. До 10 ссылок: https://, mailto: или tel:.</p>
          {links.map((l, i) => (
            <div className="a-cols a-cols--link" key={i}>
              <TextField label="Подпись" value={l.label} error={errors[`contacts.links.${i}.label`]} onChange={(v) => setC('links', links.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <TextField label="Адрес" value={l.url} error={errors[`contacts.links.${i}.url`]} placeholder="https://" onChange={(v) => setC('links', links.map((x, j) => (j === i ? { ...x, url: v } : x)))} />
              <button type="button" className="a-icon-btn a-icon-btn--danger" aria-label="Удалить ссылку" onClick={() => setC('links', links.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          {links.length < 10 && (
            <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setC('links', [...links, { label: '', url: '' }])}>
              + Добавить ссылку
            </button>
          )}
        </section>

        <section className="a-card">
          <h2 className="a-card__title">Тексты кнопок и призывов</h2>
          {CTA_FIELDS.map((f) => (
            <TextField key={f.key} label={f.label} required hint={f.where} multiline={f.multiline} rows={2} max={f.max} value={form.cta[f.key]} error={errors[`cta.${f.key}`]} onChange={(v) => setT(f.key, v)} />
          ))}
        </section>
      </div>
      <SaveBar dirty={dirty} state={state} onSave={save} />
    </div>
  )
}
