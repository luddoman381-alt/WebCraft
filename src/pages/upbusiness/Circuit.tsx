/*
 * Дорожки «печатной платы» — общий визуальный язык всего раздела UpBusiness.
 * Те же классы, что и у трасс главного экрана (ub__trace / ub__trace-pulse / ub__chip),
 * поэтому стиль и анимация импульсов описаны один раз в upbusiness.css.
 *
 * stretch — рисунок растягивается на всю ширину секции (концы дорожек совпадают
 * с боковыми шинами страницы). Чтобы при растяжении линии оставались тонкими,
 * а узлы — круглыми, используется non-scaling-stroke, а узлы и площадки рисуются
 * отрезками нулевой длины с круглым/квадратным концом.
 */

type Props = {
  className?: string
  viewBox: string
  paths: string[]
  /** индексы дорожек, по которым бегут импульсы (по умолчанию — все) */
  pulses?: number[]
  nodes?: [number, number][]
  chips?: [number, number][]
  stretch?: boolean
  /** сдвиг запуска импульсов, с — чтобы соседние блоки не мигали синхронно */
  delay?: number
  /** длительность пробега импульса, с */
  speed?: number
}

export function Circuit({ className = '', viewBox, paths, pulses, nodes = [], chips = [], stretch = false, delay = 0, speed }: Props) {
  const live = pulses ?? paths.map((_, i) => i)
  return (
    <svg
      className={`ub-circuit${stretch ? ' ub-circuit--stretch' : ''} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid slice'}
      aria-hidden="true"
      data-ub-live=""
    >
      {paths.map((d, i) => (
        <path key={i} d={d} className="ub__trace" />
      ))}
      {live.map((i, k) => (
        <path
          key={`p${i}`}
          d={paths[i]}
          className="ub__trace-pulse"
          pathLength={100}
          style={{ animationDelay: `${delay + k * 1.3}s`, animationDuration: speed ? `${speed}s` : undefined }}
        />
      ))}
      {chips.map(([x, y], i) =>
        stretch ? (
          <g key={`c${i}`}>
            <path d={`M${x} ${y}h0`} className="ub__chip-edge" />
            <path d={`M${x} ${y}h0`} className="ub__chip-core" />
          </g>
        ) : (
          <rect key={`c${i}`} x={x - 7} y={y - 7} width="14" height="14" rx="2" className="ub__chip" />
        ),
      )}
      {nodes.map(([x, y], i) => (
        <path key={`n${i}`} d={`M${x} ${y}h0`} className="ub__node" />
      ))}
    </svg>
  )
}
