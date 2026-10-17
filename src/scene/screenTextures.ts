import * as THREE from 'three'
import { palette } from '../lib/theme'

/*
 * Интерфейсы на экранах устройств рисуются процедурно в 2D canvas
 * и используются как текстуры. Никаких внешних изображений — экран
 * всегда чёткий и грузится мгновенно.
 */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function makeTexture(canvas: HTMLCanvasElement, anisotropy: number) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step: number) {
  ctx.strokeStyle = 'rgba(57,255,136,0.045)'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
    ctx.stroke()
  }
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Знак: квадрат со срезанным углом и двумя «кодовыми» штрихами
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = palette.green
  ctx.lineWidth = size * 0.09
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(size * 0.72, 0)
  ctx.lineTo(size, size * 0.28)
  ctx.lineTo(size, size)
  ctx.lineTo(0, size)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(size * 0.26, size * 0.62)
  ctx.lineTo(size * 0.44, size * 0.44)
  ctx.lineTo(size * 0.26, size * 0.26)
  ctx.moveTo(size * 0.52, size * 0.7)
  ctx.lineTo(size * 0.76, size * 0.7)
  ctx.stroke()
  ctx.restore()
}

type Token = [string, string]

const CODE: Token[][] = [
  [['#5b6b62', '01'], ['#929E96', ' import '], [palette.green, '{ Studio }'], ['#929E96', " from '@webcraft/core'"]],
  [['#5b6b62', '02'], ['#929E96', '']],
  [['#5b6b62', '03'], ['#17C964', ' const '], ['#F0F5F1', 'project'], ['#929E96', ' = '], [palette.green, 'Studio'], ['#929E96', '.create({']],
  [['#5b6b62', '04'], ['#F0F5F1', '   type'], ['#929E96', ": '"], [palette.green, 'catalog'], ['#929E96', "',"]],
  [['#5b6b62', '05'], ['#F0F5F1', '   automation'], ['#929E96', ': '], ['#17C964', 'true'], ['#929E96', ',']],
  [['#5b6b62', '06'], ['#F0F5F1', '   performance'], ['#929E96', ': '], [palette.green, '100'], ['#929E96', ',']],
  [['#5b6b62', '07'], ['#929E96', ' })']],
  [['#5b6b62', '08'], ['#929E96', '']],
  [['#5b6b62', '09'], ['#17C964', ' await '], ['#F0F5F1', 'project'], ['#929E96', '.'], [palette.green, 'launch'], ['#929E96', '()']],
  [['#5b6b62', '10'], ['#5b6b62', ' // ✓ deployed · 0.4s · edge']],
]

