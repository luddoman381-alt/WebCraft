import { useEffect, useState } from 'react'
import { useRouter } from '../../lib/router'
import type { Lead, LeadStatus } from '../../data/types'
import { adminApi, formatDate, LEAD_STATUS_LABEL } from '../api'
import { Badge, Drawer, errorText, LoadState, PageHead, useConfirm, useLoad, useToast } from '../ui'

const STATUSES: LeadStatus[] = ['new', 'in_progress', 'done', 'spam']
const tone = (s: LeadStatus): 'green' | 'blue' | 'red' | 'muted' => (s === 'new' ? 'green' : s === 'in_progress' ? 'blue' : s === 'spam' ? 'red' : 'muted')

export function LeadsPage({ openId }: { openId: number | null }) {
  const { query, navigateDirect } = useRouter()
  const [q, setQ] = useState(query.get('q') ?? '')
  const [debounced, setDebounced] = useState(q)
  const [status, setStatus] = useState(query.get('status') ?? '')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const list = useLoad(() => adminApi.leads({ q: debounced, status, page }), [debounced, status, page])
  const counts = useLoad(adminApi.stats, [list.data])

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1
  const openLead = (id: number | null) => navigateDirect(id ? `/admin/leads/${id}` : '/admin/leads', { replace: false })

  return (
    <>
      <PageHead title="Заявки" sub="Обращения из формы на странице «Контакты»" />
      <div className="a-toolbar">
        <input
          className="a-input a-input--search"
          type="search"
          placeholder="Поиск: имя, контакт, текст, услуга"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          aria-label="Поиск заявок"
        />
        <div className="a-tabs" role="group" aria-label="Статус">
          <button type="button" className={!status ? 'is-active' : ''} aria-pressed={!status} onClick={() => (setStatus(''), setPage(1))}>
            Все
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={status === s ? 'is-active' : ''} aria-pressed={status === s} onClick={() => (setStatus(s), setPage(1))}>
              {LEAD_STATUS_LABEL[s]} <span>{counts.data?.leads.byStatus[s] ?? '·'}</span>
            </button>
          ))}
        </div>
      </div>

      <LoadState state={list}>
        {list.data && list.data.items.length === 0 ? (
          <div className="a-state">
            <p>{debounced || status ? 'По этим условиям заявок нет' : 'Заявок пока нет'}</p>
          </div>
        ) : (
          <div className="a-table-wrap" aria-busy={list.loading}>
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">Имя и контакт</th>
                  <th scope="col">Задача</th>
                  <th scope="col">Услуга</th>
                  <th scope="col">Статус</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((l) => (
                  <tr key={l.id} className={`a-table__row-link${l.status === 'new' ? ' is-new' : ''}`} onClick={() => openLead(l.id)}>
                    <td className="a-table__date">
                      <time dateTime={l.createdAt}>{formatDate(l.createdAt)}</time>
                    </td>
                    <td>
                      <button type="button" className="a-table__title a-linklike" onClick={(e) => (e.stopPropagation(), openLead(l.id))}>
                        {l.name}
                      </button>
                      <span className="a-table__sub">{l.contact}</span>
                    </td>
                    <td className="a-table__msg">{l.message.slice(0, 120)}</td>
                    <td>{l.service ?? '—'}</td>
                    <td>
                      <Badge tone={tone(l.status)}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav className="a-pager" aria-label="Страницы">
            <button type="button" className="a-btn a-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Назад
            </button>
            <span>
              {page} / {pages}
            </span>
            <button type="button" className="a-btn a-btn--sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Дальше →
            </button>
          </nav>
        )}
      </LoadState>

      <Drawer open={openId !== null} title="Заявка" onClose={() => openLead(null)}>
        {openId !== null && <LeadDetail id={openId} onChanged={list.reload} onClose={() => openLead(null)} />}
      </Drawer>
    </>
  )
}

function LeadDetail({ id, onChanged, onClose }: { id: number; onChanged: () => void; onClose: () => void }) {
  const lead = useLoad(() => adminApi.lead(id), [id])
  const toast = useToast()
  const confirm = useConfirm()
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = async (p: { status?: LeadStatus; note?: string }) => {
    setBusy(true)
    try {
      const next: Lead = await adminApi.updateLead(id, p)
      lead.setData(next)
      setNote(null)
      onChanged()
      toast('ok', 'Заявка обновлена')
    } catch (e) {
      toast('error', errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Удалить заявку?', text: 'Заявка будет удалена без возможности восстановления.', confirm: 'Удалить', danger: true })
    if (!ok) return
    try {
      await adminApi.deleteLead(id)
      toast('ok', 'Заявка удалена')
      onChanged()
      onClose()
    } catch (e) {
      toast('error', errorText(e))
    }
  }

  return (
    <LoadState state={lead}>
      {lead.data && (
        <div className="a-lead">
          <dl className="a-dl">
            <div>
              <dt>Получена</dt>
              <dd>{formatDate(lead.data.createdAt)}</dd>
            </div>
            <div>
              <dt>Имя</dt>
              <dd>{lead.data.name}</dd>
            </div>
            <div>
              <dt>Контакт</dt>
              <dd className="a-copy">{lead.data.contact}</dd>
            </div>
            <div>
              <dt>Услуга</dt>
              <dd>
                {lead.data.service ? (
                  <a href={`/services/${lead.data.service}`} target="_blank" rel="noopener" className="a-link">
                    {lead.data.service} ↗
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Страница</dt>
              <dd>{lead.data.page ?? '—'}</dd>
            </div>
          </dl>
          <h3 className="a-lead__h">Сообщение</h3>
          {/* текст выводится как обычный текст — без HTML */}
          <p className="a-lead__msg">{lead.data.message}</p>

          <h3 className="a-lead__h">Статус</h3>
          <div className="a-tabs" role="group" aria-label="Статус заявки">
            {STATUSES.map((s) => (
              <button key={s} type="button" disabled={busy} className={lead.data!.status === s ? 'is-active' : ''} aria-pressed={lead.data!.status === s} onClick={() => patch({ status: s })}>
                {LEAD_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <h3 className="a-lead__h">Заметка</h3>
          <textarea className="a-input" rows={4} value={note ?? lead.data.note} onChange={(e) => setNote(e.target.value)} placeholder="Внутренняя заметка — видна только в панели" maxLength={2000} aria-label="Заметка" />
          <div className="a-form__actions">
            <button type="button" className="a-btn a-btn--danger a-btn--sm" onClick={remove}>
              Удалить
            </button>
            <button type="button" className="a-btn a-btn--primary a-btn--sm" disabled={busy || note === null || note === lead.data.note} onClick={() => patch({ note: note ?? '' })}>
              Сохранить заметку
            </button>
          </div>
        </div>
      )}
    </LoadState>
  )
}
