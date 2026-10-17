import { Link } from '../../lib/router'
import { adminApi, formatDate, LEAD_STATUS_LABEL } from '../api'
import { Badge, LoadState, PageHead, useLoad } from '../ui'

export function Dashboard() {
  const stats = useLoad(adminApi.stats)
  const s = stats.data

  return (
    <>
      <PageHead
        title="Обзор"
        sub="Состояние каталога и входящие заявки"
        actions={
          <Link to="/admin/services/new" className="a-btn a-btn--primary">
            + Новая услуга
          </Link>
        }
      />
      <LoadState state={stats}>
        {s && (
          <>
            {s.services.demo > 0 && (
              <div className="a-note" role="note">
                В каталоге {s.services.demo} демонстрационных услуг из первоначального наполнения. Отредактируйте их или скройте и
                добавьте свои.
              </div>
            )}
            <div className="a-stats">
              <Link to="/admin/services" className="a-stat">
                <span className="a-stat__label">Услуги на сайте</span>
                <span className="a-stat__value">{s.services.published}</span>
                <span className="a-stat__meta">всего {s.services.total} · скрыто {s.services.hidden}</span>
              </Link>
              <Link to="/admin/categories" className="a-stat">
                <span className="a-stat__label">Категории</span>
                <span className="a-stat__value">{s.categories.total - s.categories.hidden}</span>
                <span className="a-stat__meta">скрыто {s.categories.hidden}</span>
              </Link>
              <Link to="/admin/leads?status=new" className="a-stat a-stat--accent">
                <span className="a-stat__label">Новые заявки</span>
                <span className="a-stat__value">{s.leads.byStatus.new}</span>
                <span className="a-stat__meta">в работе {s.leads.byStatus.in_progress}</span>
              </Link>
              <Link to="/admin/projects" className="a-stat">
                <span className="a-stat__label">Портфолио</span>
                <span className="a-stat__value">{s.projects.total}</span>
                <span className="a-stat__meta">карточек проектов</span>
              </Link>
            </div>

            <section className="a-card">
              <div className="a-card__head">
                <h2>Последние заявки</h2>
                <Link to="/admin/leads" className="a-link">
                  Все заявки →
                </Link>
              </div>
              {s.leads.recent.length === 0 ? (
                <p className="a-empty">Заявок пока нет. Они появятся здесь после отправки формы на странице «Контакты».</p>
              ) : (
                <ul className="a-rows">
                  {s.leads.recent.map((l) => (
                    <li key={l.id}>
                      <Link to={`/admin/leads/${l.id}`} className="a-row">
                        <span className="a-row__main">
                          <strong>{l.name}</strong>
                          <span className="a-row__sub">{l.message.slice(0, 90)}</span>
                        </span>
                        <span className="a-row__side">
                          <Badge tone={l.status === 'new' ? 'green' : l.status === 'spam' ? 'red' : 'muted'}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                          <time dateTime={l.createdAt}>{formatDate(l.createdAt)}</time>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </LoadState>
    </>
  )
}
