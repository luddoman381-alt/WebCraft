import { useState } from 'react'
import type { ServiceCategory } from '../../data/types'
import { adminApi, slugify, type CategoryWithCount } from '../api'
import {
  Badge,
  Drawer,
  errorText,
  fieldErrors,
  ImageField,
  LoadState,
  PageHead,
  Switch,
  TextField,
  useConfirm,
  useLoad,
  useToast,
} from '../ui'

const empty: ServiceCategory = { id: '', title: '', summary: '', description: '', image: null, order: 100, hidden: false }

export function CategoriesPage() {
  const list = useLoad(adminApi.categories)
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<{ original: string | null; value: ServiceCategory } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const open = (c: ServiceCategory | null) => {
    setErrors({})
    setEditing({ original: c?.id ?? null, value: c ? { ...c } : { ...empty } })
  }

  const save = async () => {
    if (!editing || saving) return
    setSaving(true)
    setErrors({})
    try {
      if (editing.original) await adminApi.updateCategory(editing.original, editing.value)
      else await adminApi.createCategory(editing.value)
      toast('ok', editing.original ? 'Категория сохранена' : 'Категория создана')
      setEditing(null)
      list.reload()
    } catch (e) {
      setErrors(fieldErrors(e))
      toast('error', errorText(e))
    } finally {
      setSaving(false)
    }
  }

  const toggleHidden = async (c: CategoryWithCount) => {
    try {
      await adminApi.updateCategory(c.id, { ...c, hidden: !c.hidden })
      toast('ok', c.hidden ? `«${c.title}» снова на сайте` : `«${c.title}» скрыта вместе с её услугами`)
      list.reload()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const remove = async (c: CategoryWithCount) => {
    if (c.services > 0) {
      toast('error', 'В категории есть услуги — перенесите их или скройте категорию')
      return
    }
    const ok = await confirm({ title: 'Удалить категорию?', text: `«${c.title}» будет удалена.`, confirm: 'Удалить', danger: true })
    if (!ok) return
    try {
      await adminApi.deleteCategory(c.id)
      toast('ok', 'Категория удалена')
      list.reload()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const v = editing?.value
  const set = <K extends keyof ServiceCategory>(k: K, val: ServiceCategory[K]) => setEditing((e) => e && { ...e, value: { ...e.value, [k]: val } })

  return (
    <>
      <PageHead
        title="Категории"
        sub="Направления каталога. Скрытая категория убирает с сайта и все свои услуги."
        actions={
          <button type="button" className="a-btn a-btn--primary" onClick={() => open(null)}>
            + Новая категория
          </button>
        }
      />
      <LoadState state={list}>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">Категория</th>
                <th scope="col">Услуг</th>
                <th scope="col">Статус</th>
                <th scope="col">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td className="a-table__num">{c.order}</td>
                  <td>
                    <button type="button" className="a-table__title a-linklike" onClick={() => open(c)}>
                      {c.title}
                    </button>
                    <span className="a-table__sub">?category={c.id}</span>
                  </td>
                  <td>{c.services}</td>
                  <td>{c.hidden ? <Badge tone="muted">Скрыта</Badge> : <Badge tone="green">На сайте</Badge>}</td>
                  <td className="a-table__actions">
                    <button type="button" className="a-btn a-btn--sm" onClick={() => toggleHidden(c)}>
                      {c.hidden ? 'Восстановить' : 'Скрыть'}
                    </button>
                    <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={() => open(c)}>
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn a-icon-btn--danger"
                      onClick={() => remove(c)}
                      aria-label={`Удалить «${c.title}»`}
                      title={c.services ? 'Сначала перенесите услуги' : 'Удалить'}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LoadState>

      <Drawer open={!!editing} title={editing?.original ? 'Категория' : 'Новая категория'} onClose={() => setEditing(null)}>
        {v && (
          <form
            className="a-form"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <TextField
              label="Название"
              required
              value={v.title}
              max={80}
              error={errors.title}
              onChange={(t) => {
                set('title', t)
                if (!editing?.original) set('id', slugify(t))
              }}
            />
            <TextField label="ID (для адреса ?category=)" required mono value={v.id} error={errors.id} hint="Латиница, цифры, дефис. При изменении ссылки на фильтр изменятся." onChange={(t) => set('id', t.toLowerCase())} />
            <TextField label="Короткая подпись" value={v.summary} max={120} error={errors.summary} hint="Показывается на плитке в каталоге" onChange={(t) => set('summary', t)} />
            <TextField label="Описание" multiline rows={3} value={v.description} max={1000} error={errors.description} onChange={(t) => set('description', t)} />
            <ImageField label="Изображение" value={v.image ?? ''} error={errors.image} onChange={(src) => set('image', src || null)} />
            <TextField label="Порядок" type="number" value={String(v.order)} error={errors.order} onChange={(t) => set('order', Number(t) || 0)} />
            <Switch label="Скрыть с сайта" checked={v.hidden} onChange={(h) => set('hidden', h)} hint="Услуги категории тоже перестанут отображаться" />
            <div className="a-form__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setEditing(null)}>
                Отмена
              </button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}
      </Drawer>
    </>
  )
}
