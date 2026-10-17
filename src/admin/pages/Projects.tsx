import { useState } from 'react'
import type { CoverPattern, Project } from '../../data/types'
import { adminApi, slugify } from '../api'
import {
  Badge,
  Drawer,
  errorText,
  fieldErrors,
  ImageField,
  ListEditor,
  LoadState,
  PageHead,
  SelectField,
  Switch,
  TextField,
  useConfirm,
  useLoad,
  useToast,
} from '../ui'

const empty: Project = {
  id: '',
  slug: '',
  title: '',
  summary: '',
  services: [],
  tags: [],
  cover: { pattern: 'grid' },
  status: 'hidden',
  kind: 'case',
  url: null,
  order: 100,
}

const PATTERNS: CoverPattern[] = ['grid', 'spark', 'stack', 'bars', 'flow', 'nodes', 'orbit', 'chat']

export function ProjectsPage() {
  const list = useLoad(async () => {
    const [projects, services] = await Promise.all([adminApi.projects(), adminApi.services()])
    return { projects, services }
  })
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Project | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!editing || saving) return
    setSaving(true)
    setErrors({})
    try {
      if (editing.id) await adminApi.updateProject(editing.id, editing)
      else await adminApi.createProject(editing)
      toast('ok', 'Карточка проекта сохранена')
      setEditing(null)
      list.reload()
    } catch (e) {
      setErrors(fieldErrors(e))
      toast('error', errorText(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: Project) => {
    const ok = await confirm({ title: 'Удалить карточку?', text: `«${p.title}» будет удалена из портфолио.`, confirm: 'Удалить', danger: true })
    if (!ok) return
    try {
      await adminApi.deleteProject(p.id)
      toast('ok', 'Карточка удалена')
      list.reload()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setEditing((e) => e && { ...e, [k]: v })
  const e = editing

  return (
    <>
      <PageHead
        title="Портфолио"
        sub="Карточки на странице «Проекты». Концепты помечаются на сайте как демонстрационные."
        actions={
          <button type="button" className="a-btn a-btn--primary" onClick={() => (setErrors({}), setEditing({ ...empty }))}>
            + Новая карточка
          </button>
        }
      />
      <LoadState state={list}>
        {list.data?.projects.length === 0 ? (
          <div className="a-state">
            <p>Карточек пока нет</p>
          </div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Проект</th>
                  <th scope="col">Тип</th>
                  <th scope="col">Статус</th>
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data?.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="a-table__num">{p.order}</td>
                    <td>
                      <button type="button" className="a-table__title a-linklike" onClick={() => (setErrors({}), setEditing({ ...p }))}>
                        {p.title}
                      </button>
                      <span className="a-table__sub">{p.summary.slice(0, 80)}</span>
                    </td>
                    <td>{p.kind === 'concept' ? <Badge tone="amber">Концепт</Badge> : <Badge tone="blue">Кейс</Badge>}</td>
                    <td>{p.status === 'published' ? <Badge tone="green">На сайте</Badge> : <Badge tone="muted">Скрыт</Badge>}</td>
                    <td className="a-table__actions">
                      <button type="button" className="a-btn a-btn--sm a-btn--ghost" onClick={() => (setErrors({}), setEditing({ ...p }))}>
                        Изменить
                      </button>
                      <button type="button" className="a-icon-btn a-icon-btn--danger" onClick={() => remove(p)} aria-label={`Удалить «${p.title}»`}>
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

      <Drawer open={!!editing} title={editing?.id ? 'Карточка проекта' : 'Новая карточка'} onClose={() => setEditing(null)}>
        {e && (
          <form
            className="a-form"
            onSubmit={(ev) => {
              ev.preventDefault()
              save()
            }}
          >
            <TextField
              label="Название"
              required
              value={e.title}
              max={120}
              error={errors.title}
              onChange={(t) => {
                set('title', t)
                if (!e.id) set('slug', slugify(t))
              }}
            />
            <TextField label="Slug" required mono value={e.slug} error={errors.slug} onChange={(t) => set('slug', t.toLowerCase())} />
            <TextField label="Описание" required multiline rows={3} value={e.summary} max={400} error={errors.summary} onChange={(t) => set('summary', t)} />
            <SelectField
              label="Тип"
              value={e.kind}
              onChange={(k) => set('kind', k)}
              options={[
                { value: 'case', label: 'Реальный проект (кейс)' },
                { value: 'concept', label: 'Концепт / демонстрация' },
              ]}
              hint={e.kind === 'concept' ? 'На сайте будет пометка «Концепт» и предупреждение о демо-записях' : undefined}
            />
            {e.kind === 'case' && (
              <TextField label="Ссылка на проект" value={e.url ?? ''} error={errors.url} placeholder="https://…" onChange={(t) => set('url', t || null)} />
            )}
            <ListEditor label="Теги" items={e.tags} max={8} maxLen={40} error={errors.tags} onChange={(t) => set('tags', t)} />
            <fieldset className="a-list">
              <legend>Услуги проекта</legend>
              <div className="a-checks">
                {list.data?.services.map((s) => {
                  const on = e.services.includes(s.id)
                  return (
                    <label key={s.id} className={`a-check${on ? ' is-active' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => set('services', on ? e.services.filter((x) => x !== s.id) : [...e.services, s.id])} />
                      {s.title}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <SelectField
              label="Паттерн обложки"
              value={e.cover.pattern}
              onChange={(p) => set('cover', { ...e.cover, pattern: p })}
              options={PATTERNS.map((p) => ({ value: p, label: p }))}
            />
            <ImageField
              label="Изображение"
              value={e.cover.image?.src ?? ''}
              error={errors['cover.image']}
              onChange={(src) => set('cover', src ? { ...e.cover, image: { src, alt: e.title } } : { pattern: e.cover.pattern })}
            />
            <TextField label="Порядок" type="number" value={String(e.order)} error={errors.order} onChange={(t) => set('order', Number(t) || 0)} />
            <Switch label="Показывать на сайте" checked={e.status === 'published'} onChange={(on) => set('status', on ? 'published' : 'hidden')} />
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
