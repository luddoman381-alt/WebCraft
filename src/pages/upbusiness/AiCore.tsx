import { useEffect, useRef } from 'react'

/*
 * Абстрактное «ядро ИИ»: светящаяся сфера, орбиты и сеть узлов на вращающейся
 * сфере; по связям к ядру бегут импульсы данных. Реагирует на курсор (наклон,
 * подсветка ближайших узлов). Анимация останавливается, когда ядро не видно
 * или вкладка скрыта; при prefers-reduced-motion рисуется один статичный кадр.
 */

type Node = { x: number; y: number; z: number; phase: number; size: number }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function AiCore({ reduced }: { reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')!
    const low = (navigator.hardwareConcurrency ?? 4) <= 4
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2)
    let size = 0
    const resize = () => {
      size = el.clientWidth
      el.width = Math.round(size * dpr)
      el.height = Math.round(size * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // узлы равномерно на сфере (спираль Фибоначчи)
    const r = rng(42)
    const N = low ? 26 : 40
    const nodes: Node[] = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.399963
      return { x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, phase: r() * Math.PI * 2, size: 1.4 + r() * 1.8 }
    })
    // связи между соседними узлами
    const links: [number, number][] = []
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z)
        if (d < 0.62) links.push([i, j])
      }
    }

    let tiltX = 0
    let tiltY = 0
    let aimX = 0
    let aimY = 0
    let pointer: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      const nx = (e.clientX - b.left) / b.width - 0.5
      const ny = (e.clientY - b.top) / b.height - 0.5
      aimY = nx * 0.9
      aimX = -ny * 0.6
      pointer = { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    const onLeave = () => {
      aimX = aimY = 0
      pointer = null
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)

    const draw = (t: number) => {
      const s = size
      const c = s / 2
      const R = s * 0.34
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, s, s)
      tiltX += (aimX - tiltX) * 0.06
      tiltY += (aimY - tiltY) * 0.06
      const rotY = t * 0.00018 + tiltY
      const rotX = 0.35 + tiltX
      const cy = Math.cos(rotY)
      const sy = Math.sin(rotY)
      const cx = Math.cos(rotX)
      const sx = Math.sin(rotX)

      // внешнее свечение
      const halo = ctx.createRadialGradient(c, c, R * 0.1, c, c, R * 1.55)
      halo.addColorStop(0, 'rgba(77,163,255,0.30)')
      halo.addColorStop(0.5, 'rgba(40,100,255,0.10)')
      halo.addColorStop(1, 'rgba(10,30,80,0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, s, s)

      // проекция узлов
      const P = nodes.map((n) => {
        const x1 = n.x * cy + n.z * sy
        const z1 = -n.x * sy + n.z * cy
        const y2 = n.y * cx - z1 * sx
        const z2 = n.y * sx + z1 * cx
        const persp = 1 / (1.9 - z2 * 0.6)
        return { x: c + x1 * R * persp * 1.3, y: c + y2 * R * persp * 1.3, z: z2, k: persp }
      })

      ctx.globalCompositeOperation = 'lighter'
      // орбиты — эллипсы под разными наклонами
      for (let i = 0; i < 3; i++) {
        ctx.save()
        ctx.translate(c, c)
        ctx.rotate(t * 0.0001 * (i % 2 ? -1 : 1) + i * 1.05 + tiltY * 0.4)
        ctx.scale(1, 0.32 + i * 0.12)
        ctx.strokeStyle = `rgba(${i === 1 ? '170,228,255' : '77,163,255'},${0.22 - i * 0.04})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(0, 0, R * (1.12 + i * 0.16), 0, Math.PI * 2)
        ctx.stroke()
        // спутник на орбите
        const a = t * 0.0009 * (1 + i * 0.3) + i
        ctx.fillStyle = 'rgba(190,235,255,0.9)'
        ctx.beginPath()
        ctx.arc(Math.cos(a) * R * (1.12 + i * 0.16), Math.sin(a) * R * (1.12 + i * 0.16), 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // связи сети
      ctx.lineWidth = 1
      for (const [i, j] of links) {
        const a = P[i]
        const b = P[j]
        const depth = (a.z + b.z + 2) / 4
        ctx.strokeStyle = `rgba(109,190,255,${0.05 + depth * 0.22})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      // лучи от ядра к передним узлам и импульсы данных по ним
      P.forEach((p, i) => {
        if (p.z < -0.1) return
        const n = nodes[i]
        ctx.strokeStyle = `rgba(77,163,255,${0.06 + p.z * 0.12})`
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        const k = ((t * 0.0006 + n.phase) % 1 + 1) % 1
        ctx.fillStyle = `rgba(170,228,255,${0.8 * Math.sin(Math.PI * k)})`
        ctx.beginPath()
        ctx.arc(c + (p.x - c) * k, c + (p.y - c) * k, 1.8, 0, Math.PI * 2)
        ctx.fill()
      })
      // узлы (ближе к курсору — ярче)
      P.forEach((p, i) => {
        const n = nodes[i]
        const near = pointer ? Math.max(0, 1 - Math.hypot(pointer.x - p.x, pointer.y - p.y) / (s * 0.2)) : 0
        const depth = (p.z + 1) / 2
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.002 + n.phase)
        ctx.fillStyle = `rgba(${near > 0.2 ? '210,240,255' : '120,195,255'},${0.25 + depth * 0.6 * pulse + near * 0.4})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, n.size * p.k * 1.6 + near * 2.5, 0, Math.PI * 2)
        ctx.fill()
      })

      // ядро
      const beat = 1 + Math.sin(t * 0.0022) * 0.05
      const core = ctx.createRadialGradient(c, c, 0, c, c, R * 0.42 * beat)
      core.addColorStop(0, 'rgba(235,248,255,0.95)')
      core.addColorStop(0.25, 'rgba(120,205,255,0.85)')
      core.addColorStop(0.6, 'rgba(50,120,255,0.35)')
      core.addColorStop(1, 'rgba(20,60,200,0)')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(c, c, R * 0.42 * beat, 0, Math.PI * 2)
      ctx.fill()
      // внутренний шестигранник — «чип» в центре
      ctx.strokeStyle = 'rgba(220,245,255,0.75)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.0004
        const x = c + Math.cos(a) * R * 0.17
        const y = c + Math.sin(a) * R * 0.17
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    }

    let raf = 0
    let visible = true
    const loop = (t: number) => {
      draw(t)
      raf = requestAnimationFrame(loop)
    }
    const startLoop = () => {
      cancelAnimationFrame(raf)
      if (reduced) draw(4000)
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) startLoop()
      else cancelAnimationFrame(raf)
    })
    io.observe(el)
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : startLoop())
    document.addEventListener('visibilitychange', onVis)
    startLoop()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced])

  return <canvas ref={canvas} className="ub-core" aria-hidden="true" />
}
