import type { Currency, PriceDisplay } from '../../data/types'

const fmt = (amount: number, currency: Currency) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

/** Текст цены по правилам отображения. Без явной публичной цены — индивидуальный расчёт. */
export function priceLabel(p: PriceDisplay): string {
  if (!p.visible) return 'Индивидуальный расчёт'
  const price = p.price
  switch (price.kind) {
    case 'fixed':
      return fmt(price.amount, price.currency)
    case 'from':
      return `от ${fmt(price.amount, price.currency)}`
    case 'range':
      return `${fmt(price.min, price.currency)} – ${fmt(price.max, price.currency)}`
    default:
      return 'Индивидуальный расчёт'
  }
}

export function PriceTag({ pricing, withNote = false }: { pricing: PriceDisplay; withNote?: boolean }) {
  return (
    <span className="price">
      <span className="price__value">{priceLabel(pricing)}</span>
      {withNote && pricing.note && <span className="price__note">{pricing.note}</span>}
    </span>
  )
}