/** Экран ноутбука: окно редактора кода + панель метрик + превью. */
export function createLaptopScreenTexture(anisotropy = 8) {
  const W = 2048
  const H = 1280
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  // Фон с мягким радиальным свечением
  const bg = ctx.createRadialGradient(W * 0.68, H * 0.38, 40, W * 0.6, H * 0.5, W * 0.8)
  bg.addColorStop(0, '#0f1e16')
  bg.addColorStop(0.55, '#0a110d')
  bg.addColorStop(1, '#060908')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  drawGrid(ctx, W, H, 64)

  // Верхняя панель
  ctx.fillStyle = 'rgba(17,23,20,0.92)'
  ctx.fillRect(0, 0, W, 88)
  ctx.fillStyle = 'rgba(57,255,136,0.22)'
  ctx.fillRect(0, 87, W, 1)
  drawLogo(ctx, 48, 24, 40)
  ctx.font = '600 34px "Space Grotesk", sans-serif'
  ctx.fillStyle = palette.text
  ctx.textBaseline = 'middle'
  ctx.fillText('WebCraft', 108, 46)
  ctx.font = '500 22px "JetBrains Mono", monospace'
  ctx.fillStyle = palette.text2
  const tabs = ['studio.ts', 'catalog.tsx', 'flows.yml']
  tabs.forEach((t, i) => {
    const x = 420 + i * 230
    if (i === 0) {
      ctx.fillStyle = 'rgba(57,255,136,0.08)'
      roundRect(ctx, x - 20, 22, 200, 46, 10)
      ctx.fill()
      ctx.fillStyle = palette.green
    } else {
      ctx.fillStyle = palette.text2
    }
    ctx.fillText(t, x, 46)
  })
  ctx.fillStyle = palette.green
  ctx.beginPath()
  ctx.arc(W - 220, 46, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = palette.text2
  ctx.fillText('LIVE · 99.99%', W - 200, 46)

  // Боковая навигация
  ctx.fillStyle = 'rgba(17,23,20,0.7)'
  ctx.fillRect(0, 88, 88, H - 88)
  ctx.fillStyle = 'rgba(240,245,241,0.06)'
  ctx.fillRect(87, 88, 1, H - 88)
  for (let i = 0; i < 6; i++) {
    const y = 140 + i * 84
    ctx.strokeStyle = i === 0 ? palette.green : 'rgba(146,158,150,0.5)'
    ctx.lineWidth = 3
    roundRect(ctx, 28, y, 32, 32, 8)
    ctx.stroke()
    if (i === 0) {
      ctx.fillStyle = palette.green
      ctx.fillRect(0, y - 6, 4, 44)
    }
  }

  // Окно кода
  const codeX = 140
  const codeY = 140
  const codeW = 1000
  const codeH = 660
  ctx.fillStyle = 'rgba(12,17,15,0.94)'
  roundRect(ctx, codeX, codeY, codeW, codeH, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(57,255,136,0.18)'
  ctx.lineWidth = 2
  ctx.stroke()
  ;['#2a332e', '#2a332e', '#2a332e'].forEach((col, i) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(codeX + 40 + i * 30, codeY + 38, 9, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.font = '500 20px "JetBrains Mono", monospace'
  ctx.fillStyle = palette.text2
  ctx.fillText('~/webcraft/studio.ts', codeX + 150, codeY + 39)

  ctx.font = '500 30px "JetBrains Mono", monospace'
  CODE.forEach((line, row) => {
    let x = codeX + 44
    const y = codeY + 120 + row * 52
    line.forEach(([color, text]) => {
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
      x += ctx.measureText(text).width
    })
    if (row === 8) {
      ctx.fillStyle = palette.green
      ctx.fillRect(x + 6, y - 18, 16, 36)
    }
  })
  // Подсветка активной строки
  ctx.fillStyle = 'rgba(57,255,136,0.05)'
  ctx.fillRect(codeX + 2, codeY + 120 + 8 * 52 - 26, codeW - 4, 52)

  // Правая колонка: метрики
  const px = 1190
  const pw = W - px - 60
  const cards: [string, string, string][] = [
    ['PERFORMANCE', '100', '/100'],
    ['LOAD TIME', '0.4', 's'],
    ['AUTOMATIONS', '24', 'active'],
  ]
  cards.forEach(([label, value, unit], i) => {
    const y = 140 + i * 160
    ctx.fillStyle = 'rgba(17,23,20,0.88)'
    roundRect(ctx, px, y, pw, 136, 20)
    ctx.fill()
    ctx.strokeStyle = 'rgba(240,245,241,0.07)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = '500 20px "JetBrains Mono", monospace'
    ctx.fillStyle = palette.text2
    ctx.fillText(label, px + 32, y + 40)
    ctx.font = '600 60px "Space Grotesk", sans-serif'
    ctx.fillStyle = palette.text
    ctx.fillText(value, px + 32, y + 94)
    const vw = ctx.measureText(value).width
    ctx.font = '500 24px "Inter", sans-serif'
    ctx.fillStyle = palette.green
    ctx.fillText(unit, px + 44 + vw, y + 100)
    // мини-спарклайн
    ctx.strokeStyle = palette.green
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let k = 0; k <= 12; k++) {
      const sx = px + pw - 260 + k * 18
      const sy = y + 90 - Math.sin(k * 0.8 + i) * 16 - k * 2.2
      if (k === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.stroke()
  })

  // Нижняя панель: график
  const gy = 860
  const gh = H - gy - 70
  ctx.fillStyle = 'rgba(17,23,20,0.88)'
  roundRect(ctx, 140, gy, W - 200, gh, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(240,245,241,0.07)'
  ctx.stroke()
  ctx.font = '500 20px "JetBrains Mono", monospace'
  ctx.fillStyle = palette.text2
  ctx.fillText('TRAFFIC · CONVERSION · 30D', 180, gy + 42)

  const gx0 = 180
  const gx1 = W - 110
  const base = gy + gh - 40
  const pts: [number, number][] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = gx0 + (gx1 - gx0) * t
    const y = base - (40 + t * 170 + Math.sin(t * 13) * 26 + Math.sin(t * 5.3) * 18)
    pts.push([x, y])
  }
  const area = ctx.createLinearGradient(0, gy + 60, 0, base)
  area.addColorStop(0, 'rgba(57,255,136,0.28)')
  area.addColorStop(1, 'rgba(57,255,136,0)')
  ctx.fillStyle = area
  ctx.beginPath()
  ctx.moveTo(pts[0][0], base)
  pts.forEach(([x, y]) => ctx.lineTo(x, y))
  ctx.lineTo(pts[pts.length - 1][0], base)
  ctx.closePath()
  ctx.fill()
  ctx.shadowColor = palette.green
  ctx.shadowBlur = 18
  ctx.strokeStyle = palette.green
  ctx.lineWidth = 4
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
  ctx.shadowBlur = 0
  // столбики второго ряда
  for (let i = 0; i < 40; i++) {
    const x = gx0 + i * ((gx1 - gx0) / 40)
    const bh = 10 + ((i * 37) % 23)
    ctx.fillStyle = 'rgba(23,201,100,0.35)'
    ctx.fillRect(x, base + 8, 10, -bh * 0.4)
  }

  // Тонкая виньетка
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  return makeTexture(c, anisotropy)
}

/** Экран смартфона: минималистичный мобильный интерфейс WebCraft. */
export function createPhoneScreenTexture(anisotropy = 8) {
  const W = 720
  const H = 1520
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0b1510')
  bg.addColorStop(0.5, '#080d0b')
  bg.addColorStop(1, '#050806')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  drawGrid(ctx, W, H, 48)

  // Свечение
  const glow = ctx.createRadialGradient(W / 2, 560, 10, W / 2, 560, 420)
  glow.addColorStop(0, 'rgba(57,255,136,0.32)')
  glow.addColorStop(1, 'rgba(57,255,136,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'middle'
  // Статус-бар
  ctx.font = '600 28px "Inter", sans-serif'
  ctx.fillStyle = palette.text
  ctx.fillText('9:41', 64, 72)
  ctx.fillStyle = palette.text
  roundRect(ctx, W - 120, 60, 54, 24, 6)
  ctx.fill()
  ctx.fillStyle = palette.green
  ctx.beginPath()
  ctx.arc(W - 150, 72, 7, 0, Math.PI * 2)
  ctx.fill()

  // Шапка приложения
  drawLogo(ctx, 64, 150, 44)
  ctx.font = '600 38px "Space Grotesk", sans-serif'
  ctx.fillStyle = palette.text
  ctx.fillText('WebCraft', 126, 172)
  ctx.strokeStyle = 'rgba(240,245,241,0.5)'
  ctx.lineWidth = 4
  ;[0, 14].forEach((d) => {
    ctx.beginPath()
    ctx.moveTo(W - 108, 164 + d)
    ctx.lineTo(W - 64, 164 + d)
    ctx.stroke()
  })

  // Центральный знак — кольца
  const cx = W / 2
  const cy = 560
  ;[190, 145, 100].forEach((r, i) => {
    ctx.strokeStyle = i === 2 ? palette.green : `rgba(57,255,136,${0.16 + i * 0.12})`
    ctx.lineWidth = i === 2 ? 5 : 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  })
  ctx.strokeStyle = palette.green
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, 190, -Math.PI / 2, Math.PI * 0.6)
  ctx.stroke()
  ctx.lineCap = 'butt'
  drawLogo(ctx, cx - 44, cy - 44, 88)

  ctx.textAlign = 'center'
  ctx.font = '500 22px "JetBrains Mono", monospace'
  ctx.fillStyle = palette.green
  ctx.fillText('● SYSTEM ONLINE', cx, 830)
  ctx.font = '600 54px "Space Grotesk", sans-serif'
  ctx.fillStyle = palette.text
  ctx.fillText('Цифровые', cx, 920)
  ctx.fillText('продукты', cx, 984)
  ctx.font = '400 26px "Inter", sans-serif'
  ctx.fillStyle = palette.text2
  ctx.fillText('сайты · каталоги · автоматизация', cx, 1050)
  ctx.textAlign = 'left'

  // Список
  const items = ['Сайты', 'Каталоги', 'Автоматизация']
  items.forEach((label, i) => {
    const y = 1110 + i * 92
    ctx.fillStyle = 'rgba(17,23,20,0.9)'
    roundRect(ctx, 56, y, W - 112, 76, 18)
    ctx.fill()
    ctx.strokeStyle = i === 0 ? 'rgba(57,255,136,0.5)' : 'rgba(240,245,241,0.08)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = '500 28px "Inter", sans-serif'
    ctx.fillStyle = palette.text
    ctx.fillText(label, 92, y + 39)
    ctx.font = '500 22px "JetBrains Mono", monospace'
    ctx.fillStyle = i === 0 ? palette.green : palette.text2
    ctx.fillText(`0${i + 1} →`, W - 170, y + 39)
  })

  // Нижняя кнопка
  ctx.fillStyle = palette.green
  roundRect(ctx, 56, H - 132, W - 112, 84, 42)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.font = '600 30px "Inter", sans-serif'
  ctx.fillStyle = '#06100a'
  ctx.fillText('Обсудить проект', cx, H - 89)
  ctx.textAlign = 'left'

  return makeTexture(c, anisotropy)
}
