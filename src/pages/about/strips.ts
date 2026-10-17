import * as THREE from 'three'

/*
 * Полосы трансформации. У каждой — два состояния:
 *  A — короткий отрезок контура кнопки (плоскость z = 0, лицом к камере);
 *  B — отрезок ребра закрытого ноутбука (в мировых координатах позы сборки).
 * Путь между ними — квадратичная кривая Безье через случайную точку в глубине,
 * с поворотом вокруг собственной оси: полосы «разлетаются и изгибаются».
 */

export type Strip = {
  a: THREE.Vector3
  b: THREE.Vector3
  c: THREE.Vector3
  qa: THREE.Quaternion
  qb: THREE.Quaternion
  la: number
  lb: number
  delay: number
  twistAxis: THREE.Vector3
  twist: number
}

type Seg = [THREE.Vector3, THREE.Vector3]

const X = new THREE.Vector3(1, 0, 0)

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Отрезки контура скруглённого прямоугольника w×h (радиус r) в плоскости XY. */
function roundedRectPoints(w: number, h: number, r: number, n: number): { p: THREE.Vector3; t: THREE.Vector3 }[] {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - r)
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + h)
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  const out: { p: THREE.Vector3; t: THREE.Vector3 }[] = []
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const p = shape.getPointAt(u)
    const tan = shape.getTangentAt(u)
    out.push({ p: new THREE.Vector3(p.x, p.y, 0), t: new THREE.Vector3(tan.x, tan.y, 0).normalize() })
  }
  return out
}

/** Рёбра закрытого ноутбука (локальные координаты, как в scene/Laptop). */
export function closedLaptopEdges(): Seg[] {
  const W = 3.2
  const D = 2.2
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const rect = (y: number, w: number, d: number, z0 = 0): Seg[] => {
    const a = v(-w / 2, y, -d / 2 + z0)
    const b = v(w / 2, y, -d / 2 + z0)
    const c = v(w / 2, y, d / 2 + z0)
    const e = v(-w / 2, y, d / 2 + z0)
    return [
      [a, b],
      [b, c],
      [c, e],
      [e, a],
    ]
  }
  const top = 0.19
  const segs: Seg[] = [
    ...rect(0, W, D), // дно
    ...rect(0.11, W, D), // линия разъёма корпуса и крышки
    ...rect(top, W, 2.12, -0.02), // крышка
    ...rect(top + 0.001, W - 0.4, 1.7, -0.02), // внутренний контур крышки
    // вертикальные рёбра
    [v(-W / 2, 0, -D / 2), v(-W / 2, top, -D / 2)],
    [v(W / 2, 0, -D / 2), v(W / 2, top, -D / 2)],
    [v(W / 2, 0, D / 2), v(W / 2, top, D / 2)],
    [v(-W / 2, 0, D / 2), v(-W / 2, top, D / 2)],
    // знак на крышке
    [v(0, top + 0.002, -0.24), v(0.22, top + 0.002, -0.02)],
    [v(0.22, top + 0.002, -0.02), v(0, top + 0.002, 0.2)],
    [v(0, top + 0.002, 0.2), v(-0.22, top + 0.002, -0.02)],
    [v(-0.22, top + 0.002, -0.02), v(0, top + 0.002, -0.24)],
  ]
  return segs
}

/** Распределяет n полос по рёбрам пропорционально длине. */
function sampleSegments(segs: Seg[], n: number, matrix: THREE.Matrix4) {
  const world = segs.map(([p, q]) => [p.clone().applyMatrix4(matrix), q.clone().applyMatrix4(matrix)] as Seg)
  const lens = world.map(([p, q]) => p.distanceTo(q))
  const total = lens.reduce((s, l) => s + l, 0)
  const out: { p: THREE.Vector3; t: THREE.Vector3; len: number }[] = []
  // по каждому ребру — хотя бы одна полоса
  const counts = lens.map((l) => Math.max(1, Math.round((l / total) * n)))
  let diff = counts.reduce((s, c) => s + c, 0) - n
  for (let i = 0; diff !== 0 && i < counts.length * 4; i++) {
    const j = i % counts.length
    if (diff > 0 && counts[j] > 1) {
      counts[j]--
      diff--
    } else if (diff < 0) {
      counts[j]++
      diff++
    }
  }
  world.forEach(([p, q], i) => {
    const k = counts[i]
    const dir = q.clone().sub(p).normalize()
    const step = lens[i] / k
    for (let j = 0; j < k; j++) {
      out.push({ p: p.clone().addScaledVector(dir, step * (j + 0.5)), t: dir.clone(), len: step * 0.9 })
    }
  })
  return out.slice(0, n)
}

const quatFor = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(X, dir.clone().normalize())

export function buildStrips(n: number, button: { w: number; h: number; y: number }, laptopMatrix: THREE.Matrix4): Strip[] {
  const r = rand(77)
  const border = roundedRectPoints(button.w, button.h, Math.min(button.h / 2, 0.24), n)
  const edges = sampleSegments(closedLaptopEdges(), n, laptopMatrix)
  // соседние точки контура идут на разные рёбра — полосы пересекаются в полёте
  const order = edges.map((_, i) => i).sort(() => r() - 0.5)
  const perim = 2 * (button.w + button.h)
  return border.map((bp, i) => {
    const e = edges[order[i % edges.length]]
    const a = bp.p.clone().setY(bp.p.y + button.y)
    const b = e.p.clone()
    const mid = a.clone().lerp(b, 0.5)
    const spread = 1.2 + r() * 1.8
    const c = mid.add(new THREE.Vector3((r() - 0.5) * 2 * spread, (r() - 0.35) * 1.6 * spread, 0.6 + r() * 2.4))
    return {
      a,
      b,
      c,
      qa: quatFor(bp.t),
      qb: quatFor(e.t),
      la: (perim / n) * 0.82,
      lb: e.len,
      // волна от точки нажатия: полосы справа и слева уходят чуть раньше центра
      delay: 0.32 * (1 - Math.abs(bp.p.x) / (button.w / 2)) * 0.6 + r() * 0.14,
      twistAxis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      twist: (r() - 0.5) * Math.PI * 1.6,
    }
  })
}
