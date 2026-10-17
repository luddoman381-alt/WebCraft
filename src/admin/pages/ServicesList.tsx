import { useMemo, useState } from 'react'
import { Link } from '../../lib/router'
import { priceLabel } from '../../components/catalog/PriceTag'
import { adminApi } from '../api'
import { Badge, errorText, LoadState, PageHead, useConfirm, useLoad, useToast } from '../ui'
import type { Service } from '../../data/types'

type StatusFilter = 'all' | 'published' | 'hidden'

export function ServicesList() {
  const list = useLoad(async () => {
    const [services, categories] = await Promise.all([adminApi.services(), adminApi.categories()])
    return { services, categories }
  })
  const toast = useToast()
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const catTitle = useMemo(() => new Map(list.data?.categories.map((c) => [c.id, c.title]) ?? []), [list.data])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list.data?.services ?? []).filter(
      (s) =>
        (!cat || s.category === cat) &&
        (status === 'all' || s.status === status) &&
        (!needle || s.title.toLowerCase().includes(needle) || s.slug.includes(needle) || s.shortDescription.toLowerCase().includes(needle)),
    )
  }, [list.data, q, cat, status])

  const replace = (s: Service) => list.data && list.setData({ ...list.data, services: list.data.services.map((x) => (x.id === s.id ? s : x)) })

  const toggleStatus = async (s: Service) => {
    setBusyId(s.id)
    try {
      const next = await adminApi.updateService(s.id, { ...s, status: s.status === 'published' ? 'hidden' : 'published' })
      replace(next)
      toast('ok', next.status === 'published' ? `«${s.title}» опубликована` : `«${s.title}» скрыта с сайта`)
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (s: Service) => {
    const ok = await confirm({
      title: 'Удалить услугу?',
      text: `«${s.title}» будет удалена без возможности восстановления. Чтобы временно убрать её с сайта, используйте «Скрыть».`,
      confirm: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusyId(s.id)
    try {
      await adminApi.deleteService(s.id)
      list.data && list.setData({ ...list.data, services: list.data.services.filter((x) => x.id !== s.id) })
      toast('ok', 'Услуга удалена')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    all: list.data?.services.length ?? 0,
    published: list.data?.services.filter((s) => s.status === 'published').length ?? 0,
    hidden: list.data?.services.filter((s) => s.status === 'hidden').length ?? 0,
  }

  return (
    <>
      <PageHead
        title="Услуги"
        sub="Каталог на сайте: порядок, публикация, содержание карточек"
        actions={
          <Link to="/admin/services/new" className="a-btn a-btn--primary">
            + Новая услуга
          </Link>
        }
      />
      <LoadState state={list}>
        <div className="a-toolbar">
          <input className="a-input a-input--search" type="search" placeholder="Поиск по названию, адресу, описанию" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск услуг" />
          <select className="a-input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Категория">
            <option value="">Все категории</option>
            {list.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.hidden ? ' (скрыта)' : ''}
              </option>
            ))}
          </select>
          <div className="a-tabs" role="group" aria-label="Статус">
            {(['all', 'published', 'hidden'] as const).map((s) => (
              <button key={s} type="button" className={status === s ? 'is-active' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === 'all' ? 'Все' : s === 'published' ? 'На сайте' : 'Скрытые'} <span>{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="a-state">
            <p>{list.data?.services.length ? 'Ничего не найдено по условиям фильтра' : 'Услуг пока нет'}</p>
          </div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Услуга</th>
                  <th scope="col">Категория</th>
                  <th scope="col">Цена</th>
                  <th scope="col">Статус</th>
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} aria-busy={busyId === s.id}>
                    <td className="a-table__num">{s.order}</td>
                    <td>
                      <Link to={`/admin/services/${encodeURIComponent(s.id)}`} className="a-table__title">
                        {s.title}
                      </Link>
                      <span className="a-table__sub">/services/{s.slug}</span>
                    </td>
                    <td>{catTitle.get(s.category) ?? s.category}</td>
                    <td className="a-table__price">{priceLabel(s.pricing)}</td>
                    <td>
                      {s.status === 'published' ? <Badge tone="green">На сайте</Badge> : <Badge tone="muted">Скрыта</Badge>}
                      {s.demo && <Badge tone="amber">Демо</Badge>}
                    </td>
                    <td className="a-table__actions">
                      <button type="button" className="a-btn a-btn--sm" onClick={() => toggleStatus(s)} disabled={busyId === s.id}>
                        {s.status === 'published' ? 'Скрыть' : 'Опубликовать'}
                      </button>
                      <Link to={`/admin/services/${encodeURIComponent(s.id)}`} className="a-btn a-btn--sm a-btn--ghost">
                        Изменить
                      </Link>
                      <button type="button" className="a-icon-btn a-icon-btn--danger" onClick={() => remove(s)} disabled={busyId === s.id} aria-label={`Удалить «${s.title}»`}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LoadState>
    </>
  )
}
