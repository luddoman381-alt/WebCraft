import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Keyboard } from '../../scene/Laptop'
import { LightLines, StudioEnvironment } from '../../scene/Atmosphere'
import { createAccentMaterial, createBodyMaterial, createGlassMaterial } from '../../scene/materials'
import { about } from './aboutStore'
import { buildStrips, type Strip } from './strips'
import { ScreenRenderer } from './screenRenderer'

/* Геометрия ноутбука — те же пропорции, что у ноутбука на главной */
const W = 3.2
const D = 2.2
const BASE_H = 0.11
const LID_H = 2.08
const LID_T = 0.06
const HINGE = new THREE.Vector3(0, BASE_H + 0.02, -D / 2 + 0.05)
const LID_CLOSED = Math.PI / 2
const LID_OPEN = -THREE.MathUtils.degToRad(18)
const SCREEN_W = W - 0.2
const SCREEN_H = SCREEN_W / 1.6

const FOV = 35
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const CAM_Z = 8

type Layout = {
  scale: number
  /** ширина экрана ноутбука на финальном кадре, CSS px — для выбора размера шрифта терминала */
  screenPx: number
  button: { w: number; h: number; y: number }
  assemble: { pos: THREE.Vector3; rot: THREE.Euler }
  open: { pos: THREE.Vector3; rot: THREE.Euler }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function useLayout(buttonPx: { w: number; h: number }): Layout {
  const size = useThree((s) => s.size)
  return useMemo(() => {
    const aspect = size.width / size.height
    const visH = 2 * CAM_Z * TAN
    const visW = visH * aspect
    const scale = Math.min(1, (visW * 0.74) / 3.4)
    const px = visH / size.height
    return {
      scale,
      // кадр у экрана: на узких экранах экран занимает ~95% ширины, иначе ~70% (см. CameraRig)
      screenPx: aspect < 0.8 ? size.width * 0.95 : Math.min(size.width * 0.7, ((size.height * 0.74) / SCREEN_H) * SCREEN_W),
      button: { w: buttonPx.w * px, h: buttonPx.h * px, y: 0 },
      // поза сборки: закрытый ноутбук наклонён к зрителю — силуэт читается сразу
      assemble: { pos: new THREE.Vector3(0, -0.1 * scale, 0), rot: new THREE.Euler(0.62, -0.5, 0.04) },
      // рабочая поза: ноутбук стоит ровно, экран к камере
      open: { pos: new THREE.Vector3(0, -0.85 * scale, 0), rot: new THREE.Euler(0.06, 0, 0) },
    }
  }, [size.width, size.height, buttonPx.w, buttonPx.h])
}

/* -------------------------------------------------------------------------- */
/* Полосы                                                                      */
/* -------------------------------------------------------------------------- */

function Strips({ layout, count }: { layout: Layout; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const strips = useMemo<Strip[]>(() => {
    const m = new THREE.Matrix4().compose(
      layout.assemble.pos,
      new THREE.Quaternion().setFromEuler(layout.assemble.rot),
      new THREE.Vector3().setScalar(layout.scale),
    )
    return buildStrips(count, layout.button, m)
  }, [layout, count])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#39FF88',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )

  const t = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      tw: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      base: new THREE.Color('#39FF88'),
    }),
    [],
  )

  useFrame((state) => {
    const im = mesh.current
    if (!im) return
    const ph = about.phase
    const active = ph === 'idle' || ph === 'assembling' || ph === 'disassembling'
    const opacity = active ? (0.62 + 0.38 * about.glow + 0.22 * about.hover) * (1 - about.solid) : 0
    im.visible = opacity > 0.004
    if (!im.visible) return
    material.opacity = Math.min(1, opacity)
    // яркость выше 1 — источник свечения для bloom
    material.color.copy(t.base).multiplyScalar(1 + about.glow * 1.8 + about.hover * 0.5)
    const thick = 0.012 * layout.scale * (1 + about.glow * 0.7)
    const time = state.clock.elapsedTime
    strips.forEach((s, i) => {
      const e = easeInOut(clamp01((about.morph - s.delay) / 0.66))
      const arc = Math.sin(Math.PI * e)
      // квадратичная кривая Безье a → c → b
      const u = 1 - e
      t.p.set(
        u * u * s.a.x + 2 * u * e * s.c.x + e * e * s.b.x,
        u * u * s.a.y + 2 * u * e * s.c.y + e * e * s.b.y,
        u * u * s.a.z + 2 * u * e * s.c.z + e * e * s.b.z,
      )
      // в покое — едва заметное «дыхание» контура кнопки
      if (e === 0) t.p.z += Math.sin(time * 1.4 + i * 0.3) * 0.004
      t.q.slerpQuaternions(s.qa, s.qb, e)
      t.tw.setFromAxisAngle(s.twistAxis, s.twist * arc)
      t.q.premultiply(t.tw)
      const len = (s.la + (s.lb - s.la) * e) * (1 + arc * 1.4)
      t.s.set(len, thick, thick)
      t.m.compose(t.p, t.q, t.s)
      im.setMatrixAt(i, t.m)
    })
    im.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, material, strips.length]} frustumCulled={false} />
}

