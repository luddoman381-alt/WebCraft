/*
 * Модели контента — общие для сайта, админ-панели и сервера
 * (сервер импортирует этот файл только как типы).
 * Файл не должен иметь runtime-импортов.
 */

export type PublicationStatus = 'published' | 'hidden'

/** id категории — латиница, цифры и дефис (используется в URL ?category=) */
export type CategoryId = string

export type ServiceCategory = {
  id: CategoryId
  title: string
  /** короткое пояснение для плитки категории */
  summary: string
  description: string
  /** URL изображения (загруженного через админку) или null */
  image: string | null
  order: number
  /** скрытая категория и её услуги не показываются на сайте */
  hidden: boolean
}

export type Currency = 'KZT' | 'RUB' | 'USD' | 'EUR'

/** Цена. По умолчанию — индивидуальный расчёт: обязательных цен нет. */
export type Price =
  | { kind: 'individual' }
  | { kind: 'fixed'; amount: number; currency: Currency }
  | { kind: 'from'; amount: number; currency: Currency }

export type PriceDisplay = {
  price: Price
  /** показывать ли сумму публично; если нет — выводится «индивидуальный расчёт» */
  visible: boolean
  /** условия: «зависит от объёма каталога», «без учёта лицензий» и т.п. */
  note?: string
}

export type CoverPattern = 'grid' | 'orbit' | 'stack' | 'flow' | 'nodes' | 'bars' | 'chat' | 'spark'

/** Обложка: процедурный паттерн и, если загружено, изображение поверх него. */
export type Cover = {
  pattern: CoverPattern
  image?: { src: string; alt: string }
}

export type Seo = {
  title: string
  description: string
}

/** Текст терминального эффекта карточки в каталоге. */
export type TerminalInfo = {
  title: string
  /** короткие строки характеристик: «Формат: одна страница» */
  specs: string[]
  capabilities: string[]
  priceText: string
}

export type Service = {
  id: string
  slug: string
  title: string
  category: CategoryId
  shortDescription: string
  /** абзацы полного описания */
  fullDescription: string[]
  /** возможности / характеристики */
  features: string[]
  /** преимущества для клиента */
  benefits: string[]
  /** состав работ */
  deliverables: string[]
  cover: Cover
  /** id связанных услуг */
  related: string[]
  pricing: PriceDisplay
  terminal: TerminalInfo
  status: PublicationStatus
  seo: Seo
  /** порядок «Рекомендуемые» */
  order: number
  /** демонстрационная запись из первоначального наполнения */
  demo: boolean
  updatedAt?: string
}

export type Project = {
  id: string
  slug: string
  title: string
  summary: string
  services: string[]
  tags: string[]
  cover: Cover
  status: PublicationStatus
  /** concept — демонстрационный концепт, case — реальный проект */
  kind: 'concept' | 'case'
  /** ссылка на проект (для case) */
  url: string | null
  order: number
}

export type ContactLink = { label: string; url: string }

export type SiteSettings = {
  contacts: {
    email: string
    phone: string
    telegram: string
    hours: string
    address: string
    links: ContactLink[]
  }
  cta: {
    heroPrimary: string
    heroSecondary: string
    navButton: string
    catalogTitle: string
    catalogText: string
    catalogButton: string
    serviceButton: string
    contactTitle: string
    contactLead: string
    contactSubmit: string
  }
}

export type LeadStatus = 'new' | 'in_progress' | 'done' | 'spam'

export type Lead = {
  id: number
  createdAt: string
  name: string
  contact: string
  /** slug услуги, если выбрана */
  service: string | null
  message: string
  status: LeadStatus
  page: string | null
  note: string
}

export type ServiceSort = 'recommended' | 'title-asc' | 'title-desc' | 'category'

export type ServiceQuery = {
  q?: string
  category?: CategoryId | null
  sort?: ServiceSort
}

/** Ошибка API в едином формате. */
export type ApiErrorBody = {
  error: string
  message: string
  fields?: Record<string, string>
}
