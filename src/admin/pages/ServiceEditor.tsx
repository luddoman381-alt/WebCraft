import { useMemo, useState } from 'react'
import { Link, useRouter, withBase } from '../../lib/router'
import { ServiceCard } from '../../components/catalog/ServiceCard'
import { priceLabel, priceSentence } from '../../components/catalog/PriceTag'
import { EMPTY_TERMINAL } from '../../data/defaults'
import type { CoverPattern, Currency, Service } from '../../data/types'
import { adminApi, slugify } from '../api'
import {
  Badge,
  errorText,
  fieldErrors,
  ImageField,
  ListEditor,
  LoadState,
  PageHead,
  SaveBar,
  SelectField,
  Switch,
  TextField,
  useConfirm,
  useLoad,
  useToast,
  useUnsavedGuard,
  type SaveState,
} from '../ui'

const PATTERNS: { value: CoverPattern; label: string }[] = [
  { value: 'grid', label: 'Сетка' },
  { value: 'spark', label: 'Вспышка' },
  { value: 'stack', label: 'Слои' },
  { value: 'bars', label: 'График' },
  { value: 'flow', label: 'Поток' },
  { value: 'nodes', label: 'Узлы' },
  { value: 'orbit', label: 'Орбита' },
  { value: 'chat', label: 'Диалог' },
]

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'KZT', label: '₸ тенге' },
  { value: 'RUB', label: '₽ рубли' },
  { value: 'USD', label: '$ доллары' },
  { value: 'EUR', label: '€ евро' },
]

const blank = (categoryId: string): Service => ({
  id: '',
  slug: '',
  title: '',
  category: categoryId,
  shortDescription: '',
  fullDescription: [''],
  features: [],
  benefits: [],
  deliverables: [],
  cover: { pattern: 'grid' },
  related: [],
  pricing: { price: { kind: 'individual' }, visible: true },
  terminal: { ...EMPTY_TERMINAL },
  status: 'hidden',
  seo: { title: '', description: '' },
  order: 100,
  demo: false,
})

export function ServiceEditor({ id }: { id: string | null }) {
  const { navigateDirect } = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const loaded = useLoad(async () => {
    const [categories, services] = await Promise.all([adminApi.categories(), adminApi.services()])
    const service = id ? await adminApi.service(id) : blank(categories[0]?.id ?? '')
    return { categories, services, service }
  }, [id])

  return (
    <LoadState state={loaded}>
      {loaded.data && <Editor key={loaded.data.service.id || 'new'} {...loaded.data} isNew={!id} onSaved={(s) => {
        toast('ok', id ? 'Изменения сохранены' : 'Услуга создана')
        if (!id) navigateDirect(`/admin/services/${encodeURIComponent(s.id)}`, { replace: true })
      }} onDeleted={() => navigateDirect('/admin/services')} toast={toast} confirm={confirm} />}
    </LoadState>
  )
}

type EditorProps = {
  categories: Awaited<ReturnType<typeof adminApi.categories>>
  services: Service[]
  service: Service
  isNew: boolean
  onSaved: (s: Service) => void
  onDeleted: () => void
  toast: ReturnType<typeof useToast>
  confirm: ReturnType<typeof useConfirm>
}

