/*
 * «Цифровое поглощение»: переход между режимами WebCraft ⇄ UpBusiness на Canvas 2D.
 *
 * Время t (мс) — единственный вход: каждый кадр рисуется заново из t,
 * поэтому нет накопленного состояния, рывков и «хвостов» после окончания.
 *
 *  в UpBusiness (≈2.3 с):
 *   0     импульс по шапке и кольцо из точки переключателя, зелёный уходит в холодный синий
 *   120   из переключателя вырываются переливающиеся световые ленты, изгибаются и переплетаются
 *   300   прорастают трассы печатной платы: узлы, микрочипы, бегущие импульсы данных
 *   150   частицы закручиваются в поток — система «втягивает» интерфейс
 *   650   туннель из технологических рамок: движение внутрь светящегося пространства
 *   1050  под непрозрачной пеленой меняется страница
 *   1150  частицы собираются в логотип UPBUSINESS точно на месте заголовка новой страницы
 *   1750  пелена растворяется — открывается среда UpBusiness
 *
 *  в WebCraft (≈1.8 с) — зеркально: потоки сворачиваются в переключатель, вспыхивает зелёный.
 */

export type Dir = 'toUB' | 'toWC'

export const DURATION: Record<Dir, number> = { toUB: 2300, toWC: 1800 }
export const SWAP_AT: Record<Dir, number> = { toUB: 1050, toWC: 720 }
export const REDUCED = { total: 520, swap: 220 }

