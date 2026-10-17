/**
 * Проективное преобразование прямоугольника w×h в произвольный
 * четырёхугольник (углы по часовой: TL, TR, BR, BL) в виде CSS matrix3d.
 * Плоский прямоугольник в перспективной проекции переходит в
 * четырёхугольник ровно гомографией, поэтому DOM-элемент совпадает
 * с плоскостью экрана 3D-ноутбука без искажений.
 */
export type Pt = { x: number; y: number }

export function rectToQuadMatrix3d(w: number, h: number, q: [Pt, Pt, Pt, Pt]): string {
  const [p0, p1, p2, p3] = q
  // Хекберт: единичный квадрат → четырёхугольник
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, hh: number
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x
    b = p3.x - p0.x
    c = p0.x
    d = p1.y - p0.y
    e = p3.y - p0.y
    f = p0.y
    g = 0
    hh = 0
  } else {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    hh = (dx1 * dy3 - dx3 * dy1) / det
    a = p1.x - p0.x + g * p1.x
    b = p3.x - p0.x + hh * p3.x
    c = p0.x
    d = p1.y - p0.y + g * p1.y
    e = p3.y - p0.y + hh * p3.y
    f = p0.y
  }
  // переход от единичного квадрата к прямоугольнику w×h
  a /= w
  d /= w
  g /= w
  b /= h
  e /= h
  hh /= h
  // CSS matrix3d — по столбцам
  const m = [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1]
  return `matrix3d(${m.map((v) => (Number.isFinite(v) ? +v.toFixed(8) : 0)).join(',')})`
}
