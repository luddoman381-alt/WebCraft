import { useEffect, useRef } from 'react'
import { Footer } from '../../components/Footer'
import { Link } from '../../lib/router'
import { ROUTES } from '../../lib/routes'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import './upbusiness.css'

/*
 * UpBusiness — второе направление сайта со своей сине-чёрной атмосферой.
 * Технологии здесь описаны как направления и инструменты развития,
 * а не как уже существующие собственные разработки.
 */

const APPROACH = [
  { key: 'sites', title: 'Сайты', text: 'Точка входа для клиента и основа цифрового присутствия.' },
  { key: 'promo', title: 'Продвижение', text: 'Привлечение аудитории и понятный путь к заявке.' },
  { key: 'auto', title: 'Автоматизация', text: 'Заявки, уведомления и процессы без ручной рутины.' },
  { key: 'ai', title: 'ИИ', text: 'Инструменты для обработки информации и ускорения операций.' },
]

const DIRECTIONS: { title: string; text: string; icon: 'ai' | 'flow' | 'product' | 'growth' | 'link' | 'chart' }[] = [
  {
    title: 'Искусственный интеллект',
    text: 'Подбор и внедрение ИИ-инструментов под задачи бизнеса: обработка обращений, работа с текстами и данными, ассистенты для команды.',
    icon: 'ai',
  },
  {
    title: 'Автоматизация процессов',
    text: 'Перевод повторяющихся операций в автоматический режим: заявки, статусы, уведомления, документы и отчёты.',
    icon: 'flow',
  },
  {
    title: 'Цифровые продукты',
    text: 'Сайты, личные кабинеты, калькуляторы и веб-сервисы, которые решают конкретную бизнес-задачу.',
    icon: 'product',
  },
  {
    title: 'Продвижение бизнеса',
    text: 'Цифровое присутствие, работа с клиентским путём и инструменты, которые помогают превращать интерес в обращения.',
    icon: 'growth',
  },
  {
    title: 'Интеграция сервисов',
    text: 'Связь сайта, CRM, мессенджеров, платёжных и учётных систем в единую рабочую среду.',
    icon: 'link',
  },
  {
    title: 'Аналитика',
    text: 'Настройка сбора данных и понятных отчётов, чтобы решения опирались на цифры, а не на догадки.',
    icon: 'chart',
  },
]

const VISION = [
  { k: '01', title: 'Эффективность', text: 'Меньше ручной работы — больше времени на развитие.' },
  { k: '02', title: 'Клиенты', text: 'Цифровые каналы, которые стабильно приводят обращения.' },
  { k: '03', title: 'Масштабирование', text: 'Системы, которые растут вместе с бизнесом.' },
]

function Icon({ kind }: { kind: (typeof DIRECTIONS)[number]['icon'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      {kind === 'ai' && (
        <g {...common}>
          <rect x="8" y="8" width="16" height="16" rx="3" />
          <path d="M12 4v4M20 4v4M12 24v4M20 24v4M4 12h4M4 20h4M24 12h4M24 20h4" />
          <path d="M13 19l3-6 3 6M14 17h4" />
        </g>
      )}
      {kind === 'flow' && (
        <g {...common}>
          <rect x="4" y="5" width="9" height="7" rx="2" />
          <rect x="19" y="13" width="9" height="7" rx="2" />
          <rect x="4" y="21" width="9" height="7" rx="2" />
          <path d="M13 8.5h3a3 3 0 0 1 3 3v5M13 24.5h3a3 3 0 0 0 3-3v-5" />
        </g>
      )}
      {kind === 'product' && (
        <g {...common}>
          <rect x="4" y="6" width="24" height="16" rx="2" />
          <path d="M4 11h24M11 26h10M16 22v4" />
          <path d="M9 16h6" />
        </g>
      )}
      {kind === 'growth' && (
        <g {...common}>
          <path d="M4 26h24" />
          <path d="M6 21l6-6 5 4 9-10" />
          <path d="M21 9h5v5" />
        </g>
      )}
      {kind === 'link' && (
        <g {...common}>
          <circle cx="8" cy="16" r="3.5" />
          <circle cx="24" cy="8" r="3.5" />
          <circle cx="24" cy="24" r="3.5" />
          <path d="M11.2 14.4l9.6-4.8M11.2 17.6l9.6 4.8" />
        </g>
      )}
      {kind === 'chart' && (
        <g {...common}>
          <path d="M5 27V5" />
          <path d="M5 27h22" />
          <rect x="9" y="17" width="4" height="7" rx="1" />
          <rect x="16" y="12" width="4" height="12" rx="1" />
          <rect x="23" y="8" width="4" height="16" rx="1" />
        </g>
      )}
    </svg>
  )
}

/** Мягкое появление блоков при прокрутке (без библиотек). */
function useReveal(root: React.RefObject<HTMLElement | null>, reduced: boolean) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = [...el.querySelectorAll<HTMLElement>('[data-ub-reveal]')]
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach((i) => i.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    )
    items.forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [root, reduced])
}

