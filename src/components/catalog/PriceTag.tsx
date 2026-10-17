import type { Currency, PriceDisplay } from '../../data/types'

const fmt = (amount: number, currency: Currency) =>
  // narrowSymbol: «₸», «₽» вместо кодов KZT/RUB
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount)

/** Текст цены по правилам отображения. Без публичной суммы — индивидуальный расчёт. */
export function priceLabel(p: PriceDisplay): string {
  const price = p.price
  if (!p.visible || price.kind === 'individual') return 'Рассчитывается индивидуально'
  if (price.kind === 'fixed') return fmt(price.amount, price.currency)
  return `от ${fmt(price.amount, price.currency)}`
}

/** «Рассчитывается индивидуально» → «рассчитывается индивидуально» (только первая буква). */
export const priceSentence = (p: PriceDisplay) => {
  const s = priceLabel(p)
  return s.charAt(0).toLowerCase() + s.slice(1)
}

export function PriceTag({ pricing, withNote = false }: { pricing: PriceDisplay; withNote?: boolean }) {
  return (
    <span className="price">
      <span className="price__value">{priceLabel(pricing)}</span>
      {withNote && pricing.note && <span className="price__note">{pricing.note}</span>}
    </span>
  )
}
