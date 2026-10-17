import { hotspotEls, type HotspotId } from '../scene/hotspotBridge'
import type { FocusTarget } from '../lib/theme'

const ITEMS: { id: HotspotId; index: string; label: string; hint: string }[] = [
  { id: 'laptop', index: '01', label: 'Сайты и каталоги', hint: 'открыть каталог услуг' },
  { id: 'phone', index: '02', label: 'Мобильные решения', hint: 'приблизить смартфон' },
]

type Props = {
  hidden: boolean
  hovered: FocusTarget
  onSelect: (id: HotspotId) => void
  onHover: (id: FocusTarget) => void
}

export function Hotspots({ hidden, hovered, onSelect, onHover }: Props) {
  return (
    <div className="hotspots" aria-label="Объекты сцены" role="group">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          ref={(el) => {
            hotspotEls[it.id] = el
          }}
          type="button"
          className={`hotspot${hovered === it.id ? ' is-active' : ''}${hidden ? ' is-hidden' : ''}`}
          onClick={() => onSelect(it.id)}
          onPointerEnter={() => onHover(it.id)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(it.id)}
          onBlur={() => onHover(null)}
          tabIndex={hidden ? -1 : 0}
          aria-hidden={hidden}
          aria-label={`${it.label}: ${it.hint}`}
        >
          <span className="hotspot__dot" aria-hidden="true" />
          <span className="hotspot__text">
            <span className="hotspot__index">{it.index}</span>
            <span className="hotspot__label">{it.label}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
