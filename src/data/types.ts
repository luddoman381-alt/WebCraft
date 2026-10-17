/*
 * Модели контента. Совпадают с тем, что будет отдавать backend API
 * и редактировать админ-панель на следующих этапах.
 */

export type PublicationStatus = 'published' | 'draft' | 'archived'

export type CategoryId =
  | 'websites'
  | 'ecommerce'
  | 'catalogs'
  | 'telegram-bots'
  | 'automation'
  | 'integrations'
  | 'web-apps'
  | 'custom'

export type ServiceCategory = {
  id: CategoryId
  title: string
  /** короткое пояснение для плитки категории */
  summary: string
  order: number
}

/**
 * Цена. По умолчанию — индивидуальный расчёт: обязательных цен нет.
 * Остальные варианты поддержаны моделью и интерфейсом для будущих данных из админки.
 */
export type Price =
  | { kind: 'individual' }
  | { kind: 'fixed'; amount: number; currency: Currency }
  | { kind: 'from'; amount: number; currency: Currency }
  | { kind: 'range'; min: number; max: number; currency: Currency }

export type Currency = 'RUB' | 'KZT' | 'USD' | 'EUR'

export type PriceDisplay = {
  price: Price
  /** показывать ли цену публично; если нет — выводится «индивидуальный расчёт» */
  visible: boolean
  /** условия: «зависит от объёма каталога», «без учёта лицензий» и т.п. */
  note?: string
}

/**
 * Обложка. Пока — процедурный паттерн; поле `image` зарезервировано
 * под загруженное изображение из медиатеки.
 */
export type Cover = {
  pattern: 'grid' | 'orbit' | 'stack' | 'flow' | 'nodes' | 'bars' | 'chat' | 'spark'
  image?: { src: string; alt: string; width: number; height: number }
}

export type Seo = {
  title: string
  description: string
}

export type Service = {
  id: string
  slug: string
  title: string
  category: CategoryId
  shortDescription: string
  /** абзацы полного описания */
  fullDescription: string[]
  features: string[]
  cover: Cover
  /** id связанных услуг */
  related: string[]
  pricing: PriceDisplay
  status: PublicationStatus
  seo: Seo
  /** ручной порядок «Рекомендуемые» */
  order: number
  /** демонстрационная запись (до подключения реального контента) */
  demo: boolean
}

export type ProjectConcept = {
  id: string
  slug: string
  title: string
  summary: string
  services: string[]
  tags: string[]
  cover: Cover
  status: PublicationStatus
  /** концепт / демонстрационная запись — не реальный клиентский проект */
  kind: 'concept'
}

export type ServiceSort = 'recommended' | 'title-asc' | 'title-desc' | 'category'

export type ServiceQuery = {
  q?: string
  category?: CategoryId | null
  sort?: ServiceSort
}
