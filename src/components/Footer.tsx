import { LogoMark } from './Logo'
import { Link } from '../lib/router'
import { NAV_ITEMS, ROUTES } from '../lib/routes'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <span className="nav__mark">
            <LogoMark size={22} />
          </span>
          <div>
            <p className="footer__name">WebCraft</p>
            <p className="footer__tag">Сайты и автоматизация</p>
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
        <p className="footer__copy">© 2026 WebCraft</p>
      </div>
    </footer>
  )
}
