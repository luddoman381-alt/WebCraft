import { useEffect, useRef } from 'react'
import { Footer } from '../../components/Footer'
import { Link, useRouter } from '../../lib/router'
import { ROUTES } from '../../lib/routes'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { requestRealm } from '../../realm/realmBus'
import { AiCore } from './AiCore'
import { Circuit } from './Circuit'
import './upbusiness.css'

/*
 * UpBusiness — второе направление сайта со своей сине-чёрной «ИИ-средой».
 * Технологии здесь описаны как направления и инструменты развития,
 * а не как уже существующие собственные разработки.
 */

const APPROACH = [
  { key: 'site', title: 'Сайт', text: 'Точка входа для клиента и основа цифрового присутствия.' },
  { key: 'leads', title: 'Привлечение клиентов', text: 'Каналы, которые приводят аудиторию и превращают интерес в обращения.' },
  { key: 'auto', title: 'Автоматизация', text: 'Заявки, уведомления и процессы без ручной рутины.' },
  { key: 'ai', title: 'Интеллектуальные инструменты', text: 'ИИ-сервисы для работы с информацией и ускорения операций.' },
]

const DIRECTIONS: { title: string; text: string; icon: 'ai' | 'flow' | 'product' | 'growth' | 'link' | 'site' }[] = [
  {
    title: 'Искусственный интеллект и AI-инструменты',
    text: 'Подбор и внедрение современных ИИ-сервисов под задачи бизнеса: обработка обращений, работа с текстами и данными, ассистенты для команды.',
    icon: 'ai',
  },
  {
    title: 'Автоматизация бизнес-процессов',
    text: 'Перевод повторяющихся операций в автоматический режим: заявки, статусы, уведомления, документы и отчёты.',
    icon: 'flow',
  },
  {
    title: 'Создание и развитие цифровых продуктов',
    text: 'Личные кабинеты, калькуляторы и веб-сервисы — от идеи и прототипа до запуска и развития.',
    icon: 'product',
  },
  {
    title: 'Сайты и цифровое присутствие',
    text: 'Сайты и платформы, которые понятно представляют компанию и ведут клиента к обращению.',
    icon: 'site',
  },
  {
    title: 'Продвижение и привлечение клиентов',
    text: 'Работа с клиентским путём и каналами привлечения, чтобы интерес превращался в заявки.',
    icon: 'growth',
  },
  {
    title: 'Интеграция сервисов и интеллектуальных рабочих процессов',
    text: 'Связь сайта, CRM, мессенджеров и ИИ-инструментов в единую рабочую среду.',
    icon: 'link',
  },
]

const VISION = [
  { k: '01', title: 'Эффективность', text: 'Меньше ручной работы — больше времени на развитие.' },
  { k: '02', title: 'Новые возможности', text: 'Технологии открывают направления, которые раньше были недоступны.' },
  { k: '03', title: 'Масштабирование', text: 'Системы, которые растут вместе с бизнесом.' },
]

// трассы «микросхемы» на фоне главного экрана
const TRACES = [
  'M0 160 H220 V260 H420 V200 H560',
  'M0 640 H180 V540 H360 V580 H500',
  'M1440 120 H1240 V220 H1060 V170 H900',
  'M1440 720 H1260 V620 H1100 V680 H940',
  'M300 900 V790 H460 V720',
  'M1120 900 V810 H980 V750',
  'M600 0 V80 H720 V130',
  'M880 0 V60 H1000 V110',
]
const CHIPS: [number, number][] = [
  [560, 200],
  [500, 580],
  [900, 170],
  [940, 680],
  [460, 720],
  [980, 750],
  [720, 130],
  [1000, 110],
]

/*
 * Швы между секциями: дорожки выходят из боковых шин страницы (x = 36 и 1404
 * при ширине 1440 — те же 2.5 %, что у шин в CSS), изгибаются, ветвятся и уходят
 * к содержимому следующего блока. Так секции соединены в одну систему.
 */
