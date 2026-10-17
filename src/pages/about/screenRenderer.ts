import * as THREE from 'three'
import { FINAL_BLINK, PAGE_FADE, layoutTerminal, type LineKind, type TerminalLayout } from './script'

/*
 * Изображение экрана 3D-ноутбука: заставка WebCraft и терминал.
 * Рисуется в 2D-canvas 16:10 и используется как текстура плоскости экрана —
 * всё происходит внутри сцены, а не поверх сайта.
 */

export const SCREEN_W = 1600
export const SCREEN_H = 1000

const BG = '#020403'
const GREEN = '#39FF88'

/** Длительности заставки, мс */
export const SPLASH = { black: 380, scan: 760, logo: 950, sub: 1500, holdEnd: 3500, total: 4050 }
export const SPLASH_REDUCED = { black: 120, scan: 0, logo: 200, sub: 300, holdEnd: 2000, total: 2350 }

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** Знак WebCraft — тот же контур, что в LogoMark (viewBox 32×32). */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(4, 4)
  ctx.lineTo(22, 4)
  ctx.lineTo(28, 10)
  ctx.lineTo(28, 28)
  ctx.lineTo(4, 28)
  ctx.closePath()
  ctx.moveTo(11, 20)
  ctx.lineTo(16, 15)
  ctx.lineTo(11, 10)
  ctx.moveTo(18, 22)
  ctx.lineTo(24, 22)
  ctx.stroke()
  ctx.restore()
}

type Style = { color: string; glow: number; weight: number; family: 'mono' | 'display' }
const STYLES: Record<LineKind, Style> = {
  prompt: { color: GREEN, glow: 10, weight: 500, family: 'mono' },
  title: { color: '#7dffb3', glow: 16, weight: 600, family: 'mono' },
  text: { color: '#cfeedd', glow: 0, weight: 400, family: 'mono' },
  section: { color: GREEN, glow: 12, weight: 600, family: 'mono' },
  final: { color: '#9dffc6', glow: 14, weight: 500, family: 'mono' },
  blank: { color: GREEN, glow: 0, weight: 400, family: 'mono' },
}

export class ScreenRenderer {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private ctx: CanvasRenderingContext2D
  private layout: TerminalLayout | null = null
  private fontPx = 40
  private lastKey = ''
  private compact = false
  private reduced = false

  constructor(anisotropy: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = SCREEN_W
    this.canvas.height = SCREEN_H
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = anisotropy
    this.clear()
  }

  dispose() {
    this.texture.dispose()
  }

  /**
   * Размер шрифта — от реальной ширины экрана ноутбука в кадре: текст на экране
   * получается ~15–16 px и на мониторе, и на телефоне (на узких — меньше строк на экран).
   */
  configure(screenPx: number, reduced: boolean) {
    const fontPx = Math.round(Math.min(64, Math.max(34, (16 * SCREEN_W) / Math.max(1, screenPx))))
    if (Math.abs(fontPx - this.fontPx) < 2 && reduced === this.reduced && this.layout) return
    this.fontPx = fontPx
    this.compact = fontPx >= 52
    this.reduced = reduced
    const pad = this.pad()
    const maxWidth = SCREEN_W - pad.x * 2
    const rows = Math.floor((SCREEN_H - pad.top - pad.bottom) / this.lineH())
    this.layout = layoutTerminal(maxWidth - this.fontPx, rows, (t, kind) => this.measure(t, kind), reduced)
  }

  get splashTotal() {
    return (this.reduced ? SPLASH_REDUCED : SPLASH).total
  }
  get terminalTotal() {
    return this.layout?.total ?? 0
  }

  private pad() {
    return { x: this.compact ? 80 : 96, top: this.compact ? 150 : 140, bottom: this.compact ? 70 : 80 }
  }
  private lineH() {
    return Math.round(this.fontPx * 1.48)
  }
  private font(kind: LineKind) {
    const s = STYLES[kind]
    const fam = s.family === 'mono' ? '"JetBrains Mono", ui-monospace, monospace' : '"Space Grotesk", sans-serif'
    return `${s.weight} ${this.fontPx}px ${fam}`
  }
  private measure(text: string, kind: LineKind) {
    this.ctx.font = this.font(kind)
    return this.ctx.measureText(text).width
  }

  clear() {
    if (this.lastKey === 'clear') return
    const ctx = this.ctx
    ctx.globalAlpha = 1
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    this.texture.needsUpdate = true
    this.lastKey = 'clear'
  }

