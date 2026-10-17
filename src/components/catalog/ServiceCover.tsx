import type { Cover } from '../../data/types'

/**
 * Обложка услуги. Если в данных есть изображение — показываем его,
 * иначе рисуем процедурный SVG-паттерн в фирменной стилистике.
 */
export function ServiceCover({ cover, label, size = 'card' }: { cover: Cover; label?: string; size?: 'card' | 'hero' }) {
  if (cover.image) {
    return (
      <div className={`cover cover--${size}`}>
        <img src={cover.image.src} alt={cover.image.alt} width={cover.image.width} height={cover.image.height} loading="lazy" />
      </div>
    )
  }
  return (
    <div className={`cover cover--${size}`} aria-hidden="true">
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g-${cover.pattern}-${size}`} cx="70%" cy="35%" r="80%">
            <stop offset="0" stopColor="#123d26" />
            <stop offset="0.55" stopColor="#0b1410" />
            <stop offset="1" stopColor="#080b0a" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" fill={`url(#g-${cover.pattern}-${size})`} />
        <g stroke="rgba(57,255,136,0.07)" strokeWidth="1">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 32} y1="0" x2={i * 32} y2="200" />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 32} x2="320" y2={i * 32} />
          ))}
        </g>
        <Pattern kind={cover.pattern} />
      </svg>
      {label && <span className="cover__label">{label}</span>}
    </div>
  )
}

function Pattern({ kind }: { kind: Cover['pattern'] }) {
  const G = '#39FF88'
  const G2 = '#17C964'
  switch (kind) {
    case 'grid':
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => {
            const x = 150 + (i % 4) * 36
            const y = 44 + Math.floor(i / 4) * 40
            return (
              <rect key={i} x={x} y={y} width="28" height="30" rx="4" fill="none" stroke={i === 5 ? G : 'rgba(57,255,136,0.35)'} strokeWidth={i === 5 ? 2 : 1} />
            )
          })}
          <rect x="40" y="52" width="80" height="6" rx="3" fill={G} opacity="0.85" />
          <rect x="40" y="68" width="56" height="4" rx="2" fill="rgba(240,245,241,0.3)" />
          <rect x="40" y="80" width="64" height="4" rx="2" fill="rgba(240,245,241,0.2)" />
        </g>
      )
    case 'orbit':
      return (
        <g fill="none">
          <circle cx="210" cy="100" r="62" stroke="rgba(57,255,136,0.25)" />
          <circle cx="210" cy="100" r="40" stroke="rgba(57,255,136,0.4)" />
          <path d="M210 38 A62 62 0 0 1 268 120" stroke={G} strokeWidth="3" strokeLinecap="round" />
          <circle cx="210" cy="100" r="9" fill={G} />
          <circle cx="268" cy="120" r="4" fill={G2} />
        </g>
      )
    case 'stack':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={150 + i * 16} y={50 + i * 22} width="120" height="70" rx="8" fill="#0d1612" stroke={i === 2 ? G : 'rgba(57,255,136,0.3)'} strokeWidth={i === 2 ? 2 : 1} />
          ))}
          <rect x="196" y="112" width="60" height="5" rx="2.5" fill={G} />
          <rect x="196" y="124" width="40" height="4" rx="2" fill="rgba(240,245,241,0.3)" />
        </g>
      )
    case 'flow':
      return (
        <g fill="none">
          <path d="M40 140 C 110 140, 120 60, 190 60 S 270 120, 290 70" stroke={G} strokeWidth="3" strokeLinecap="round" />
          {[
            [40, 140],
            [190, 60],
            [290, 70],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 10} y={y - 10} width="20" height="20" rx="5" fill="#0d1612" stroke={G} strokeWidth="2" />
          ))}
          <path d="M40 170 H 290" stroke="rgba(57,255,136,0.2)" strokeDasharray="4 6" />
        </g>
      )
    case 'nodes':
      return (
        <g>
          {[
            [170, 60, 230, 100],
            [230, 100, 280, 60],
            [230, 100, 200, 155],
            [230, 100, 285, 150],
            [170, 60, 120, 110],
          ].map(([a, b, c, d], i) => (
            <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="rgba(57,255,136,0.45)" strokeWidth="1.5" />
          ))}
          {[
            [170, 60],
            [280, 60],
            [200, 155],
            [285, 150],
            [120, 110],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill="#0d1612" stroke={G2} strokeWidth="2" />
          ))}
          <circle cx="230" cy="100" r="12" fill={G} />
        </g>
      )
    case 'bars':
      return (
        <g>
          {[36, 58, 44, 80, 66, 104, 92, 128].map((h, i) => (
            <rect key={i} x={150 + i * 18} y={170 - h} width="11" height={h} rx="2" fill={i === 7 ? G : 'rgba(57,255,136,0.32)'} />
          ))}
          <path d="M150 120 L 186 104 L 222 112 L 258 76 L 290 58" fill="none" stroke={G} strokeWidth="2" />
        </g>
      )
    case 'chat':
      return (
        <g>
          <rect x="150" y="44" width="120" height="34" rx="12" fill="#0d1612" stroke="rgba(57,255,136,0.35)" />
          <rect x="190" y="90" width="100" height="34" rx="12" fill={G} opacity="0.9" />
          <rect x="150" y="136" width="90" height="30" rx="12" fill="#0d1612" stroke="rgba(57,255,136,0.35)" />
          <rect x="166" y="58" width="70" height="5" rx="2.5" fill="rgba(240,245,241,0.35)" />
          <rect x="206" y="104" width="60" height="5" rx="2.5" fill="#06100a" />
        </g>
      )
    default:
      return (
        <g fill="none" stroke={G} strokeLinecap="round">
          <path d="M220 40 V 160 M160 100 H 280" strokeWidth="2" opacity="0.5" />
          <path d="M178 58 L 262 142 M262 58 L 178 142" strokeWidth="1.5" opacity="0.35" />
          <circle cx="220" cy="100" r="14" fill={G} stroke="none" />
        </g>
      )
  }
}
