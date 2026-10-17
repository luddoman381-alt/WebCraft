import { catalogResource, findCategory, findService, invalidate, relatedServices } from '../data/repository'
import { useResource } from '../data/useResource'
import { WORK_PROCESS } from '../data/demo/catalog'
import { ServiceCover } from '../components/catalog/ServiceCover'
import { ServiceCard } from '../components/catalog/ServiceCard'
import { PriceTag } from '../components/catalog/PriceTag'
import { Footer } from '../components/Footer'
import { Link } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { NotFoundPage } from './NotFoundPage'

const invalidateCatalog = () => invalidate('catalog')

export function ServicePage({ slug }: { slug: string }) {
  const res = useResource(catalogResource, invalidateCatalog)
  const data = res.status === 'ready' ? res.data : null
  const service = data ? findService(data, slug) : null

  useDocumentMeta(service?.seo.title ?? null, service?.seo.description)

  if (res.status === 'error') {
    return (
      <main className="page" id="main">
        <div className="state state--page" role="alert">
          <p className="state__title">Не удалось загрузить услугу</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={res.retry}>
            Повторить
          </button>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="page service" id="main" aria-busy="true">
        <div className="service__hero">
          <div className="service__head">
            <span className="skeleton skeleton--line" style={{ width: 180 }} />
            <span className="skeleton skeleton--h1" />
            <span className="skeleton skeleton--line" style={{ width: '80%' }} />
            <span className="skeleton skeleton--line" style={{ width: '60%' }} />
          </div>
          <div className="cover cover--hero skeleton" />
        </div>
      </main>
    )
  }

  if (!service) return <NotFoundPage what="service" />

  const category = findCategory(data, service.category)
  const related = relatedServices(data, service)
  const contactHref = `${ROUTES.contact.pattern}?service=${encodeURIComponent(service.slug)}`

  return (
    <main className="page service" id="main">
      <nav className="crumbs" aria-label="Хлебные крошки">
        <ol>
          <li>
            <Link to={ROUTES.home.pattern}>Главная</Link>
          </li>
          <li>
            <Link to={ROUTES.services.pattern}>Услуги</Link>
          </li>
          {category && (
            <li>
              <Link to={`${ROUTES.services.pattern}?category=${category.id}`}>{category.title}</Link>
            </li>
          )}
          <li aria-current="page">{service.title}</li>
        </ol>
      </nav>

      <header className="service__hero">
        <div className="service__head">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            {category?.title.toUpperCase()}
          </p>
          <h1 className="service__title">{service.title}</h1>
          <p className="service__lead">{service.shortDescription}</p>
          <div className="service__actions">
            <Link to={contactHref} className="btn btn--primary">
              Обсудить проект <span aria-hidden="true">→</span>
            </Link>
            <Link to={ROUTES.services.pattern} className="btn btn--ghost">
              Весь каталог
            </Link>
          </div>
        </div>
        <ServiceCover cover={service.cover} size="hero" />
      </header>

      <div className="service__layout">
        <article className="service__content">
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="section-title">
              О услуге
            </h2>
            {service.fullDescription.map((p, i) => (
              <p key={i} className="service__p">
                {p}
              </p>
            ))}
          </section>

          <section aria-labelledby="features-title">
            <h2 id="features-title" className="section-title">
              Возможности
            </h2>
            <ul className="features">
              {service.features.map((f, i) => (
                <li key={f}>
                  <span className="features__index">{String(i + 1).padStart(2, '0')}</span>
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="process-title">
            <h2 id="process-title" className="section-title">
              Как проходит работа
            </h2>
            <ol className="process">
              {WORK_PROCESS.map((s, i) => (
                <li key={s.title}>
                  <span className="process__step">Шаг {i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </article>

        <aside className="service__aside" aria-label="Стоимость">
          <div className="price-card">
            <p className="price-card__label">Стоимость</p>
            <p className="price-card__value">
              <PriceTag pricing={service.pricing} />
            </p>
            {service.pricing.note && <p className="price-card__note">{service.pricing.note}</p>}
            <p className="price-card__text">
              Рассчитываем после короткого разбора задачи: объём, интеграции и сроки.
            </p>
            <Link to={contactHref} className="btn btn--primary btn--block">
              Обсудить проект
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title" className="section-title">
            Связанные услуги
          </h2>
          <div className="grid grid--3">
            {related.map((s, i) => (
              <ServiceCard key={s.id} service={s} category={findCategory(data, s.category)} index={i} />
            ))}
          </div>
        </section>
      )}

      <section className="cta-band">
        <div>
          <h2 className="cta-band__title">Подходит «{service.title}»?</h2>
          <p className="cta-band__text">Опишите задачу — ответим, с чего начать и как будет устроена работа.</p>
        </div>
        <Link to={contactHref} className="btn btn--primary">
          Обсудить проект <span aria-hidden="true">→</span>
        </Link>
      </section>

      <Footer />
    </main>
  )
}

