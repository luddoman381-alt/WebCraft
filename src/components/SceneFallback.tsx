/**
 * Статичная замена 3D-сцены для устройств без WebGL или при ошибке рендера.
 * Повторяет композицию (ноутбук + смартфон) средствами CSS — интерфейс
 * остаётся полностью рабочим.
 */
export function SceneFallback({ reason, onSelect }: { reason: 'unsupported' | 'error'; onSelect: (t: 'laptop' | 'phone') => void }) {
  return (
    <div className="fallback" aria-label="Статичная версия сцены">
      <div className="fallback__glow" aria-hidden="true" />
      <div className="fallback__grid" aria-hidden="true" />
      <div className="fallback__stage">
        <button type="button" className="fallback__laptop" onClick={() => onSelect('laptop')} aria-label="Сайты и каталоги: подробнее">
          <span className="fallback__screen">
            <span className="fallback__code">
              <i style={{ width: '62%' }} />
              <i style={{ width: '38%' }} />
              <i style={{ width: '74%' }} />
              <i style={{ width: '46%' }} />
              <i style={{ width: '58%' }} />
            </span>
          </span>
          <span className="fallback__base" />
        </button>
        <button type="button" className="fallback__phone" onClick={() => onSelect('phone')} aria-label="Мобильные решения: подробнее">
          <span className="fallback__phone-screen">
            <span className="fallback__ring" />
          </span>
        </button>
      </div>
      <p className="fallback__note">
        {reason === 'unsupported'
          ? 'Упрощённый режим: устройство не поддерживает WebGL'
          : 'Упрощённый режим: 3D-сцену не удалось запустить'}
      </p>
    </div>
  )
}
