import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Laptop } from './Laptop'
import { Phone } from './Phone'
import { Dust, Floor, LightLines, StudioEnvironment } from './Atmosphere'
import type { FocusTarget } from '../lib/theme'
import { hotspotEls, type HotspotId } from './hotspotBridge'
import { dive, screenAnchor, screenDom, screenLight, SCREEN_SIZE } from '../dive/diveStore'
import { rectToQuadMatrix3d, type Pt } from '../lib/homography'

export type SceneProps = {
  /** приближение к смартфону (демо-панель); ноутбук ведёт в каталог */
  focus: FocusTarget
  hovered: FocusTarget
  onFocus: (t: FocusTarget) => void
  onHover: (t: FocusTarget) => void
  /** нажатие на ноутбук — запуск перехода в каталог */
  onLaptopSelect: () => void
  reducedMotion: boolean
  lowPower: boolean
  /** на экране ноутбука — настоящий DOM-сайт */
  liveScreen: boolean
  /** идёт переход в каталог */
  diving: boolean
  /** сцена скрыта под другой страницей — останавливаем рендер */
  paused: boolean
  onReady: () => void
  onError: () => void
}

/* -------------------------------------------------------------------------- */
/* Раскладка композиции под разные соотношения сторон                          */
/* -------------------------------------------------------------------------- */

type Layout = {
  kind: 'wide' | 'medium' | 'narrow'
  group: [number, number, number]
  scale: number
  laptop: { pos: [number, number, number]; rotY: number }
  phone: { pos: [number, number, number]; rot: [number, number, number] }
}

const DEFAULT_CAM = new THREE.Vector3(0, 1.15, 9.2)
const DEFAULT_LOOK = new THREE.Vector3(0, -0.2, 0)
const FOV = 32
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

/** Половина видимой ширины кадра на глубине z = 0 при камере по умолчанию. */
const halfWidthAt = (aspect: number) => DEFAULT_CAM.z * TAN * aspect

function getLayout(aspect: number): Layout {
  if (aspect >= 1.25) {
    // Композиция (~4.2 ед. в ширину, телефон ближе к камере и визуально шире)
    // занимает правую половину кадра
    const half = halfWidthAt(aspect)
    const scale = Math.min(1, (half * 0.84) / 4.2)
    return {
      kind: 'wide',
      group: [half * 0.47, -1.2, 0],
      scale,
      laptop: { pos: [-0.6, 0, -0.2], rotY: -0.42 },
      phone: { pos: [1.3, 0.98, 1.05], rot: [0.04, -0.52, 0.05] },
    }
  }
  if (aspect >= 0.8) {
    return {
      kind: 'medium',
      group: [0.15, 0.05, 0],
      scale: 0.64,
      laptop: { pos: [-0.45, 0, -0.2], rotY: -0.3 },
      phone: { pos: [1.45, 0.98, 1.0], rot: [0.04, -0.45, 0.05] },
    }
  }
  return {
    kind: 'narrow',
    group: [-0.1, 0.3, 0],
    scale: 0.66,
    laptop: { pos: [-0.35, 0, -0.3], rotY: -0.22 },
    phone: { pos: [1.15, 0.95, 1.0], rot: [0.04, -0.4, 0.05] },
  }
}

/* -------------------------------------------------------------------------- */
/* Камера                                                                      */
/* -------------------------------------------------------------------------- */

function fitDistance(w: number, h: number, aspect: number, margin: number) {
  return Math.max(h / (2 * TAN), w / (2 * TAN * aspect)) * margin
}

type FocusSpec = {
  ref: React.RefObject<THREE.Group | null>
  center: THREE.Vector3
  normal: THREE.Vector3
  size: [number, number]
}

/** Базис экрана ноутбука в мировых координатах. */
function readScreenBasis(
  anchor: THREE.Object3D,
  out: { c: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; n: THREE.Vector3; scale: THREE.Vector3 },
) {
  anchor.updateWorldMatrix(true, false)
  const m = anchor.matrixWorld
  out.c.setFromMatrixPosition(m)
  out.right.set(1, 0, 0).transformDirection(m)
  out.up.set(0, 1, 0).transformDirection(m)
  out.n.set(0, 0, 1).transformDirection(m)
  out.scale.setFromMatrixScale(m)
}