/* -------------------------------------------------------------------------- */
/* Ноутбук                                                                     */
/* -------------------------------------------------------------------------- */

function AboutLaptop({
  layout,
  screen,
  onScreenDone,
}: {
  layout: Layout
  screen: ScreenRenderer
  onScreenDone: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const lid = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const mats = useMemo(() => {
    screen.texture.anisotropy = Math.min(8, anisotropy)
    return {
      body: createBodyMaterial(),
      glass: createGlassMaterial(),
      accent: createAccentMaterial(1.4),
      key: new THREE.MeshStandardMaterial({ color: '#0c0f0e', roughness: 0.7, metalness: 0.2 }),
      deck: new THREE.MeshStandardMaterial({ color: '#121715', roughness: 0.55, metalness: 0.6 }),
      pad: new THREE.MeshPhysicalMaterial({ color: '#171d1a', roughness: 0.45, metalness: 0.35, clearcoat: 0.25 }),
      screen: new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false, color: new THREE.Color(0, 0, 0) }),
    }
  }, [screen, anisotropy])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const fading = useMemo(() => Object.values(mats), [mats])

  const tmp = useMemo(() => ({ q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), done: '' }), [])

  useFrame((_, rawDelta) => {
    const g = group.current
    if (!g) return
    const delta = Math.min(rawDelta, 1 / 20)

    // проявление корпуса: прозрачность только во время перехода
    g.visible = about.solid > 0.003
    const solid = about.solid
    for (const m of fading) {
      const wantTransparent = solid < 0.999
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent
        m.needsUpdate = true
      }
      m.opacity = solid
    }

    // поза: сборка → рабочее положение
    const k = easeInOut(about.pose)
    g.position.lerpVectors(layout.assemble.pos, layout.open.pos, k)
    tmp.q0.setFromEuler(layout.assemble.rot)
    tmp.q1.setFromEuler(layout.open.rot)
    g.quaternion.slerpQuaternions(tmp.q0, tmp.q1, k)
    g.scale.setScalar(layout.scale * (0.985 + 0.015 * solid))

    if (lid.current) lid.current.rotation.x = LID_CLOSED + (LID_OPEN - LID_CLOSED) * about.lid

    // экран
    mats.screen.color.setScalar(about.power)
    if (glow.current) glow.current.intensity = about.power * 2.4

    const phase = about.phase
    if (phase === 'splash' || phase === 'terminal') {
      about.clock += delta * 1000
      if (phase === 'splash') screen.drawSplash(about.clock)
      else screen.drawTerminal(about.clock)
      const finished = phase === 'splash' ? about.clock >= screen.splashTotal : screen.terminalDone(about.clock)
      // сообщаем один раз за фазу
      if (finished && tmp.done !== phase) {
        tmp.done = phase
        onScreenDone()
      }
    } else {
      tmp.done = ''
      if (phase === 'idle' || phase === 'assembling') screen.clear()
    }
  })

  return (
    <group ref={group} visible={false}>
      <RoundedBox args={[W, BASE_H, D]} radius={0.05} smoothness={4} position={[0, BASE_H / 2, 0]} material={mats.body} />
      <mesh position={[0, BASE_H + 0.001, -0.28]} rotation={[-Math.PI / 2, 0, 0]} material={mats.deck}>
        <planeGeometry args={[W - 0.34, 1.12]} />
      </mesh>
      <group position={[0, BASE_H + 0.01, 0]}>
        <Keyboard material={mats.key} />
      </group>
      <RoundedBox args={[1.25, 0.006, 0.72]} radius={0.003} smoothness={2} position={[0, BASE_H + 0.002, 0.62]} material={mats.pad} />
      <mesh position={[0, 0.035, D / 2 + 0.002]} material={mats.accent}>
        <boxGeometry args={[W * 0.42, 0.008, 0.004]} />
      </mesh>
      <mesh position={[0, HINGE.y, HINGE.z]} rotation={[0, 0, Math.PI / 2]} material={mats.body}>
        <cylinderGeometry args={[0.05, 0.05, W * 0.82, 24]} />
      </mesh>
      <group ref={lid} position={HINGE} rotation={[LID_CLOSED, 0, 0]}>
        <group position={[0, LID_H / 2, 0]}>
          <RoundedBox args={[W, LID_H, LID_T]} radius={0.03} smoothness={4} position={[0, 0, -LID_T / 2]} material={mats.body} />
          <mesh position={[0, 0, 0.002]} material={mats.glass}>
            <planeGeometry args={[W - 0.06, LID_H - 0.06]} />
          </mesh>
          <mesh position={[0, 0.03, 0.004]} material={mats.screen}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          </mesh>
          <mesh position={[0, 0, -LID_T - 0.001]} rotation={[0, Math.PI, 0]} material={mats.accent}>
            <ringGeometry args={[0.13, 0.145, 4, 1, Math.PI / 4]} />
          </mesh>
          <pointLight ref={glow} position={[0, -0.2, 0.9]} color="#39FF88" intensity={0} distance={3.2} decay={2} />
        </group>
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Камера                                                                      */
/* -------------------------------------------------------------------------- */

function CameraRig({ layout, reducedMotion }: { layout: Layout; reducedMotion: boolean }) {
  const { camera, size, pointer } = useThree()
  // кадр у экрана считается по «призраку» — ноутбуку в финальной позе
  const target = useMemo(() => {
    const root = new THREE.Object3D()
    root.position.copy(layout.open.pos)
    root.rotation.copy(layout.open.rot)
    root.scale.setScalar(layout.scale)
    const hinge = new THREE.Object3D()
    hinge.position.copy(HINGE)
    hinge.rotation.x = LID_OPEN
    const anchor = new THREE.Object3D()
    anchor.position.set(0, LID_H / 2 + 0.03, 0.004)
    root.add(hinge)
    hinge.add(anchor)
    root.updateMatrixWorld(true)
    const center = new THREE.Vector3().setFromMatrixPosition(anchor.matrixWorld)
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(anchor.matrixWorld)
    const aspect = size.width / size.height
    const sw = SCREEN_W * layout.scale
    const sh = SCREEN_H * layout.scale
    const d =
      aspect < 0.8
        ? sw / (2 * TAN * aspect * 0.95)
        : Math.max(sh / (2 * TAN * 0.74), sw / (2 * TAN * aspect * 0.7))
    return { look: center, pos: center.clone().addScaledVector(normal, d) }
  }, [layout, size.width, size.height])

  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), cur: new THREE.Vector3() }), [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const c = about.cam
    const arc = Math.sin(Math.PI * c)
    tmp.pos.set(0, 0, CAM_Z).lerp(target.pos, c)
    tmp.pos.y += arc * 0.55 * layout.scale
    tmp.pos.z += arc * 0.6
    tmp.look.set(0, 0, 0).lerp(target.look, c)
    // лёгкий параллакс только на общем плане
    if (!reducedMotion) {
      const free = 1 - c
      tmp.pos.x += pointer.x * 0.25 * free + Math.sin(state.clock.elapsedTime * 0.2) * 0.05 * free
      tmp.pos.y += pointer.y * 0.15 * free
    }
    camera.position.lerp(tmp.pos, 1 - Math.exp(-delta * 10))
    tmp.cur.lerp(tmp.look, 1 - Math.exp(-delta * 10))
    camera.lookAt(tmp.cur)
  })

  return null
}

