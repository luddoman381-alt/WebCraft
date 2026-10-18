export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 4h18l6 6v18H4z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M11 20l5-5-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 22h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Знак UpBusiness: микросхема с выводами и узлом-«ядром» в центре. */
export function UbMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5v4.5M20 3.5v4.5M12 24v4.5M20 24v4.5M3.5 12h4.5M3.5 20h4.5M24 12h4.5M24 20h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 12.2l3.3 1.9v3.8L16 19.8l-3.3-1.9v-3.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" />
    </svg>
  )
}