function CameraRig({
  focus,
  phoneSpec,
  reducedMotion,
  layout,
}: {
  focus: FocusTarget
  phoneSpec: FocusSpec
  reducedMotion: boolean
  layout: Layout
}) {
  const { camera, size, pointer } = useThree()
  const look = useRef(DEFAULT_LOOK.clone())
  const t = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      n: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      basis: {
        c: new THREE.Vector3(),
        right: new THREE.Vector3(),
        up: new THREE.Vector3(),
        n: new THREE.Vector3(),
        scale: new THREE.Vector3(),
      },
      p1: new THREE.Vector3(),
      t1: new THREE.Vector3(),
      p2: new THREE.Vector3(),
      t2: new THREE.Vector3(),
      startPos: new THREE.Vector3(),
      startLook: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, rawDelta) => {
    // после паузы рендера delta может быть огромной — ограничиваем, чтобы камера не «прыгала»
    const delta = Math.min(rawDelta, 1 / 30)

    if (dive.phase === 'handoff') return

    /* ---------- переход в каталог: точные позы, без инерции ---------- */
    if ((dive.phase === 'diving' || dive.phase === 'docking' || dive.phase === 'cancelling') && screenAnchor.current) {
      if (!dive.captured) {
        t.startPos.copy(camera.position)
        t.startLook.copy(look.current)
        dive.captured = true
      }
      const b = t.basis
      readScreenBasis(screenAnchor.current, b)
      const sw = SCREEN_SIZE.w * b.scale.x
      const sh = SCREEN_SIZE.h * b.scale.y
      const aspect = size.width / size.height

      // 1) экран — главный объект кадра
      const d1 = Math.max(sh / (2 * TAN * 0.7), sw / (2 * TAN * aspect * 0.78))
      t.t1.copy(b.c)
      t.p1.copy(b.c).addScaledVector(b.n, d1)

      // 2) стыковка: ширина экрана = ширине макета страницы, верх экрана = верх окна
      const fw = screenDom.width || size.width
      const fh = screenDom.height || fw / 1.6
      const d2 = (sw * size.height) / (2 * TAN * fw)
      const wpp = (2 * d2 * TAN) / size.height // мировых единиц на CSS-пиксель
      t.t2
        .copy(b.c)
        .addScaledVector(b.right, ((size.width - fw) / 2) * wpp)
        .addScaledVector(b.up, -((size.height - fh) / 2) * wpp)
      t.p2.copy(t.t2).addScaledVector(b.n, d2)

      t.pos.lerpVectors(t.startPos, t.p1, dive.approach).lerp(t.p2, dive.push)
      t.tgt.lerpVectors(t.startLook, t.t1, dive.approach).lerp(t.t2, dive.push)
      camera.position.copy(t.pos)
      look.current.copy(t.tgt)
      camera.lookAt(look.current)
      return
    }

    /* ---------- обычный режим: мягкое следование ---------- */
    const aspect = size.width / size.height
    const { pos, tgt, n, q, s, right, up } = t

    if (focus === 'phone') {
      const obj = phoneSpec.ref.current
      if (!obj) return
      obj.updateWorldMatrix(true, false)
      tgt.copy(phoneSpec.center).applyMatrix4(obj.matrixWorld)
      obj.matrixWorld.decompose(pos, q, s)
      n.copy(phoneSpec.normal).applyQuaternion(q).normalize()
      const narrow = layout.kind === 'narrow'
      const d = fitDistance(phoneSpec.size[0] * s.x, phoneSpec.size[1] * s.x, aspect, narrow ? 1.25 : 1.8)
      pos.copy(tgt).addScaledVector(n, d)
      // место под панель с описанием: на широких экранах — слева, на узких — снизу
      right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      const visH = 2 * d * TAN
      if (narrow) {
        const shift = -visH * 0.2
        pos.addScaledVector(up, shift)
        tgt.addScaledVector(up, shift)
      } else {
        const shift = -visH * aspect * 0.17
        pos.addScaledVector(right, shift)
        tgt.addScaledVector(right, shift)
      }
    } else {
      pos.copy(DEFAULT_CAM)
      tgt.copy(DEFAULT_LOOK)
      if (layout.kind === 'narrow') {
        pos.z = 10.5
        pos.y = 1.0
      }
      if (!reducedMotion) {
        pos.x += pointer.x * 0.35
        pos.y += pointer.y * 0.18
        pos.x += Math.sin(state.clock.elapsedTime * 0.12) * 0.08
      }
    }

    const lambda = reducedMotion ? 12 : 2.6
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pos.x, lambda, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pos.y, lambda, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pos.z, lambda, delta)
    look.current.x = THREE.MathUtils.damp(look.current.x, tgt.x, lambda, delta)
    look.current.y = THREE.MathUtils.damp(look.current.y, tgt.y, lambda, delta)
    look.current.z = THREE.MathUtils.damp(look.current.z, tgt.z, lambda, delta)
    camera.lookAt(look.current)
  })

  return null
}

