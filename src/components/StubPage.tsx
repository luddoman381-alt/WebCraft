import { useEffect, useRef } from 'react'
import { Link } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { Footer } from './Footer'

/** Страница-заглушка для разделов, которые появятся на следующих этапах. */
export function StubPage({ route }: { route: 'about' }) {
  const def = ROUTES[route]
  const heading = useRef<HTMLHeadingElement>(null)
  useDocumentMeta(def.title, def.description)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <main className="page stub" id="main" aria-labelledby="stub-title">
      <div className="stub__card">
        <p className="stub__path">
          <span className="stub__dot" aria-hidden="true" />
          webcraft.studio{def.pattern}
        </p>
        <h1 id="stub-title" ref={heading} tabIndex={-1} className="stub__title">
          {def.title}
        </h1>
        <p className="stub__text">{def.description}</p>
        <p className="stub__note">Раздел в разработке — страница появится на следующем этапе.</p>
        <Link to={ROUTES.home.pattern} className="btn btn--ghost btn--sm">
          <span aria-hidden="true">←</span> Вернуться к сцене
        </Link>
      </div>
      <Footer />
    </main>
  )
}