export default function UpBusinessPage() {
  useDocumentMeta(ROUTES.upbusiness.title, ROUTES.upbusiness.description)
  const reduced = useReducedMotion()
  const root = useRef<HTMLElement>(null)
  useReveal(root, reduced)

  // якоря внутри страницы — плавной прокруткой, без изменения истории браузера
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <main ref={root} className="ub" id="main" tabIndex={-1}>
      {/* атмосфера: глубина, сетка, медленные потоки света */}
      <div className="ub__atmo" aria-hidden="true">
        <div className="ub__aurora ub__aurora--a" />
        <div className="ub__aurora ub__aurora--b" />
        <div className="ub__grid" />
        <div className="ub__scan" />
      </div>

      {/* ---------------------------------------------------------- главный экран */}
      <section className="ub-hero" aria-labelledby="ub-title">
        <nav className="ub-brands" aria-label="Направления">
          <Link to={ROUTES.home.pattern} className="ub-brands__item">
            <span className="ub-brands__dot ub-brands__dot--wc" aria-hidden="true" />
            WEBCRAFT
          </Link>
          <span className="ub-brands__sep" aria-hidden="true" />
          <span className="ub-brands__item is-current" aria-current="page">
            <span className="ub-brands__dot" aria-hidden="true" />
            UPBUSINESS
          </span>
        </nav>

        <h1 id="ub-title" className="ub-hero__title">
          <span className="ub-hero__brand">UPBUSINESS</span>
          <span className="ub-hero__tagline">технологии для нового уровня бизнеса</span>
        </h1>
        <p className="ub-hero__lead">
          Сайты, продвижение, автоматизация и искусственный интеллект — как единая система, которая работает на рост
          компании.
        </p>
        <div className="ub-hero__actions">
          <Link to={ROUTES.contact.pattern} className="ub-btn ub-btn--primary">
            Обсудить проект <span aria-hidden="true">→</span>
          </Link>
          <a href="#ub-directions" className="ub-btn ub-btn--ghost" onClick={scrollTo('ub-directions')}>
            Направления
          </a>
        </div>
        <a href="#ub-mission" className="ub-hero__scroll" aria-label="К разделу «Наша миссия»" onClick={scrollTo('ub-mission')}>
          <span />
        </a>
      </section>

      {/* ---------------------------------------------------------- миссия */}
      <section className="ub-section ub-mission" id="ub-mission" aria-labelledby="ub-mission-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>01</span> Наша миссия
        </p>
        <h2 id="ub-mission-title" className="ub-statement" data-ub-reveal>
          Помогать бизнесу развиваться с помощью <em>современных технологий</em>, искусственного интеллекта, автоматизации и
          цифровых решений.
        </h2>
      </section>

      {/* ---------------------------------------------------------- подход */}
      <section className="ub-section ub-approach" aria-labelledby="ub-approach-title">
        <div className="ub-approach__text">
          <p className="ub-kicker" data-ub-reveal>
            <span>02</span> Наш подход
          </p>
          <h2 id="ub-approach-title" className="ub-h2" data-ub-reveal>
            Не отдельные инструменты, а единая система
          </h2>
          <p className="ub-p" data-ub-reveal>
            Мы объединяем сайты, продвижение, автоматизацию и ИИ так, чтобы каждая часть усиливала остальные и вся
            конструкция работала на развитие бизнеса.
          </p>
        </div>
        <div className="ub-system" data-ub-reveal>
          <svg className="ub-system__lines" viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <linearGradient id="ub-line" x1="0" x2="1">
                <stop offset="0" stopColor="#4da3ff" stopOpacity="0.05" />
                <stop offset="0.5" stopColor="#6cc4ff" stopOpacity="0.8" />
                <stop offset="1" stopColor="#4da3ff" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(77,163,255,0.14)" />
            <circle cx="200" cy="200" r="96" fill="none" stroke="rgba(77,163,255,0.1)" strokeDasharray="3 6" />
            {[
              [200, 50],
              [350, 200],
              [200, 350],
              [50, 200],
            ].map(([x, y], i) => (
              <line key={i} x1="200" y1="200" x2={x} y2={y} stroke="url(#ub-line)" strokeWidth="1.5" className="ub-system__beam" />
            ))}
          </svg>
          <div className="ub-system__core">
            <span>UP</span>
            <small>система</small>
          </div>
          {APPROACH.map((a, i) => (
            <div key={a.key} className={`ub-node ub-node--${i}`}>
              <p className="ub-node__title">{a.title}</p>
              <p className="ub-node__text">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- направления */}
      <section className="ub-section ub-directions" id="ub-directions" aria-labelledby="ub-dir-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>03</span> Наши направления
        </p>
        <h2 id="ub-dir-title" className="ub-h2" data-ub-reveal>
          Технологии как инструменты роста
        </h2>
        <ul className="ub-cards">
          {DIRECTIONS.map((d, i) => (
            <li key={d.title} className="ub-card" data-ub-reveal style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
              <span className="ub-card__index">{String(i + 1).padStart(2, '0')}</span>
              <span className="ub-card__icon">
                <Icon kind={d.icon} />
              </span>
              <h3 className="ub-card__title">{d.title}</h3>
              <p className="ub-card__text">{d.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------- видение */}
      <section className="ub-section ub-vision" aria-labelledby="ub-vision-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>04</span> Наше видение
        </p>
        <h2 id="ub-vision-title" className="ub-statement ub-statement--sm" data-ub-reveal>
          Будущее, в котором бизнес использует технологии, чтобы работать эффективнее, привлекать клиентов и
          масштабироваться.
        </h2>
        <ul className="ub-pillars">
          {VISION.map((v, i) => (
            <li key={v.k} className="ub-pillar" data-ub-reveal style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
              <span className="ub-pillar__k">{v.k}</span>
              <p className="ub-pillar__title">{v.title}</p>
              <p className="ub-pillar__text">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------- финал */}
      <section className="ub-final" aria-labelledby="ub-final-title">
        <div className="ub-final__glow" aria-hidden="true" />
        <h2 id="ub-final-title" className="ub-final__title" data-ub-reveal>
          Будущее бизнеса начинается с <span>правильных решений</span>
        </h2>
        <p className="ub-p ub-final__text" data-ub-reveal>
          Расскажите о задаче — вместе определим, с каких технологий начать и как построить систему под ваш бизнес.
        </p>
        <div className="ub-hero__actions ub-final__actions" data-ub-reveal>
          <Link to={ROUTES.contact.pattern} className="ub-btn ub-btn--primary">
            Обсудить проект <span aria-hidden="true">→</span>
          </Link>
          <Link to={ROUTES.home.pattern} className="ub-btn ub-btn--ghost">
            Вернуться в WebCraft
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