/* -------------------------------------------------------------------------- */
/* Проекция DOM-сайта на плоскость экрана ноутбука                             */
/* -------------------------------------------------------------------------- */

function ScreenProjector() {
  const { camera, size } = useThree()
  const t = useMemo(
    () => ({
      v: new THREE.Vector3(),
      corners: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      last: { el: null as HTMLElement | null, transform: '', page: '', vh: -1, nav: -1, glass: -1, dim: -1, top: false, placed: '' },
    }),
    [],
  )

  useFrame((_, rawDelta) => {
    if (dive.phase === 'handoff') return
    const { frame, viewport, page, nav, glass, dim } = screenDom
    const anchor = screenAnchor.current
    if (!frame || !viewport || !page || !anchor) return
    let last = t.last
    // DOM-экран смонтирован заново (возврат на главную) — кэш записанных значений недействителен
    if (last.el !== frame) {
      last = t.last = { el: frame, transform: '', page: '', vh: -1, nav: -1, glass: -1, dim: -1, top: false, placed: '' }
    }
    const fw = screenDom.width
    const fh = screenDom.height

    camera.updateMatrixWorld()
    anchor.updateWorldMatrix(true, false)
    const hw = SCREEN_SIZE.w / 2
    const hh = SCREEN_SIZE.h / 2
    const local: [number, number][] = [
      [-hw, hh], // TL
      [hw, hh], // TR
      [hw, -hh], // BR
      [-hw, -hh], // BL
    ]
    let behind = false
    const quad = local.map(([x, y], i) => {
      const c = t.corners[i].set(x, y, 0).applyMatrix4(anchor.matrixWorld)
      t.v.copy(c).applyMatrix4(camera.matrixWorldInverse)
      if (t.v.z > -camera.near) behind = true
      c.project(camera)
      return { x: (c.x * 0.5 + 0.5) * size.width, y: (-c.y * 0.5 + 0.5) * size.height } as Pt
    }) as [Pt, Pt, Pt, Pt]

    const placed = behind ? 'false' : 'true'
    if (placed !== last.placed) {
      frame.dataset.placed = placed
      last.placed = placed
    }
    if (behind) return

    // в момент стыковки — ровно 1:1, без субпиксельного дрейфа
    const transform = dive.push >= 1 ? 'none' : rectToQuadMatrix3d(fw, fh, quad)
    if (transform !== last.transform) {
      frame.style.transform = transform
      last.transform = transform
    }

    const pageT = `translate3d(0, ${(-dive.scroll * dive.scrollPx).toFixed(2)}px, 0)`
    if (pageT !== last.page) {
      page.style.transform = pageT
      last.page = pageT
    }

    const fullH = Math.max(fh, window.innerHeight)
    const vh = Math.round(fh + (fullH - fh) * dive.expand)
    if (vh !== last.vh) {
      viewport.style.height = `${vh}px`
      frame.style.height = `${vh}px`
      last.vh = vh
    }

    if (dive.onTop !== last.top) {
      frame.classList.toggle('is-top', dive.onTop)
      last.top = dive.onTop
    }

    const navO = +(1 - dive.chrome).toFixed(3)
    if (nav && navO !== last.nav) {
      nav.style.opacity = String(navO)
      last.nav = navO
    }
    const glassO = +((1 - dive.chrome) * (1 - dive.push * 0.6)).toFixed(3)
    if (glass && glassO !== last.glass) {
      glass.style.opacity = String(glassO)
      last.glass = glassO
    }
    screenLight.dim = THREE.MathUtils.damp(screenLight.dim, screenLight.dimTarget, 5, Math.min(rawDelta, 1 / 30))
    const dimO = +screenLight.dim.toFixed(3)
    if (dim && dimO !== last.dim) {
      dim.style.opacity = String(dimO)
      last.dim = dimO
    }
  })

  return null
}

