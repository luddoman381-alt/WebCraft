import { LogoMark, UbMark } from './Logo'
import { Link } from '../lib/router'
import { NAV_ITEMS, ROUTES } from '../lib/routes'

/** Подвал; в разделе UpBusiness показывает его название и знак. */
export function Footer({ realm = 'wc' }: { realm?: 'wc' | 'ub' }) {
  const ub = realm === 'ub'
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <span className="nav__mark">
            {ub ? <UbMark size={22} /> : <LogoMark size={22} />}
          </span>
          <div>
            <p className="footer__name">{ub ? 'UpBusiness' : 'WebCraft'}</p>
            <p className="footer__tag">{ub ? 'Технологии для роста бизнеса' : 'Сайты и автоматизация'}</p>
          </div>
        </div>
        <nav className="footer__nav" aria-label="Навигация в подвале">
          <Link to={ROUTES.home.pattern}>Главная</Link>
          {NAV_ITEMS.map((n) => (
            <Link key={n.route} to={ROUTES[n.route].pattern}>
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="footer__note">
          Каталог наполнен демонстрационными записями: состав услуг и тексты будут заменены реальным контентом.
        </p>
        <p className="footer__copy">{ub ? '© 2026 UpBusiness · WebCraft' : '© 2026 WebCraft'}</p>
      </div>
    </footer>
  )
}
