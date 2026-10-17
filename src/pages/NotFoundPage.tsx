import { Link } from '../lib/router'
import { ROUTES } from '../lib/routes'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export function NotFoundPage({ what = 'page' }: { what?: 'page' | 'service' }) {
  useDocumentMeta(what === 'service' ? 'Услуга не найдена' : 'Страница не найдена')
  return (
    <main className="page" id="main">
      <div className="state state--page">
        <p className="state__code">404</p>
        <h1 className="state__title">{what === 'service' ? 'Такой услуги нет в каталоге' : 'Страница не найдена'}</h1>
        <p className="state__text">
          {what === 'service'
            ? 'Возможно, услуга была переименована или снята с публикации.'
            : 'Проверьте адрес или вернитесь на главную.'}
        </p>
        <div className="state__actions">
          <Link to={ROUTES.services.pattern} className="btn btn--primary btn--sm">
            Каталог услуг
          </Link>
          <Link to={ROUTES.home.pattern} className="btn btn--ghost btn--sm">
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
