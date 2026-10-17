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

export type SceneProps = {
  focus: FocusTarget
  hovered: FocusTarget
  onFocus: (t: FocusTarget) => void
  onHover: (t: FocusTarget) => void
  reducedMotion: boolean
  lowPower: boolean
  /** сцена скрыта под страницей-заглушкой — останавливаем рендер */
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

/** Половина видимой ширины кадра на глубине z = 0 при камере по умолчанию. */
const halfWidthAt = (aspect: number) => DEFAULT_CAM.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect

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
      group: [0.15, -0.35, 0],
      scale: 0.72,
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

const DEFAULT_CAM = new THREE.Vector3(0, 1.15, 9.2)
const DEFAULT_LOOK = new THREE.Vector3(0, -0.2, 0)
const FOV = 32

/** Расстояние, на котором объект w×h помещается в кадр с запасом. */
function fitDistance(w: number, h: number, aspect: number, margin: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const byH = h / (2 * t)
  const byW = w / (2 * t * aspect)
  return Math.max(byH, byW) * margin
}

type FocusSpec = {
  ref: React.RefObject<THREE.Group | null>
  /** центр экрана в локальных координатах объекта */
  center: THREE.Vector3
  /** нормаль экрана в локальных координатах */
  normal: THREE.Vector3
  size: [number, number]
}

function CameraRig({
  focus,
  specs,
  reducedMotion,
  layout,
}: {
  focus: FocusTarget
  specs: Record<'laptop' | 'phone', FocusSpec>
  reducedMotion: boolean
  layout: Layout
}) {
  const { camera, size, pointer } = useThree()
  const look = useRef(DEFAULT_LOOK.clone())
  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      n: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, delta) => {
    const aspect = size.width / size.height
    const { pos, tgt, n, q, s, right, up } = tmp

    if (focus) {
      const spec = specs[focus]
      const obj = spec.ref.current
      if (!obj) return
      obj.updateWorldMatrix(true, false)
      tgt.copy(spec.center).applyMatrix4(obj.matrixWorld)
      obj.matrixWorld.decompose(pos, q, s)
      n.copy(spec.normal).applyQuaternion(q).normalize()
      const k = s.x
      const narrow = layout.kind === 'narrow'
      const d = fitDistance(spec.size[0] * k, spec.size[1] * k, aspect, narrow ? 1.25 : 1.8)
      pos.copy(tgt).addScaledVector(n, d)
      // Смещаем кадр, чтобы освободить место под панель с описанием:
      // на широких экранах — слева, на узких — снизу.
      right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
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
        // лёгкий параллакс за курсором
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
/* Проекция 3D-якорей на DOM-хотспоты                                          */
/* -------------------------------------------------------------------------- */

function HotspotProjector({ anchors }: { anchors: Record<HotspotId, React.RefObject<THREE.Object3D | null>> }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
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

function Composition({ focus, hovered, onFocus, onHover, reducedMotion, lowPower }: Omit<SceneProps, 'onReady' | 'onError' | 'paused'>) {
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const layout = getLayout(size.width / size.height)
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())

  const laptopRef = useRef<THREE.Group>(null)
  const phoneRef = useRef<THREE.Group>(null)
  const laptopMotion = useRef<THREE.Group>(null)
  const phoneMotion = useRef<THREE.Group>(null)
  const laptopAnchor = useRef<THREE.Object3D>(null)
  const phoneAnchor = useRef<THREE.Object3D>(null)
  const anchors = useMemo(() => ({ laptop: laptopAnchor, phone: phoneAnchor }), [])

  const specs = useMemo(
    () => ({
      laptop: {
        ref: laptopRef,
        center: new THREE.Vector3(0, 1.12, -1.37),
        normal: new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(18)), Math.cos(THREE.MathUtils.degToRad(18))),
        size: [3.3, 2.1] as [number, number],
      },
      phone: {
        ref: phoneRef,
        center: new THREE.Vector3(0, 0, 0),
        normal: new THREE.Vector3(0, 0, 1),
        size: [0.85, 1.75] as [number, number],
      },
    }),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = reducedMotion ? 0 : 1
    if (laptopMotion.current) {
      laptopMotion.current.rotation.y = Math.sin(t * 0.22) * 0.05 * m
    }
    if (phoneMotion.current) {
      const calm = focus === 'phone' ? 0.3 : 1
      phoneMotion.current.position.y = Math.sin(t * 0.8) * 0.06 * m * calm
      phoneMotion.current.rotation.y = Math.sin(t * 0.35) * 0.08 * m * calm
      phoneMotion.current.rotation.x = Math.cos(t * 0.5) * 0.03 * m * calm
    }
  })

  const setHover = (t: Exclude<FocusTarget, null>) => (v: boolean) => {
    if (v) onHover(t)
    else if (hovered === t) onHover(null)
  }

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  return (
    <>
      <CameraRig focus={focus} specs={specs} reducedMotion={reducedMotion} layout={layout} />
      <HotspotProjector anchors={anchors} />
      <group position={layout.group} scale={layout.scale}>
        {/* Ноутбук */}
        <group ref={laptopMotion} position={layout.laptop.pos}>
          <group ref={laptopRef} rotation-y={layout.laptop.rotY}>
            <Laptop
              hovered={hovered === 'laptop'}
              focused={focus === 'laptop'}
              dimmed={focus === 'phone'}
              reducedMotion={reducedMotion}
              onHover={setHover('laptop')}
              onSelect={() => onFocus('laptop')}
              anisotropy={anisotropy}
            />
            <object3D ref={laptopAnchor} position={[-1.15, 2.2, -1.6]} />
          </group>
        </group>

        {/* Смартфон */}
        <group position={layout.phone.pos}>
          <group ref={phoneMotion}>
            <group ref={phoneRef} rotation={layout.phone.rot}>
              <Phone
                hovered={hovered === 'phone'}
                focused={focus === 'phone'}
                dimmed={focus === 'laptop'}
                onHover={setHover('phone')}
                onSelect={() => onFocus('phone')}
                anisotropy={anisotropy}
              />
              <object3D ref={phoneAnchor} position={[0.1, 1.08, 0]} />
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

  return (
    <Canvas
      className="scene-canvas"
      frameloop={paused ? 'never' : 'always'}
      dpr={degraded ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ position: DEFAULT_CAM.toArray(), fov: FOV, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onError()
        })
      }}
      onPointerMissed={() => props.focus && props.onFocus(null)}
    >
      <color attach="background" args={['#080B0A']} />
      <fog attach="fog" args={['#080B0A', 10, 26]} />
      <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} onFallback={() => setDegraded(true)} />
      <AdaptiveDpr pixelated={false} />
      <Lights />
      <Suspense fallback={null}>
        <StudioEnvironment />
        <Composition {...rest} reducedMotion={reducedMotion} lowPower={lowPower} />
        <LightLines animate={!reducedMotion} />
        <Dust count={degraded ? 40 : 110} />
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