/** Мягкое свечение за кнопкой. */
function Halo({ layout }: { layout: Layout }) {
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    return new THREE.MeshBasicMaterial({ map: tex, color: '#39FF88', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  }, [])
  useEffect(
    () => () => {
      mat.map?.dispose()
      mat.dispose()
    },
    [mat],
  )
  useFrame(() => {
    mat.opacity = (0.05 + about.glow * 0.2 + about.hover * 0.05) * (1 - about.cam) * (1 - about.solid * 0.6)
  })
  return (
    <mesh position={[0, layout.button.y, -0.6]} material={mat} raycast={() => null}>
      <planeGeometry args={[layout.button.w * 1.8, layout.button.h * 3.6]} />
    </mesh>
  )
}

function Content({
  buttonPx,
  reducedMotion,
  lowPower,
  onScreenDone,
}: {
  buttonPx: { w: number; h: number }
  reducedMotion: boolean
  lowPower: boolean
  onScreenDone: () => void
}) {
  const layout = useLayout(buttonPx)
  const screen = useMemo(() => new ScreenRenderer(8), [])
  useEffect(() => () => screen.dispose(), [screen])
  useLayoutEffect(() => {
    screen.configure(layout.screenPx, reducedMotion)
  }, [screen, layout.screenPx, reducedMotion])

  return (
    <>
      <CameraRig layout={layout} reducedMotion={reducedMotion} />
      <Halo layout={layout} />
      <Strips layout={layout} count={lowPower ? 110 : 170} />
      <AboutLaptop layout={layout} screen={screen} onScreenDone={onScreenDone} />
      <group position={[0, 0, -2]}>
        <LightLines animate={!reducedMotion} />
      </group>
    </>
  )
}

export default function AboutScene(props: {
  buttonPx: { w: number; h: number }
  reducedMotion: boolean
  lowPower: boolean
  onScreenDone: () => void
  onError: () => void
}) {
  const { lowPower, onError } = props
  return (
    <Canvas
      className="about__canvas"
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.05, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onError()
        })
      }}
    >
      <color attach="background" args={['#080B0A']} />
      <fog attach="fog" args={['#080B0A', 9, 26]} />
      <ambientLight intensity={0.14} />
      <directionalLight position={[-4, 6, 5]} intensity={1.3} color="#f2f7f3" />
      <directionalLight position={[5, 2, -4]} intensity={2} color="#39FF88" />
      <spotLight position={[0, 7, 3]} angle={0.55} penumbra={1} intensity={26} distance={16} color="#dfeee5" />
      <StudioEnvironment />
      <Content {...props} />
      {!lowPower && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={0.85} radius={0.7} />
          <Vignette offset={0.3} darkness={0.7} eskil={false} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