/* -------------------------------------------------------------------------- */
/* Проекция 3D-якорей на DOM-хотспоты                                          */
/* -------------------------------------------------------------------------- */

function HotspotProjector({ anchors }: { anchors: Record<HotspotId, React.RefObject<THREE.Object3D | null>> }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (dive.phase === 'handoff') return
    ;(Object.keys(anchors) as HotspotId[]).forEach((id) => {
      const el = hotspotEls[id]
      const obj = anchors[id].current
      if (!el || !obj) return
      obj.getWorldPosition(v)
      v.project(camera)
      const behind = v.z > 1
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
      el.dataset.placed = behind ? 'false' : 'true'
    })
  })

  useEffect(
    () => () => {
      Object.values(hotspotEls).forEach((el) => el && (el.dataset.placed = 'false'))
    },
    [],
  )

  return null
}

/* -------------------------------------------------------------------------- */
/* Композиция                                                                  */
/* -------------------------------------------------------------------------- */

type CompositionProps = Omit<SceneProps, 'onReady' | 'onError' | 'paused'> & {
  anchors: Record<HotspotId, React.RefObject<THREE.Object3D | null>>
}

function Composition({
  focus,
  hovered,
  onFocus,
  onHover,
  onLaptopSelect,
  reducedMotion,
  lowPower,
  liveScreen,
  diving,
  anchors,
}: CompositionProps) {
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const layout = getLayout(size.width / size.height)
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())

  const phoneRef = useRef<THREE.Group>(null)
  const laptopMotion = useRef<THREE.Group>(null)
  const phoneMotion = useRef<THREE.Group>(null)

  const phoneSpec = useMemo<FocusSpec>(
    () => ({ ref: phoneRef, center: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 0, 1), size: [0.85, 1.75] }),
    [],
  )

  useFrame((state) => {
    const tt = state.clock.elapsedTime
    const frozen = dive.phase !== 'idle'
    const m = reducedMotion ? 0 : 1
    // во время перехода ноутбук замирает, чтобы стыковка с экраном была точной
    if (laptopMotion.current && !frozen) {
      laptopMotion.current.rotation.y = Math.sin(tt * 0.22) * 0.05 * m
    }
    if (phoneMotion.current) {
      const calm = focus === 'phone' ? 0.3 : 1
      // смартфон отходит в сторону, освобождая путь камере
      const away = dive.approach
      phoneMotion.current.position.x = away * 1.6
      phoneMotion.current.position.z = -away * 0.4
      phoneMotion.current.position.y = Math.sin(tt * 0.8) * 0.06 * m * calm - away * 0.15
      phoneMotion.current.rotation.y = Math.sin(tt * 0.35) * 0.08 * m * calm - away * 0.4
      phoneMotion.current.rotation.x = Math.cos(tt * 0.5) * 0.03 * m * calm
    }
  })

  const setHover = (id: Exclude<FocusTarget, null>) => (v: boolean) => {
    if (v) onHover(id)
    else if (hovered === id) onHover(null)
  }

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  return (
    <>
      <CameraRig focus={focus} phoneSpec={phoneSpec} reducedMotion={reducedMotion} layout={layout} />
      <group position={layout.group} scale={layout.scale}>
        {/* Ноутбук */}
        <group ref={laptopMotion} position={layout.laptop.pos}>
          <group rotation-y={layout.laptop.rotY}>
            <Laptop
              hovered={hovered === 'laptop'}
              focused={false}
              dimmed={focus === 'phone'}
              reducedMotion={reducedMotion}
              onHover={setHover('laptop')}
              onSelect={onLaptopSelect}
              anisotropy={anisotropy}
              liveScreen={liveScreen}
            />
            <object3D ref={anchors.laptop} position={[-1.15, 2.2, -1.6]} />
          </group>
        </group>

        {/* Смартфон */}
        <group position={layout.phone.pos}>
          <group ref={phoneMotion}>
            <group ref={phoneRef} rotation={layout.phone.rot}>
              <Phone
                hovered={hovered === 'phone'}
                focused={focus === 'phone'}
                dimmed={diving}
                onHover={setHover('phone')}
                onSelect={() => onFocus('phone')}
                anisotropy={anisotropy}
              />
              <object3D ref={anchors.phone} position={[0.1, 1.08, 0]} />
            </group>
          </group>
        </group>

        <ContactShadows
          position={[0.4, 0.002, 0.3]}
          scale={9}
          blur={2.6}
          far={3.2}
          opacity={0.75}
          resolution={lowPower ? 256 : 512}
          frames={lowPower || reducedMotion ? 1 : Infinity}
          color="#000000"
        />
      </group>
      <group position={[0, layout.group[1], 0]}>
        <Floor />
      </group>
    </>
  )
}