function Editor({ categories, services, service, isNew, onSaved, onDeleted, toast, confirm }: EditorProps) {
  const [form, setForm] = useState<Service>(service)
  const [saved, setSaved] = useState<Service>(service)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<SaveState>('idle')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [preview, setPreview] = useState<'card' | 'terminal'>('card')

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])
  useUnsavedGuard(dirty)

  const set = <K extends keyof Service>(key: K, value: Service[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // исправленное поле больше не подсвечивается ошибкой
    setErrors((e) => {
      const keys = Object.keys(e).filter((k) => k === key || k.startsWith(`${String(key)}.`))
      if (!keys.length) return e
      const next = { ...e }
      keys.forEach((k) => delete next[k])
      return next
    })
    if (state === 'saved' || state === 'error') setState('idle')
  }
  const err = (path: string) => errors[path]

  const save = async () => {
    if (state === 'saving') return
    setState('saving')
    setErrors({})
    try {
      const res = isNew ? await adminApi.createService(form) : await adminApi.updateService(form.id, form)
      setForm(res)
      setSaved(res)
      setState('saved')
      onSaved(res)
    } catch (e) {
      setErrors(fieldErrors(e))
      setState('error')
      toast('error', errorText(e))
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Удалить услугу?', text: `«${saved.title}» будет удалена без возможности восстановления.`, confirm: 'Удалить', danger: true })
    if (!ok) return
    try {
      await adminApi.deleteService(saved.id)
      setSaved(form) // снимаем предупреждение о несохранённых правках
      toast('ok', 'Услуга удалена')
      onDeleted()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  /** Терминал из уже заполненных полей — стартовая точка для редактирования. */
  const fillTerminal = () =>
    set('terminal', {
      title: form.title,
      specs: form.features.slice(0, 3),
      capabilities: (form.benefits.length ? form.benefits : form.deliverables).slice(0, 3),
      priceText: `Стоимость: ${priceSentence(form.pricing)}`,
    })

  const price = form.pricing.price
  const amount = price.kind === 'individual' ? '' : String(price.amount)
  const currency: Currency = price.kind === 'individual' ? 'KZT' : price.currency
  const setPrice = (kind: 'individual' | 'fixed' | 'from', amt = amount, cur = currency) =>
    set('pricing', {
      ...form.pricing,
      price: kind === 'individual' ? { kind } : { kind, amount: Number(amt.replace(/\s/g, '')) || 0, currency: cur },
    })

  const category = categories.find((c) => c.id === form.category) ?? null
  const others = services.filter((s) => s.id !== form.id)
  const publicUrl = withBase(`/services/${saved.slug}`)

  return (
    <div className="a-editor">
      <PageHead
        title={isNew ? 'Новая услуга' : form.title || 'Без названия'}
        sub={isNew ? 'Заполните основные поля и сохраните. Публикация — переключателем «На сайте».' : `ID ${form.id}`}
        actions={
          <>
            {saved.status === 'published' && !isNew && (
              <a href={publicUrl} target="_blank" rel="noopener" className="a-btn a-btn--ghost">
                На сайте ↗
              </a>
            )}
            <Link to="/admin/services" className="a-btn a-btn--ghost">
              ← К списку
            </Link>
          </>
        }
      />

      <div className="a-editor__grid">
        <div className="a-editor__form">
          <section className="a-card">
            <h2 className="a-card__title">Основное</h2>
            <TextField
              label="Название"
              required
              value={form.title}
              max={120}
              error={err('title')}
              onChange={(v) => {
                set('title', v)
                if (!slugTouched) set('slug', slugify(v))
              }}
            />
            <div className="a-cols">
              <TextField
                label="URL-адрес (slug)"
                required
                mono
                value={form.slug}
                error={err('slug')}
                hint={`/services/${form.slug || '…'}`}
                onChange={(v) => {
                  setSlugTouched(true)
                  set('slug', v.toLowerCase())
                }}
              />
              <SelectField
                label="Категория"
                value={form.category}
                error={err('category')}
                onChange={(v) => set('category', v)}
                options={categories.map((c) => ({ value: c.id, label: c.title + (c.hidden ? ' (скрыта)' : '') }))}
                hint={category?.hidden ? 'Категория скрыта — услуга не появится на сайте' : undefined}
              />
            </div>
            <div className="a-cols">
              <TextField label="Порядок в каталоге" type="number" value={String(form.order)} error={err('order')} hint="Меньше — выше" onChange={(v) => set('order', Number(v) || 0)} />
              <Switch
                label={form.status === 'published' ? 'На сайте' : 'Скрыта'}
                hint="Опубликованная услуга видна в каталоге после сохранения"
                checked={form.status === 'published'}
                onChange={(v) => set('status', v ? 'published' : 'hidden')}
              />
            </div>
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Описание</h2>
            <TextField label="Краткое описание" required multiline rows={2} max={300} value={form.shortDescription} error={err('shortDescription')} hint="Показывается в карточке каталога" onChange={(v) => set('shortDescription', v)} />
            <ListEditor label="Полное описание — абзацы" multiline items={form.fullDescription} max={12} maxLen={2000} error={err('fullDescription')} onChange={(v) => set('fullDescription', v)} />
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Содержание</h2>
            <ListEditor label="Возможности и характеристики" hint="Первые три — на карточке каталога" items={form.features} max={12} maxLen={120} error={err('features')} onChange={(v) => set('features', v)} />
            <ListEditor label="Преимущества" items={form.benefits} max={12} maxLen={160} error={err('benefits')} onChange={(v) => set('benefits', v)} />
            <ListEditor label="Состав работ" items={form.deliverables} max={12} maxLen={160} error={err('deliverables')} onChange={(v) => set('deliverables', v)} />
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Стоимость</h2>
            <div className="a-radios" role="radiogroup" aria-label="Вариант цены">
              {(
                [
                  ['individual', 'Рассчитывается индивидуально'],
                  ['fixed', 'Фиксированная'],
                  ['from', 'От суммы'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className={`a-radio${price.kind === k ? ' is-active' : ''}`}>
                  <input type="radio" name="price-kind" checked={price.kind === k} onChange={() => setPrice(k)} />
                  {label}
                </label>
              ))}
            </div>
            {price.kind !== 'individual' && (
              <div className="a-cols">
                <TextField label="Сумма" required value={amount} error={err('pricing.amount')} onChange={(v) => setPrice(price.kind, v.replace(/[^\d\s]/g, ''))} />
                <SelectField label="Валюта" value={currency} options={CURRENCIES} onChange={(v) => setPrice(price.kind, amount, v)} />
              </div>
            )}
            {price.kind !== 'individual' && (
              <Switch
                label="Показывать сумму на сайте"
                hint="Если выключено — на сайте «Рассчитывается индивидуально»"
                checked={form.pricing.visible}
                onChange={(v) => set('pricing', { ...form.pricing, visible: v })}
              />
            )}
            <TextField label="Условия" value={form.pricing.note ?? ''} max={200} error={err('pricing.note')} placeholder="Например: зависит от объёма каталога" onChange={(v) => set('pricing', { ...form.pricing, note: v })} />
            <p className="a-field__hint">
              На сайте: <strong>{priceLabel(form.pricing)}</strong>
            </p>
          </section>

          <section className="a-card">
            <div className="a-card__head">
              <h2 className="a-card__title">Терминальный эффект</h2>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={fillTerminal}>
                Заполнить из полей услуги
              </button>
            </div>
            <p className="a-field__hint">Печатается в карточке каталога при наведении. Пустой заголовок — используется название услуги.</p>
            <TextField label="Заголовок" value={form.terminal.title} max={80} error={err('terminal.title')} onChange={(v) => set('terminal', { ...form.terminal, title: v })} />
            <ListEditor label="Строки характеристик" placeholder="Формат: одна страница" items={form.terminal.specs} max={5} maxLen={80} error={err('terminal.specs')} onChange={(v) => set('terminal', { ...form.terminal, specs: v })} />
            <ListEditor label="Возможности" items={form.terminal.capabilities} max={5} maxLen={80} error={err('terminal.capabilities')} onChange={(v) => set('terminal', { ...form.terminal, capabilities: v })} />
            <TextField label="Текст о стоимости" value={form.terminal.priceText} max={120} error={err('terminal.priceText')} placeholder={`Стоимость: ${priceSentence(form.pricing)}`} onChange={(v) => set('terminal', { ...form.terminal, priceText: v })} />
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Обложка</h2>
            <div className="a-patterns" role="radiogroup" aria-label="Паттерн обложки">
              {PATTERNS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={form.cover.pattern === p.value}
                  className={`a-chip${form.cover.pattern === p.value ? ' is-active' : ''}`}
                  onClick={() => set('cover', { ...form.cover, pattern: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <ImageField
              label="Изображение (вместо паттерна)"
              value={form.cover.image?.src ?? ''}
              error={err('cover.image')}
              onChange={(src) => set('cover', src ? { ...form.cover, image: { src, alt: form.cover.image?.alt ?? form.title } } : { pattern: form.cover.pattern })}
            />
            {form.cover.image && (
              <TextField label="Описание изображения (alt)" value={form.cover.image.alt} max={200} onChange={(alt) => set('cover', { ...form.cover, image: { src: form.cover.image!.src, alt } })} />
            )}
          </section>

          <section className="a-card">
            <h2 className="a-card__title">Связанные услуги</h2>
            <p className="a-field__hint">До 6. Если не выбраны — на странице показываются услуги той же категории.</p>
            {err('related') && <p className="a-field__error">{err('related')}</p>}
            <div className="a-checks">
              {others.map((s) => {
                const on = form.related.includes(s.id)
                return (
                  <label key={s.id} className={`a-check${on ? ' is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && form.related.length >= 6}
                      onChange={() => set('related', on ? form.related.filter((r) => r !== s.id) : [...form.related, s.id])}
                    />
                    {s.title}
                    {s.status === 'hidden' && <Badge tone="muted">скрыта</Badge>}
                  </label>
                )
              })}
            </div>
          </section>

          <section className="a-card">
            <h2 className="a-card__title">SEO</h2>
            <TextField label="SEO-заголовок" value={form.seo.title} max={120} error={err('seo.title')} hint="Оптимально до 60 символов. Пусто — название услуги" onChange={(v) => set('seo', { ...form.seo, title: v })} />
            <TextField label="SEO-описание" multiline rows={2} value={form.seo.description} max={300} error={err('seo.description')} hint="Оптимально 120–160 символов" onChange={(v) => set('seo', { ...form.seo, description: v })} />
            <div className="a-snippet" aria-label="Предпросмотр в поиске">
              <p className="a-snippet__url">webcraft · /services/{form.slug || '…'}</p>
              <p className="a-snippet__title">{form.seo.title || form.title || 'Заголовок страницы'}</p>
              <p className="a-snippet__text">{form.seo.description || form.shortDescription || 'Описание страницы'}</p>
            </div>
          </section>

          {!isNew && (
            <section className="a-card a-card--danger">
              <h2 className="a-card__title">Удаление</h2>
              <p className="a-field__hint">Удалённую услугу нельзя восстановить. Чтобы убрать её с сайта временно, выключите «На сайте».</p>
              <button type="button" className="a-btn a-btn--danger" onClick={remove}>
                Удалить услугу
              </button>
            </section>
          )}
        </div>

        <aside className="a-editor__preview" aria-label="Предпросмотр карточки">
          <div className="a-preview">
            <div className="a-preview__head">
              <span>Предпросмотр</span>
              <div className="a-tabs" role="group" aria-label="Режим предпросмотра">
                <button type="button" className={preview === 'card' ? 'is-active' : ''} aria-pressed={preview === 'card'} onClick={() => setPreview('card')}>
                  Карточка
                </button>
                <button type="button" className={preview === 'terminal' ? 'is-active' : ''} aria-pressed={preview === 'terminal'} onClick={() => setPreview('terminal')}>
                  Терминал
                </button>
              </div>
            </div>
            <div className="a-preview__stage">
              <ServiceCard
                key={preview}
                service={{ ...form, title: form.title || 'Название услуги', shortDescription: form.shortDescription || 'Краткое описание услуги' }}
                category={category}
                terminal
                forceTerminal={preview === 'terminal'}
                inertLink
              />
            </div>
            <p className="a-preview__note">
              {form.status === 'published' ? (category?.hidden ? 'Категория скрыта — на сайте не видна' : 'После сохранения появится в каталоге') : 'Скрыта — на сайте не видна'}
            </p>
          </div>
        </aside>
      </div>

      <SaveBar dirty={dirty} state={state} onSave={save} label={isNew ? 'Создать услугу' : 'Сохранить'} />
    </div>
  )
}
