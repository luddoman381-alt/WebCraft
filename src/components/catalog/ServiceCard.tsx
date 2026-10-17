import type { CSSProperties } from 'react'
import type { Service, ServiceCategory } from '../../data/types'
import { Link } from '../../lib/router'
import { pathFor } from '../../lib/routes'
import { ServiceCover } from './ServiceCover'
import { PriceTag } from './PriceTag'

type Props = {
  service: Service
  category?: ServiceCategory | null
  index?: number
  animate?: boolean
}

export function ServiceCard({ service, category, index = 0, animate = false }: Props) {
  return (
    <article
      className={`card${animate ? ' card--animate' : ''}`}
      style={{ '--i': index } as CSSProperties}
      aria-labelledby={`card-${service.id}`}
    >
      <ServiceCover cover={service.cover} />
      <div className="card__body">
        <p className="card__meta">
          <span className="card__index">{String(service.order).padStart(2, '0')}</span>
          {category?.title}
        </p>
        <h3 className="card__title" id={`card-${service.id}`}>
          {/* растянутая ссылка: вся карточка кликабельна, в дереве доступности — одна ссылка */}
          <Link to={pathFor('service', { slug: service.slug })} className="card__link">
            {service.title}
          </Link>
        </h3>
        <p className="card__text">{service.shortDescription}</p>
        <ul className="card__features" aria-label="Возможности">
          {service.features.slice(0, 3).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="card__foot">
          <PriceTag pricing={service.pricing} />
          <span className="card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </article>
  )
}

export function ServiceCardSkeleton() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="cover cover--card skeleton" />
      <div className="card__body">
        <span className="skeleton skeleton--line" style={{ width: '38%' }} />
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line" style={{ width: '72%' }} />
      </div>
    </div>
  )
}