type SeamDef = { paths: string[]; nodes: [number, number][]; chips?: [number, number][]; pulses?: number[] }
const SEAMS: Record<'hero' | 'mission' | 'approach' | 'directions' | 'vision', SeamDef> = {
  hero: {
    paths: [
      'M36 0 V52 Q36 80 64 80 H340 Q356 80 368 68 L416 20 H560',
      'M340 80 Q352 80 364 92 L400 128 H720',
      'M1404 0 V96 Q1404 120 1380 120 H1120 Q1104 120 1092 108 L1064 80 H940',
      'M1220 120 V160',
    ],
    nodes: [
      [560, 20],
      [940, 80],
      [1220, 160],
    ],
    chips: [[720, 128]],
    pulses: [0, 2],
  },
  mission: {
    paths: [
      'M36 40 H180 Q196 40 208 52 L246 90 H520 Q536 90 548 78 L576 50 H660',
      'M246 90 Q262 102 262 122 V160',
      'M1404 70 H1200 Q1184 70 1172 82 L1134 120 H980',
    ],
    nodes: [
      [660, 50],
      [980, 120],
      [262, 160],
    ],
    chips: [[520, 90]],
    pulses: [0, 2],
  },
  approach: {
    // общая шина через всю ширину — от левой шины страницы к правой
    paths: [
      'M36 100 H300 Q316 100 328 88 L376 40 H760 Q776 40 788 52 L836 100 H1100 Q1116 100 1128 88 L1176 40 H1404',
      'M600 40 V0',
      'M960 100 V160',
    ],
    nodes: [
      [600, 0],
      [960, 160],
    ],
    chips: [
      [760, 40],
      [1100, 100],
    ],
    pulses: [0],
  },
  directions: {
    paths: [
      'M36 30 H120 Q136 30 148 42 L206 100 H440',
      'M1404 30 H1300 Q1284 30 1272 42 L1214 100 H1000 Q984 100 972 112 L944 140 H860',
    ],
    nodes: [
      [440, 100],
      [860, 140],
    ],
    chips: [[1000, 100]],
  },
  vision: {
    // сходятся к центру — дальше их подхватывает композиция финального экрана
    paths: [
      'M36 20 H260 Q300 20 330 50 L380 100 Q410 130 450 130 H640 Q680 130 700 150 L720 160',
      'M1404 20 H1180 Q1140 20 1110 50 L1060 100 Q1030 130 990 130 H800 Q760 130 740 150 L720 160',
    ],
    nodes: [
      [450, 130],
      [990, 130],
    ],
  },
}

// финальный экран: потоки данных со всех сторон сходятся к заголовку
const FINAL_PATHS = [
  'M0 120 H240 Q280 120 310 150 L460 300 Q490 330 530 330 H580',
  'M0 580 H240 Q280 580 310 550 L460 400 Q490 370 530 370 H580',
  'M1440 120 H1200 Q1160 120 1130 150 L980 300 Q950 330 910 330 H860',
  'M1440 580 H1200 Q1160 580 1130 550 L980 400 Q950 370 910 370 H860',
  'M0 350 H360',
  'M1440 350 H1080',
  'M560 0 V70 Q560 100 586 118 L650 160',
  'M880 0 V70 Q880 100 854 118 L790 160',
  'M600 700 V630 Q600 600 626 582 L680 546',
  'M840 700 V630 Q840 600 814 582 L760 546',
]
const FINAL_NODES: [number, number][] = [
  [580, 330],
  [580, 370],
  [860, 330],
  [860, 370],
  [360, 350],
  [1080, 350],
  [650, 160],
  [790, 160],
  [680, 546],
  [760, 546],
]

function Seam({ id, delay = 0 }: { id: keyof typeof SEAMS; delay?: number }) {
  const d = SEAMS[id]
  return (
    <div className={`ub-seam ub-seam--${id}`} aria-hidden="true">
      <Circuit viewBox="0 0 1440 160" stretch paths={d.paths} nodes={d.nodes} chips={d.chips} pulses={d.pulses} delay={delay} />
    </div>
  )
}

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
          <path d="M16 4l11 6v12l-11 6-11-6V10z" />
          <path d="M5 10l11 6 11-6M16 16v12" />
        </g>
      )}
      {kind === 'site' && (
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
    // импульсы на дорожках бегут только у видимых блоков — остальные стоят на паузе
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting)
    })
    el.querySelectorAll('[data-ub-live]').forEach((n) => live.observe(n))
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
    return () => {
      io.disconnect()
      live.disconnect()
    }
  }, [root, reduced])
}

/** Световое пятно на стеклянной панели следует за курсором. */
const glow = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

