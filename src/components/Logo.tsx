export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 4h18l6 6v18H4z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M11 20l5-5-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 22h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
