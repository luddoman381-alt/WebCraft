import { useRef } from 'react'
import { requestRealm, type Realm } from '../realm/realmBus'
import { useRealmTarget } from '../realm/realmState'

/**
 * Переключатель режимов сайта в шапке: WEBCRAFT ⇄ UPBUSINESS.
 * Сегментный элемент с подвижным светящимся «ползунком»; текущий режим выделен.
 */
export function RealmSwitch({ current: routeRealm, preview = false, busy = false }: { current: Realm; preview?: boolean; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  // во время перехода ползунок уже стоит на целевом режиме и светится
  const target = useRealmTarget()
  const current = !preview && busy && target ? target : routeRealm
  const go = (to: Realm, el: HTMLElement) => {
    if (preview || busy || to === current) return
    requestRealm(to, el)
  }
  return (
    <div
      ref={ref}
      className={`realm-switch is-${current}${busy ? ' is-busy' : ''}`}
      role={preview ? undefined : 'radiogroup'}
      aria-label={preview ? undefined : 'Режим сайта'}
    >
      <span className="realm-switch__thumb" aria-hidden="true" />
      <span className="realm-switch__pulse" aria-hidden="true" />
      {(['wc', 'ub'] as const).map((r) => (
        <button
          key={r}
          type="button"
          role={preview ? undefined : 'radio'}
          aria-checked={preview ? undefined : current === r}
          className={`realm-switch__opt realm-switch__opt--${r}${current === r ? ' is-active' : ''}`}
          tabIndex={preview ? -1 : current === r ? 0 : -1}
          onClick={(e) => go(r, e.currentTarget)}
          onKeyDown={(e) => {
            // стрелки — как у radiogroup
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault()
              const other = current === 'wc' ? 'ub' : 'wc'
              const btn = ref.current?.querySelector<HTMLElement>(`.realm-switch__opt--${other}`)
              if (btn) go(other, btn)
            }
          }}
        >
          <span className="realm-switch__dot" aria-hidden="true" />
          <span className="realm-switch__label">{r === 'wc' ? 'WEBCRAFT' : 'UPBUSINESS'}</span>
        </button>
      ))}
    </div>
  )
}
