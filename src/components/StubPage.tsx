import { useEffect, useRef } from 'react'
import { ROUTES, hrefFor, type RouteId } from '../lib/routes'

/** Временная страница-заглушка для разделов, которые появятся на следующих этапах. */
export function StubPage({ route }: { route: Exclude<RouteId, 'home'> }) {
  const def = ROUTES[route]
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    document.title = `${def.title} — WebCraft`
    return () => {
      document.title = 'WebCraft — Сайты и автоматизация'
    }
  }, [def.title])

  return (
    <main className="stub" aria-labelledby="stub-title">
      <div className="stub__card">
        <p className="stub__path">
          <span className="stub__dot" aria-hidden="true" />
          webcraft.studio{def.path}
        </p>
        <h1 id="stub-title" ref={heading} tabIndex={-1} className="stub__title">
          {def.title}
        </h1>
        <p className="stub__text">{def.description}</p>
        <p className="stub__note">Раздел в разработке — страница появится на следующем этапе.</p>
        <a href={hrefFor('home')} className="btn btn--ghost btn--sm">
          <span aria-hidden="true">←</span> Вернуться к сцене
        </a>
      </div>
    </main>
  )
}