  private background(alpha = 1) {
    const ctx = this.ctx
    ctx.globalAlpha = 1
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    if (alpha <= 0) return
    ctx.globalAlpha = alpha
    const g = ctx.createRadialGradient(SCREEN_W * 0.5, SCREEN_H * 0.45, 40, SCREEN_W * 0.5, SCREEN_H * 0.5, SCREEN_W * 0.75)
    g.addColorStop(0, 'rgba(23, 70, 40, 0.55)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    // тонкие строки развёртки
    ctx.fillStyle = 'rgba(57, 255, 136, 0.022)'
    for (let y = 0; y < SCREEN_H; y += 6) ctx.fillRect(0, y, SCREEN_W, 2)
    ctx.globalAlpha = 1
  }

  /* ---------------------------------------------------------------- заставка */

  drawSplash(t: number) {
    const S = this.reduced ? SPLASH_REDUCED : SPLASH
    const ctx = this.ctx
    const fadeOut = 1 - smooth((t - S.holdEnd) / (S.total - S.holdEnd))
    this.background(smooth((t - S.black) / 600) * fadeOut)

    // 1. световая линия запуска системы — сверху вниз
    if (S.scan > 0 && t > S.black && t < S.black + S.scan + 200) {
      const p = smooth((t - S.black) / S.scan)
      const y = p * SCREEN_H
      const a = 1 - smooth((t - S.black - S.scan) / 200)
      const trail = ctx.createLinearGradient(0, y - 220, 0, y)
      trail.addColorStop(0, 'rgba(57,255,136,0)')
      trail.addColorStop(1, `rgba(57,255,136,${0.16 * a})`)
      ctx.fillStyle = trail
      ctx.fillRect(0, y - 220, SCREEN_W, 220)
      ctx.save()
      ctx.shadowColor = GREEN
      ctx.shadowBlur = 24
      ctx.fillStyle = `rgba(190,255,215,${a})`
      ctx.fillRect(0, y - 2, SCREEN_W, 3)
      ctx.restore()
    }

    // 2. логотип с цифровым проявлением
    const logoA = smooth((t - S.logo) / 650) * fadeOut
    const cx = SCREEN_W / 2
    const cy = SCREEN_H * 0.45
    if (logoA > 0) {
      const glitch = this.reduced ? 0 : Math.max(0, 1 - (t - S.logo) / 700)
      ctx.font = `600 ${this.compact ? 150 : 132}px "Space Grotesk", sans-serif`
      ctx.textBaseline = 'middle'
      const text = 'WebCraft'
      const tw = ctx.measureText(text).width
      const mark = this.compact ? 120 : 104
      const gap = 36
      const total = mark + gap + tw
      const x0 = cx - total / 2
      const bands = 7
      const bandH = 240 / bands
      for (let b = 0; b < bands; b++) {
        // горизонтальные полосы со смещением — короткий «цифровой» эффект проявления
        const off = glitch > 0 ? Math.sin(t * 0.09 + b * 2.7) * 26 * glitch * (b % 2 ? 1 : -1) : 0
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, cy - 120 + b * bandH, SCREEN_W, bandH + 1)
        ctx.clip()
        ctx.globalAlpha = logoA * (glitch > 0 && Math.sin(t * 0.21 + b) > 0.82 ? 0.45 : 1)
        ctx.shadowColor = GREEN
        ctx.shadowBlur = 36 * logoA
        ctx.strokeStyle = GREEN
        drawMark(ctx, x0 + off, cy - mark / 2, mark)
        ctx.fillStyle = '#eafff2'
        ctx.fillText(text, x0 + mark + gap + off, cy + 6)
        ctx.restore()
      }
    }

    // 3. подпись
    const subA = smooth((t - S.sub) / 500) * fadeOut
    if (subA > 0) {
      const sub = 'DIGITAL SYSTEMS / EST. 2026'
      const shown = this.reduced ? sub.length : Math.min(sub.length, Math.floor(((t - S.sub) / 520) * sub.length))
      ctx.globalAlpha = subA
      ctx.font = `500 ${this.compact ? 40 : 30}px "JetBrains Mono", monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(146, 220, 175, 0.9)'
      // разрядка для «системного» вида
      ctx.letterSpacing = this.compact ? '10px' : '12px'
      ctx.fillText(sub.slice(0, shown), cx, cy + (this.compact ? 150 : 135))
      ctx.letterSpacing = '0px'
      ctx.textAlign = 'left'
      // индикатор завершения загрузки
      const barW = this.compact ? 560 : 420
      const p = smooth((t - S.sub - 300) / (S.holdEnd - S.sub - 500))
      ctx.fillStyle = 'rgba(57,255,136,0.14)'
      ctx.fillRect(cx - barW / 2, cy + 215, barW, 3)
      ctx.save()
      ctx.shadowColor = GREEN
      ctx.shadowBlur = 12
      ctx.fillStyle = GREEN
      ctx.fillRect(cx - barW / 2, cy + 215, barW * p, 3)
      ctx.restore()
      ctx.globalAlpha = 1
    }
    this.texture.needsUpdate = true
    this.lastKey = 'splash'
  }

  /* ---------------------------------------------------------------- терминал */

  drawTerminal(t: number) {
    const L = this.layout
    if (!L) return
    const pages = L.pages
    let pi = 0
    for (let i = 0; i < pages.length; i++) if (pages[i].start <= t) pi = i
    const page = pages[pi]
    const isLast = pi === pages.length - 1
    // экран плавно гаснет перед следующим
    const fade = !isLast && t > page.end ? 1 - smooth((t - page.end) / PAGE_FADE) : smooth((t - page.start) / 220)
    const blinkOn = Math.floor(t / 530) % 2 === 0

    // видимые символы по строкам
    const counts = page.times.map((ts) => {
      let n = 0
      while (n < ts.length && ts[n] <= t) n++
      return n
    })
    const key = `${pi}|${counts.join(',')}|${blinkOn}|${Math.round(fade * 20)}`
    if (key === this.lastKey) return
    this.lastKey = key

    const ctx = this.ctx
    this.background(1)
    const pad = this.pad()

    // шапка окна
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(57,255,136,0.07)'
    ctx.fillRect(0, 0, SCREEN_W, this.compact ? 96 : 84)
    ctx.fillStyle = 'rgba(57,255,136,0.25)'
    ctx.fillRect(0, this.compact ? 96 : 84, SCREEN_W, 2)
    ctx.strokeStyle = GREEN
    drawMark(ctx, pad.x - 6, this.compact ? 26 : 22, this.compact ? 44 : 40)
    ctx.font = `500 ${this.compact ? 32 : 26}px "JetBrains Mono", monospace`
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(207,238,221,0.75)'
    ctx.fillText('WEBCRAFT SYSTEM', pad.x + 56, this.compact ? 48 : 42)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(57,255,136,0.7)'
    ctx.fillText(`${String(pi + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`, SCREEN_W - pad.x, this.compact ? 48 : 42)
    ctx.textAlign = 'left'

    // строки
    ctx.globalAlpha = fade
    const lh = this.lineH()
    page.rows.forEach((row, ri) => {
      const n = counts[ri]
      if (!n) return
      const s = STYLES[row.kind]
      ctx.font = this.font(row.kind)
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.shadowColor = GREEN
      ctx.shadowBlur = s.glow
      ctx.fillStyle = s.color
      ctx.fillText(row.text.slice(0, n), pad.x, pad.top + ri * lh + lh / 2)
      ctx.restore()
    })
    // курсор: в конце первой недопечатанной строки, иначе — после последней непустой
    let ci = page.rows.findIndex((r, i) => r.text && counts[i] < r.text.length)
    if (ci < 0) {
      for (let i = page.rows.length - 1; i >= 0; i--) if (page.rows[i].text) {
        ci = i
        break
      }
    }
    let cursor: { x: number; y: number } | null = null
    if (ci >= 0) {
      const row = page.rows[ci]
      ctx.font = this.font(row.kind)
      const w = counts[ci] ? ctx.measureText(row.text.slice(0, counts[ci])).width + 6 : 0
      cursor = { x: pad.x + w, y: pad.top + ci * lh + lh / 2 }
    }
    if (cursor && blinkOn) {
      const c = cursor
      ctx.save()
      ctx.shadowColor = GREEN
      ctx.shadowBlur = 14
      ctx.fillStyle = GREEN
      ctx.fillRect(c.x, c.y - this.fontPx * 0.5, this.fontPx * 0.55, this.fontPx)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    this.texture.needsUpdate = true
  }

  /** Терминал закончил: последняя строка напечатана и курсор помигал. */
  terminalDone(t: number) {
    return !!this.layout && t >= this.layout.total
  }
}

export { FINAL_BLINK }
