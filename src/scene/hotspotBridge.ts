/**
 * Мост между 3D-сценой и DOM-хотспотами. Кнопки живут в обычном DOM
 * (доступны с клавиатуры и для скринридеров), а сцена каждый кадр
 * проецирует 3D-якоря на экран и двигает кнопки через transform —
 * без ре-рендеров React.
 */
export type HotspotId = 'laptop' | 'phone'

export const hotspotEls: Record<HotspotId, HTMLElement | null> = {
  laptop: null,
  phone: null,
}
