import { catalogResource, invalidate, projectsResource } from '../data/repository'
import { useResource } from '../data/useResource'
import { ServiceCover } from '../components/catalog/ServiceCover'
import { Footer } from '../components/Footer'
import { Link } from '../lib/router'
import { ROUTES, pathFor } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

const invalidateProjects = () => invalidate('projects')

export function ProjectsPage() {
  const projects = useResource(projectsResource, invalidateProjects)
  const catalog = useResource(catalogResource)
  useDocumentMeta(ROUTES.projects.title, ROUTES.projects.description)

  const serviceById = new Map(catalog.data?.services.map((s) => [s.id, s]) ?? [])
  const hasConcepts = !!projects.data?.some((p) => p.kind === 'concept')

  return (
    <main className="page projects" id="main">
      <header className="page-hero page-hero--compact">
        <div className="page-hero__inner">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            ПОРТФОЛИО
          </p>
          <h1 className="page-hero__title">
            Проекты <span className="accent">и концепты</span>
          </h1>
          <p className="page-hero__lead">Раздел наполняется. Ниже — примеры задач, с которыми работает студия.</p>
        </div>
      </header>

      {hasConcepts && (
      <div className="notice" role="note">
        <span className="notice__badge">DEMO</span>
        <p>
          Записи с пометкой «Концепт» — <strong>демонстрационные концепты</strong>, а не реальные клиентские проекты. Реальные кейсы
          будут добавлены после согласования с клиентами.
        </p>
      </div>
      )}

      {projects.status === 'loading' && (
        <div className="grid grid--2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="project project--skeleton">
              <div className="cover cover--card skeleton" />
            </div>
          ))}
        </div>
      )}

      {projects.status === 'error' && (
        <div className="state" role="alert">
          <p className="state__title">Не удалось загрузить проекты</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={projects.retry}>
            Повторить
          </button>
        </div>
      )}

      {projects.data && (
        <div className="grid grid--2">
          {projects.data.map((p) => (
            <article key={p.id} className="project" aria-labelledby={`p-${p.id}`}>
              <ServiceCover cover={p.cover} label={p.kind === 'concept' ? 'Концепт' : 'Кейс'} />
              <div className="project__body">
                <h2 className="project__title" id={`p-${p.id}`}>
                  {p.title}
                </h2>
                <p className="project__text">{p.summary}</p>
                <ul className="project__tags">
                  {p.tags.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                {p.kind === 'case' && p.url && (
                  <p className="project__services">
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      Открыть проект ↗
                    </a>
                  </p>
                )}
                {p.services.length > 0 && (
                  <p className="project__services">
                    Услуги:{' '}
                    {p.services
                      .map((id) => serviceById.get(id))
                      .filter(Boolean)
                      .map((s, i) => (
                        <span key={s!.id}>
                          {i > 0 && ', '}
                          <Link to={pathFor('service', { slug: s!.slug })}>{s!.title}</Link>
                        </span>
                      ))}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="cta-band">
        <div>
          <h2 className="cta-band__title">Есть похожая задача?</h2>
          <p className="cta-band__text">Расскажите о ней — предложим, как её решить.</p>
        </div>
        <Link to={ROUTES.contact.pattern} className="btn btn--primary">
          Обсудить проект <span aria-hidden="true">→</span>
        </Link>
      </section>

      <Footer />
    </main>
  )
}