export default function UpBusinessPage() {
  useDocumentMeta(ROUTES.upbusiness.title, ROUTES.upbusiness.description)
  const reduced = useReducedMotion()
  const root = useRef<HTMLElement>(null)
  useReveal(root, reduced)
  // пришли через переключатель режимов: логотип уже собран переходом — без повторной анимации входа
  const { location } = useRouter()
  const fromRealm = !!location.state.realm

  // якоря внутри страницы — плавной прокруткой, без изменения истории браузера
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <main ref={root} className={`ub${fromRealm ? ' is-from-realm' : ''}`} id="main" tabIndex={-1}>
      {/* атмосфера: глубина, сетка, трассы микросхем, медленные потоки света */}
      <div className="ub__atmo" aria-hidden="true">
        <div className="ub__aurora ub__aurora--a" />
        <div className="ub__aurora ub__aurora--b" />
        <div className="ub__grid" />
        <Circuit className="ub__circuits" viewBox="0 0 1440 900" paths={TRACES} chips={CHIPS} speed={6.5} />
        {/* боковые шины тянутся через всю страницу — к ним подключаются швы секций */}
        <div className="ub__rail ub__rail--l" />
        <div className="ub__rail ub__rail--r" />
        <div className="ub__halo ub__halo--a" />
        <div className="ub__halo ub__halo--b" />
        <div className="ub__halo ub__halo--c" />
        <div className="ub__scan" />
      </div>

      {/* ---------------------------------------------------------- главный экран */}
      <section className="ub-hero" aria-labelledby="ub-title">
        <div className="ub-hero__grid">
          <div className="ub-hero__text">
            <p className="ub-hero__eyebrow">
              <span aria-hidden="true" /> AI · Automation · Digital
            </p>
            <h1 id="ub-title" className="ub-hero__title">
              <span className="ub-hero__brand">UPBUSINESS</span>
              <span className="ub-hero__tagline">технологии для нового уровня бизнеса</span>
            </h1>
            <p className="ub-hero__lead">
              Объединяем искусственный интеллект, автоматизацию и цифровые решения, чтобы открывать новые возможности для
              бизнеса.
            </p>
            <div className="ub-hero__actions">
              <Link to={ROUTES.contact.pattern} className="ub-btn ub-btn--primary">
                Обсудить проект <span aria-hidden="true">→</span>
              </Link>
              <a href="#ub-directions" className="ub-btn ub-btn--ghost" onClick={scrollTo('ub-directions')}>
                Направления
              </a>
            </div>
          </div>
          <div className="ub-hero__core">
            <AiCore reduced={reduced} />
          </div>
        </div>
        <a href="#ub-mission" className="ub-hero__scroll" aria-label="К разделу «Наша миссия»" onClick={scrollTo('ub-mission')}>
          <span />
        </a>
      </section>

      <Seam id="hero" />

      {/* ---------------------------------------------------------- миссия */}
      <section className="ub-section ub-mission" id="ub-mission" aria-labelledby="ub-mission-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>01</span> Наша миссия
        </p>
        <h2 id="ub-mission-title" className="ub-statement" data-ub-reveal>
          Помогать бизнесу развиваться, используя <em>современные технологии</em>, ИИ-инструменты, автоматизацию и цифровые
          решения.
        </h2>
      </section>

      <Seam id="mission" delay={0.6} />

      {/* ---------------------------------------------------------- подход */}
      <section className="ub-section ub-approach" aria-labelledby="ub-approach-title">
        <div className="ub-approach__text">
          <p className="ub-kicker" data-ub-reveal>
            <span>02</span> Наш подход
          </p>
          <h2 id="ub-approach-title" className="ub-h2" data-ub-reveal>
            Бизнес — это система
          </h2>
          <p className="ub-p" data-ub-reveal>
            Мы рассматриваем бизнес как систему, в которой сайт, привлечение клиентов, автоматизация и интеллектуальные
            инструменты должны работать совместно.
          </p>
        </div>
        <div className="ub-system" data-ub-reveal data-ub-live="">
          <svg className="ub-system__lines" viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <linearGradient id="ub-line" x1="0" x2="1">
                <stop offset="0" stopColor="#4da3ff" stopOpacity="0.05" />
                <stop offset="0.5" stopColor="#6cc4ff" stopOpacity="0.8" />
                <stop offset="1" stopColor="#4da3ff" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(77,163,255,0.14)" />
            <circle cx="200" cy="200" r="96" fill="none" stroke="rgba(77,163,255,0.1)" strokeDasharray="3 6" className="ub-system__ring" />
            {[
              [200, 50],
              [350, 200],
              [200, 350],
              [50, 200],
            ].map(([x, y], i) => (
              <g key={i}>
                <line x1="200" y1="200" x2={x} y2={y} stroke="url(#ub-line)" strokeWidth="1.5" className="ub-system__beam" />
                {/* импульс данных между ядром и узлом */}
                <circle r="2.6" className="ub-system__packet" style={{ '--x': `${x - 200}px`, '--y': `${y - 200}px`, animationDelay: `${i * 0.6}s` } as React.CSSProperties} cx="200" cy="200" />
              </g>
            ))}
          </svg>
          <div className="ub-system__core">
            <span>UP</span>
            <small>система</small>
          </div>
          {APPROACH.map((a, i) => (
            <div key={a.key} className={`ub-node ub-glass ub-node--${i}`} onPointerMove={glow}>
              <span className="ub-edge" aria-hidden="true" />
              <p className="ub-node__title">{a.title}</p>
              <p className="ub-node__text">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Seam id="approach" delay={1.1} />

      {/* ---------------------------------------------------------- направления */}
      <section className="ub-section ub-directions" id="ub-directions" aria-labelledby="ub-dir-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>03</span> Наши направления
        </p>
        <h2 id="ub-dir-title" className="ub-h2" data-ub-reveal>
          Современные инструменты — в единой связке
        </h2>
        <ul className="ub-cards" data-ub-live="">
          {DIRECTIONS.map((d, i) => (
            <li
              key={d.title}
              className="ub-card ub-glass"
              data-ub-reveal
              style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
              onPointerMove={glow}
            >
              <span className="ub-edge" aria-hidden="true" />
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

      <Seam id="directions" delay={0.4} />

      {/* ---------------------------------------------------------- видение */}
      <section className="ub-section ub-vision" aria-labelledby="ub-vision-title">
        <p className="ub-kicker" data-ub-reveal>
          <span>04</span> Наше видение
        </p>
        <h2 id="ub-vision-title" className="ub-statement ub-statement--sm" data-ub-reveal>
          Будущее, в котором современные технологии помогают бизнесу эффективнее работать, находить новые возможности и
          масштабироваться.
        </h2>
        <ul className="ub-pillars" data-ub-live="">
          {VISION.map((v, i) => (
            <li key={v.k} className="ub-pillar" data-ub-reveal style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
              <span className="ub-pillar__k">{v.k}</span>
              <p className="ub-pillar__title">{v.title}</p>
              <p className="ub-pillar__text">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Seam id="vision" delay={0.9} />

      {/* ---------------------------------------------------------- финал */}
      <section className="ub-final" aria-labelledby="ub-final-title">
        <div className="ub-final__glow" aria-hidden="true" />
        <div className="ub-final__scene" aria-hidden="true">
          <Circuit className="ub-final__circuit" viewBox="0 0 1440 700" paths={FINAL_PATHS} nodes={FINAL_NODES} speed={4.8} />
          <span className="ub-final__ring ub-final__ring--1" />
          <span className="ub-final__ring ub-final__ring--2" />
          <span className="ub-final__ring ub-final__ring--3" />
        </div>
        <h2 id="ub-final-title" className="ub-final__title" data-ub-reveal>
          Будущее бизнеса начинается с <span>правильных решений</span>
        </h2>
        <p className="ub-p ub-final__text" data-ub-reveal>
          Расскажите о задаче — вместе определим, с каких технологий начать и как построить систему под ваш бизнес.
        </p>
        <div className="ub-hero__actions ub-final__actions" data-ub-reveal>
          <Link to={ROUTES.contact.pattern} className="ub-btn ub-btn--primary">
            Связаться с нами <span aria-hidden="true">→</span>
          </Link>
          <button type="button" className="ub-btn ub-btn--ghost" onClick={(e) => requestRealm('wc', e.currentTarget)}>
            Вернуться в WebCraft
          </button>
        </div>
      </section>

      <Footer realm="ub" />
    </main>
  )
}