type RGB = [number, number, number]
const GREEN: RGB = [57, 255, 136]
const BLUE: RGB = [77, 163, 255]
const ICE: RGB = [170, 228, 255]
const VIOLET: RGB = [124, 132, 255]
const UB_BG: RGB = [3, 6, 14]
const WC_BG: RGB = [8, 11, 10]

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** плавная ступень между a и b (мс) */
const step = (t: number, a: number, b: number) => {
  const x = clamp01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

type Ribbon = { exit: [number, number]; a1: number; a2: number; r1: number; r2: number; color: RGB; width: number; delay: number; speed: number; wob: number }
type Trace = { pts: [number, number][]; len: number; delay: number; dur: number; chip: boolean }

export type FxOptions = { lowPower: boolean }

export class RealmFx {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private dir: Dir
  private origin: { x: number; y: number }
  private ribbons: Ribbon[] = []
  private traces: Trace[] = []
  private n: number
  private px: Float32Array // исходные полярные параметры частиц
  private tx: Float32Array | null = null // цели в логотипе
  private ty: Float32Array | null = null
  private logo: { x: number; y: number; w: number; h: number; font: string } | null = null
  private navH: number
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, dir: Dir, origin: { x: number; y: number }, opts: FxOptions) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.dir = dir
    this.origin = origin
    this.n = opts.lowPower ? 220 : 520
    this.px = new Float32Array(this.n * 4)
    this.navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76
    this.dpr = Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 1.5)
    this.resize()
    this.build(opts.lowPower)
  }

  resize() {
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.canvas.style.width = `${this.w}px`
    this.canvas.style.height = `${this.h}px`
  }

  private build(low: boolean) {
    const r = rng(this.dir === 'toUB' ? 2026 : 77)
    const { w, h } = this
    const diag = Math.hypot(w, h)
    const palette: RGB[] = [BLUE, ICE, VIOLET, [90, 200, 255]]
    // ленты: из точки переключателя к краям экрана
    const nr = low ? 7 : 13
    for (let i = 0; i < nr; i++) {
      const ang = (i / nr) * Math.PI * 2 + r() * 0.6
      this.ribbons.push({
        exit: [w / 2 + Math.cos(ang) * diag * 0.75, h / 2 + Math.sin(ang) * diag * 0.75],
        a1: ang + (r() - 0.5) * 2.2,
        a2: ang + Math.PI + (r() - 0.5) * 2.2,
        r1: diag * (0.25 + r() * 0.3),
        r2: diag * (0.2 + r() * 0.3),
        color: palette[i % palette.length],
        width: 1.2 + r() * 3.4,
        delay: r() * 260,
        speed: 0.85 + r() * 0.5,
        wob: 0.6 + r() * 1.2,
      })
    }
    // трассы печатной платы: от краёв к центру по сетке
    const grid = 26
    const nt = low ? 18 : 38
    const cx = w / 2
    const cy = h / 2
    for (let i = 0; i < nt; i++) {
      const side = Math.floor(r() * 4)
      let x = side === 0 ? 0 : side === 1 ? w : r() * w
      let y = side === 2 ? 0 : side === 3 ? h : r() * h
      x = Math.round(x / grid) * grid
      y = Math.round(y / grid) * grid
      const pts: [number, number][] = [[x, y]]
      let horiz = side < 2
      const segs = 4 + Math.floor(r() * 6)
      for (let s = 0; s < segs; s++) {
        const cells = 2 + Math.floor(r() * 5)
        if (horiz) x += Math.sign(cx - x || 1) * cells * grid
        else y += Math.sign(cy - y || 1) * cells * grid
        pts.push([x, y])
        horiz = !horiz
        if (Math.hypot(cx - x, cy - y) < Math.min(w, h) * 0.16) break
      }
      let len = 0
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
      this.traces.push({ pts, len, delay: r() * 420, dur: 520 + r() * 420, chip: r() < 0.35 })
    }
    // частицы: угол, радиус, скорость вращения, размер
    for (let i = 0; i < this.n; i++) {
      this.px[i * 4] = r() * Math.PI * 2
      this.px[i * 4 + 1] = 0.25 + r() * 0.9
      this.px[i * 4 + 2] = 0.6 + r() * 1.6
      this.px[i * 4 + 3] = 1 + r() * 2.2
    }
  }

  /** Цель логотипа — заголовок новой страницы (берётся после смены маршрута). */
  setLogoTarget(el: Element | null) {
    if (this.logo || this.dir !== 'toUB') return
    const { w, h } = this
    let x = w / 2
    let y = h * 0.42
    let fs = Math.min(140, w * 0.12)
    let font = `700 ${fs}px "Space Grotesk", sans-serif`
    if (el) {
      const rect = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      fs = parseFloat(cs.fontSize)
      font = `700 ${fs}px "Space Grotesk", sans-serif`
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    }
    // точки логотипа — из маски текста
    const off = document.createElement('canvas')
    const ow = Math.ceil(Math.min(w, fs * 7))
    const oh = Math.ceil(fs * 1.3)
    off.width = ow
    off.height = oh
    const o = off.getContext('2d', { willReadFrequently: true })!
    o.font = font
    o.textAlign = 'center'
    o.textBaseline = 'middle'
    o.fillStyle = '#fff'
    o.fillText('UPBUSINESS', ow / 2, oh / 2)
    const data = o.getImageData(0, 0, ow, oh).data
    const cand: number[] = []
    const stride = Math.max(2, Math.round(fs / 34))
    for (let yy = 0; yy < oh; yy += stride) {
      for (let xx = 0; xx < ow; xx += stride) if (data[(yy * ow + xx) * 4 + 3] > 140) cand.push(xx, yy)
    }
    const r = rng(9)
    this.tx = new Float32Array(this.n)
    this.ty = new Float32Array(this.n)
    const count = cand.length / 2
    for (let i = 0; i < this.n; i++) {
      const k = count ? Math.floor(r() * count) : 0
      this.tx[i] = x - ow / 2 + (cand[k * 2] ?? ow / 2)
      this.ty[i] = y - oh / 2 + (cand[k * 2 + 1] ?? oh / 2)
    }
    this.logo = { x, y, w: ow, h: oh, font }
  }

  /* -------------------------------------------------------------- кадр */

  frame(t: number) {
    const { ctx, w, h, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (this.dir === 'toUB') this.frameToUB(t)
    else this.frameToWC(t)
  }

  private veil(color: RGB, a: number) {
    if (a <= 0) return
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.fillStyle = rgba(color, a)
    this.ctx.fillRect(0, 0, this.w, this.h)
  }

  private frameToUB(t: number) {
    const { ctx, w, h } = this
    // цвет системы: зелёный → электрический синий → ледяной голубой
    const hue = mix(mix(GREEN, BLUE, step(t, 0, 520)), ICE, step(t, 900, 1500) * 0.35)

    // пелена: сначала глубина нарастает, после смены страницы — растворяется
    const veilA = step(t, 380, 1000) * (1 - step(t, 1750, 2300))
    this.veil(UB_BG, veilA)

    ctx.globalCompositeOperation = 'lighter'

    // 1. активация: импульс по нижней кромке шапки и кольцо из переключателя
    this.navPulse(t, 0, 520, hue)
    this.ring(t, 0, 700, Math.hypot(w, h) * 0.55, hue, 0.9)

    // 2. туннель — движение внутрь
    const tunnelA = step(t, 620, 900) * (1 - step(t, 1350, 1750))
    if (tunnelA > 0) this.tunnel(t, tunnelA, 1, hue)

    // 3. световые ленты
    const ribA = 1 - step(t, 1250, 1700)
    if (ribA > 0) this.drawRibbons(t, 120, ribA, 1)

    // 4. микросхемы
    const trA = step(t, 250, 500) * (1 - step(t, 1300, 1700))
    if (trA > 0) this.drawTraces(t, 300, trA, hue)

    // 5. частицы: вихрь → логотип
    this.particlesToUB(t, hue)

    // 6. логотип из частиц проявляется цельным свечением и уступает настоящему заголовку
    if (this.logo) {
      const la = step(t, 1450, 1800) * (1 - step(t, 1900, 2250))
      if (la > 0) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.font = this.logo.font
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.save()
        ctx.shadowColor = rgba(BLUE, 0.9)
        ctx.shadowBlur = 34
        const g = ctx.createLinearGradient(0, this.logo.y - this.logo.h / 2, 0, this.logo.y + this.logo.h / 2)
        g.addColorStop(0, rgba([255, 255, 255], la))
        g.addColorStop(0.55, rgba([169, 216, 255], la))
        g.addColorStop(1, rgba([61, 139, 255], la))
        ctx.fillStyle = g
        ctx.fillText('UPBUSINESS', this.logo.x, this.logo.y)
        ctx.restore()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private frameToWC(t: number) {
    const { ctx, w, h, origin } = this
    const hue = mix(ICE, mix(BLUE, GREEN, step(t, 350, 1000)), step(t, 0, 300))
    // до смены страницы — синяя глубина, после — зелёная тьма WebCraft
    const before = t < SWAP_AT.toWC
    const veilA = before ? step(t, 120, 640) : 1 - step(t, 1100, 1800)
    this.veil(before ? UB_BG : WC_BG, veilA)

    ctx.globalCompositeOperation = 'lighter'
    this.navPulse(t, 0, 420, BLUE)
    // туннель в обратную сторону — выход наружу
    const tunnelA = step(t, 80, 300) * (1 - step(t, 600, 900))
    if (tunnelA > 0) this.tunnel(t, tunnelA, -1, BLUE)
    // ленты сворачиваются в переключатель
    const ribA = 1 - step(t, 620, 820)
    if (ribA > 0) this.drawRibbons(t, 0, ribA, -1)
    // частицы втягиваются в точку переключателя
    this.particlesCollapse(t, hue)
    // вспышка зелёного: кольцо и короткие трассы — система WebCraft восстанавливается
    if (t > SWAP_AT.toWC - 40) {
      this.ring(t, SWAP_AT.toWC - 40, 1500, Math.hypot(w, h) * 0.7, GREEN, 0.75)
      const trA = step(t, 760, 900) * (1 - step(t, 1150, 1500))
      if (trA > 0) this.drawTraces(t, 760, trA * 0.7, GREEN, 0.55)
      const glow = step(t, 720, 900) * (1 - step(t, 1100, 1700))
      if (glow > 0) {
        const g = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, Math.hypot(w, h) * 0.6)
        g.addColorStop(0, rgba(GREEN, 0.28 * glow))
        g.addColorStop(1, rgba(GREEN, 0))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  /* -------------------------------------------------------------- слои */

  private navPulse(t: number, a: number, b: number, c: RGB) {
    const k = clamp01((t - a) / (b - a))
    if (k <= 0 || k >= 1) return
    const { ctx, w, origin } = this
    const y = Math.min(this.navH, origin.y + 26)
    const span = w * easeInOut(k)
    const alpha = 1 - k
    for (const dirX of [-1, 1]) {
      const x0 = origin.x
      const x1 = origin.x + dirX * span
      const g = ctx.createLinearGradient(x0, y, x1, y)
      g.addColorStop(0, rgba(c, 0))
      g.addColorStop(0.85, rgba(c, 0.9 * alpha))
      g.addColorStop(1, rgba(ICE, alpha))
      ctx.strokeStyle = g
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
    }
  }

  private ring(t: number, a: number, b: number, maxR: number, c: RGB, strength: number) {
    const k = clamp01((t - a) / (b - a))
    if (k <= 0 || k >= 1) return
    const { ctx, origin } = this
    const rr = maxR * easeInOut(k)
    ctx.strokeStyle = rgba(c, strength * (1 - k))
    ctx.lineWidth = 2 + 10 * (1 - k)
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, rr, 0, Math.PI * 2)
    ctx.stroke()
  }

  /** Рамки с «контактами» по краям, летящие на зрителя (dir 1) или от него (−1). */
  private tunnel(t: number, alpha: number, dir: 1 | -1, c: RGB) {
    const { ctx, w, h } = this
    const cx = w / 2
    const cy = h / 2
    const N = 9
    for (let i = 0; i < N; i++) {
      let z = (i / N + (dir * t) / 1400) % 1
      if (z < 0) z += 1
      // перспектива: рамка растёт с ускорением по мере приближения
      const s = Math.pow(z, 2.2) * 1.6 + 0.04
      const rw = w * s
      const rh = h * s
      const a = alpha * Math.sin(Math.PI * z) * 0.75
      if (a <= 0.01) continue
      const rot = (1 - z) * 0.18 * dir
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.strokeStyle = rgba(i % 3 === 0 ? ICE : c, a)
      ctx.lineWidth = 1 + z * 2.5
      const rad = Math.min(rw, rh) * 0.06
      ctx.beginPath()
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, rad)
      ctx.stroke()
      // засечки-контакты, как на краю микросхемы
      ctx.fillStyle = rgba(ICE, a)
      const pins = 10
      for (let p = 1; p < pins; p++) {
        const px = -rw / 2 + (rw * p) / pins
        ctx.fillRect(px - 1, -rh / 2 - 4 * z, 2, 8 * z + 1)
        ctx.fillRect(px - 1, rh / 2 - 4 * z, 2, 8 * z + 1)
      }
      ctx.restore()
    }
    // радиальные линии скорости
    const lines = 28
    ctx.lineWidth = 1
    for (let i = 0; i < lines; i++) {
      const ang = (i / lines) * Math.PI * 2 + 0.3
      const k = ((t / 900 + i * 0.137) % 1) * (dir === 1 ? 1 : -1)
      const kk = k < 0 ? 1 + k : k
      const r0 = Math.hypot(w, h) * (0.1 + kk * 0.5)
      const r1 = r0 + 60 + kk * 160
      ctx.strokeStyle = rgba(c, alpha * 0.35 * Math.sin(Math.PI * kk))
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0)
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
      ctx.stroke()
    }
  }

  /** Световые ленты по кубическим кривым; dir −1 — сворачивание обратно в переключатель. */
  private drawRibbons(t: number, start: number, alpha: number, dir: 1 | -1) {
    const { ctx, origin } = this
    const S = 44
    for (const rb of this.ribbons) {
      const local = (t - start - rb.delay) * rb.speed
      // голова ленты: от переключателя к краю (или обратно)
      let head = clamp01(local / 900)
      if (dir === -1) head = 1 - clamp01(local / 650)
      if (head <= 0) continue
      const tail = Math.max(0, head - 0.55)
      // контрольные точки медленно вращаются — ленты изгибаются и переплетаются
      const wob = Math.sin(t / 400 + rb.wob * 3) * 0.35 * rb.wob
      const p0x = origin.x
      const p0y = origin.y
      const p1x = origin.x + Math.cos(rb.a1 + wob) * rb.r1
      const p1y = origin.y + Math.sin(rb.a1 + wob) * rb.r1
      const p2x = rb.exit[0] + Math.cos(rb.a2 - wob) * rb.r2
      const p2y = rb.exit[1] + Math.sin(rb.a2 - wob) * rb.r2
      const [p3x, p3y] = rb.exit
      const pt = (u: number): [number, number] => {
        const v = 1 - u
        return [
          v * v * v * p0x + 3 * v * v * u * p1x + 3 * v * u * u * p2x + u * u * u * p3x,
          v * v * v * p0y + 3 * v * v * u * p1y + 3 * v * u * u * p2y + u * u * u * p3y,
        ]
      }
      const i0 = Math.floor(tail * S)
      const i1 = Math.ceil(head * S)
      // переливание: к голове ярче и светлее
      for (let i = i0; i < i1; i += 3) {
        const k = (i - i0) / Math.max(1, i1 - i0)
        const a = alpha * (0.15 + 0.85 * k)
        const c = mix(rb.color, ICE, k * 0.6)
        ctx.strokeStyle = rgba(c, a)
        ctx.lineWidth = rb.width * (0.4 + k)
        ctx.beginPath()
        let [x, y] = pt(i / S)
        ctx.moveTo(x, y)
        for (let j = 1; j <= 3 && i + j <= i1; j++) {
          ;[x, y] = pt((i + j) / S)
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      // мягкое гало у головы
      const [hx, hy] = pt(head)
      ctx.fillStyle = rgba(ICE, 0.5 * alpha)
      ctx.beginPath()
      ctx.arc(hx, hy, rb.width * 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawTraces(t: number, start: number, alpha: number, c: RGB, scale = 1) {
    const { ctx } = this
    ctx.lineWidth = 1.2
    for (const tr of this.traces) {
      const p = clamp01((t - start - tr.delay * scale) / (tr.dur * scale))
      if (p <= 0) continue
      let remain = tr.len * easeInOut(p)
      ctx.strokeStyle = rgba(c, 0.55 * alpha)
      ctx.beginPath()
      ctx.moveTo(tr.pts[0][0], tr.pts[0][1])
      let headX = tr.pts[0][0]
      let headY = tr.pts[0][1]
      for (let k = 1; k < tr.pts.length && remain > 0; k++) {
        const [ax, ay] = tr.pts[k - 1]
        const [bx, by] = tr.pts[k]
        const seg = Math.hypot(bx - ax, by - ay)
        const f = Math.min(1, remain / seg)
        headX = ax + (bx - ax) * f
        headY = ay + (by - ay) * f
        ctx.lineTo(headX, headY)
        remain -= seg
      }
      ctx.stroke()
      // узлы на изломах
      ctx.fillStyle = rgba(c, 0.8 * alpha)
      let walked = 0
      const drawn = tr.len * easeInOut(p)
      for (let k = 1; k < tr.pts.length; k++) {
        walked += Math.hypot(tr.pts[k][0] - tr.pts[k - 1][0], tr.pts[k][1] - tr.pts[k - 1][1])
        if (walked > drawn) break
        ctx.fillRect(tr.pts[k][0] - 2, tr.pts[k][1] - 2, 4, 4)
      }
      // импульс данных бежит по трассе
      const pulse = (t / 600 + tr.delay / 400) % 1
      if (p > 0.2) {
        let d = drawn * pulse
        for (let k = 1; k < tr.pts.length; k++) {
          const [ax, ay] = tr.pts[k - 1]
          const [bx, by] = tr.pts[k]
          const seg = Math.hypot(bx - ax, by - ay)
          if (d <= seg) {
            const x = ax + ((bx - ax) * d) / seg
            const y = ay + ((by - ay) * d) / seg
            ctx.fillStyle = rgba(ICE, alpha)
            ctx.beginPath()
            ctx.arc(x, y, 2.4, 0, Math.PI * 2)
            ctx.fill()
            break
          }
          d -= seg
        }
      }
      // микрочип в конце трассы
      if (tr.chip && p >= 1) {
        const [ex, ey] = tr.pts[tr.pts.length - 1]
        ctx.strokeStyle = rgba(ICE, 0.7 * alpha)
        ctx.strokeRect(ex - 9, ey - 9, 18, 18)
        ctx.fillStyle = rgba(c, 0.6 * alpha)
        for (let q = -6; q <= 6; q += 6) {
          ctx.fillRect(ex + q - 1, ey - 13, 2, 4)
          ctx.fillRect(ex + q - 1, ey + 9, 2, 4)
        }
      }
    }
  }

  private particlesToUB(t: number, c: RGB) {
    const { ctx, w, h } = this
    const appear = step(t, 150, 450)
    if (appear <= 0) return
    // после смены страницы частицы уходят в логотип
    const toLogo = this.tx ? easeInOut(step(t, 1150, 1700)) : 0
    const fade = 1 - step(t, 1850, 2250)
    const cx = w / 2
    const cy = h / 2
    const R = Math.hypot(w, h) * 0.55
    for (let i = 0; i < this.n; i++) {
      const a0 = this.px[i * 4]
      const r0 = this.px[i * 4 + 1]
      const sp = this.px[i * 4 + 2]
      const size = this.px[i * 4 + 3]
      // вихрь: радиус сжимается, угол растёт — поток «втягивается» в центр
      const k = clamp01((t - 150) / 1100)
      const rad = R * r0 * (1 - 0.72 * easeInOut(k))
      const ang = a0 + sp * (t / 1000) * 2.2
      let x = cx + Math.cos(ang) * rad
      let y = cy + Math.sin(ang) * rad * 0.62
      if (toLogo > 0 && this.tx && this.ty) {
        x += (this.tx[i] - x) * toLogo
        y += (this.ty[i] - y) * toLogo
      }
      const a = appear * fade * (0.45 + 0.55 * ((i * 7) % 10) / 10)
      ctx.fillStyle = rgba(i % 5 === 0 ? ICE : c, a)
      const s = size * (1 - toLogo * 0.35)
      ctx.fillRect(x - s / 2, y - s / 2, s, s)
    }
  }

  private particlesCollapse(t: number, c: RGB) {
    const { ctx, w, h, origin } = this
    const k = easeInOut(clamp01(t / 760))
    if (k >= 1) return
    const R = Math.hypot(w, h) * 0.6
    for (let i = 0; i < this.n; i++) {
      const a0 = this.px[i * 4]
      const r0 = this.px[i * 4 + 1]
      const sp = this.px[i * 4 + 2]
      const ang = a0 - sp * (t / 1000) * 2.6
      const rad = R * r0 * (1 - k)
      const x = origin.x + Math.cos(ang) * rad
      const y = origin.y + Math.sin(ang) * rad
      ctx.fillStyle = rgba(c, (1 - k) * 0.8)
      const s = this.px[i * 4 + 3]
      ctx.fillRect(x - s / 2, y - s / 2, s, s)
    }
  }
}