/** Сообщает наружу, что первый кадр отрисован. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (!done.current) {
      done.current = true
      requestAnimationFrame(onReady)
    }
  })
  return null
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[-4, 6, 5]} intensity={1.4} color="#f2f7f3" />
      <directionalLight position={[5, 2, -4]} intensity={2.2} color="#39FF88" />
      <spotLight position={[0, 7, 2]} angle={0.5} penumbra={1} intensity={30} distance={16} color="#dfeee5" />
    </>
  )
}

export default function Scene(props: SceneProps) {
  const { reducedMotion, lowPower, paused, onReady, onError, ...rest } = props
  const [degraded, setDegraded] = useState(lowPower)
  const effects = !degraded

  const laptopAnchor = useRef<THREE.Object3D>(null)
  const phoneAnchor = useRef<THREE.Object3D>(null)
  const anchors = useMemo(() => ({ laptop: laptopAnchor, phone: phoneAnchor }), [])

  return (
    <Canvas
      className="scene-canvas"
      frameloop={paused ? 'never' : 'always'}
      dpr={degraded ? [1, 1.25] : [1, 1.75]}
      // alpha: экран ноутбука — прозрачное окно, сквозь которое виден DOM-сайт
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true, premultipliedAlpha: true, stencil: false }}
      camera={{ position: DEFAULT_CAM.toArray(), fov: FOV, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onError()
        })
      }}
      onPointerMissed={() => props.focus && props.onFocus(null)}
    >
      <fog attach="fog" args={['#080B0A', 10, 26]} />
      <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} onFallback={() => setDegraded(true)} />
      <AdaptiveDpr pixelated={false} />
      <Lights />
      <Suspense fallback={null}>
        <StudioEnvironment />
        <Composition {...rest} reducedMotion={reducedMotion} lowPower={lowPower} anchors={anchors} />
        <LightLines animate={!reducedMotion} />
        <Dust count={degraded ? 40 : 110} />
        {/* проекторы — после композиции: читают позы уже обновлённой камеры и объектов этого кадра */}
        <ScreenProjector />
        <HotspotProjector anchors={anchors} />
        <ReadySignal onReady={onReady} />
      </Suspense>
      {effects && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.75} radius={0.7} />
          <Vignette offset={0.25} darkness={0.75} eskil={false} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
