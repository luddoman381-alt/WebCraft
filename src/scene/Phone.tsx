import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createPhoneScreenTexture } from './screenTextures'
import { createAccentMaterial, createBodyMaterial, createGlassMaterial, createScreenMaterial } from './materials'

const W = 0.8
const H = 1.66
const T = 0.075
const R = 0.11

type Props = {
  hovered: boolean
  focused: boolean
  dimmed: boolean
  onHover: (v: boolean) => void
  onSelect: () => void
  anisotropy: number
}

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/** Плоская скруглённая геометрия с UV, нормализованными в 0..1. */
function roundedPlane(w: number, h: number, r: number) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12)
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

export function Phone({ hovered, focused, dimmed, onHover, onSelect, anisotropy }: Props) {
  const halo = useRef<THREE.Mesh>(null)
  const rimLight = useRef<THREE.PointLight>(null)

  const res = useMemo(() => {
    const tex = createPhoneScreenTexture(anisotropy)
    const sw = W - 0.06
    const sh = H - 0.06
    // контур-обводка
    const pts = roundedRectShape(W + 0.012, H + 0.012, R + 0.006).getPoints(24)
    const outline = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)))
    const bevel = 0.018
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(W - bevel * 2, H - bevel * 2, R - bevel), {
      depth: T - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 5,
      curveSegments: 16,
    })
    bodyGeo.translate(0, 0, -(T - bevel * 2) / 2)
    return {
      tex,
      bodyGeo,
      body: createBodyMaterial(),
      glass: createGlassMaterial(),
      screen: createScreenMaterial(tex),
      accent: createAccentMaterial(1.2),
      lens: new THREE.MeshPhysicalMaterial({ color: '#050706', roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
      screenGeo: roundedPlane(sw, sh, R - 0.03),
      glassGeo: roundedPlane(W - 0.012, H - 0.012, R - 0.006),
      haloGeo: roundedPlane(W + 0.5, H + 0.5, R + 0.25),
      haloMat: new THREE.MeshBasicMaterial({
        color: '#39FF88',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        alphaMap: createHaloAlpha(),
      }),
      outline,
      outlineMat: new THREE.LineBasicMaterial({ color: '#39FF88', transparent: true, opacity: 0.35 }),
    }
  }, [anisotropy])

  useEffect(
    () => () => {
      Object.values(res).forEach((v) => (v as { dispose?: () => void }).dispose?.())
    },
    [res],
  )

  useFrame((_, delta) => {
    const active = hovered || focused
    res.screen.emissiveIntensity = THREE.MathUtils.damp(res.screen.emissiveIntensity, dimmed ? 0.35 : active ? 1.3 : 0.9, 6, delta)
    res.outlineMat.opacity = THREE.MathUtils.damp(res.outlineMat.opacity, dimmed ? 0.08 : active ? 1 : 0.35, 6, delta)
    res.haloMat.opacity = THREE.MathUtils.damp(res.haloMat.opacity, dimmed ? 0 : active ? 0.32 : 0.1, 5, delta)
    res.accent.emissiveIntensity = THREE.MathUtils.damp(res.accent.emissiveIntensity, active ? 4 : 1.2, 6, delta)
    if (rimLight.current) {
      rimLight.current.intensity = THREE.MathUtils.damp(rimLight.current.intensity, dimmed ? 0.2 : active ? 7 : 1.6, 5, delta)
    }
  })

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(true)
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <group onPointerOver={handleOver} onPointerOut={() => onHover(false)} onClick={handleClick}>
      {/* Мягкое зелёное свечение за корпусом */}
      <mesh ref={halo} geometry={res.haloGeo} material={res.haloMat} position={[0, 0, -T / 2 - 0.05]} raycast={() => null} />

      <mesh geometry={res.bodyGeo} material={res.body} castShadow />
      <mesh geometry={res.glassGeo} material={res.glass} position={[0, 0, T / 2 + 0.001]} />
      <mesh geometry={res.screenGeo} material={res.screen} position={[0, 0, T / 2 + 0.002]} />
      {/* Динамический островок */}
      <mesh position={[0, H / 2 - 0.085, T / 2 + 0.003]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.021, 0.12, 4, 12]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Зелёный контур-акцент */}
      <lineLoop geometry={res.outline} material={res.outlineMat} position={[0, 0, T / 2 + 0.004]} />

      {/* Боковые кнопки */}
      <mesh position={[W / 2 + 0.006, 0.32, 0]} material={res.body}>
        <boxGeometry args={[0.014, 0.22, 0.03]} />
      </mesh>
      <mesh position={[-W / 2 - 0.006, 0.42, 0]} material={res.body}>
        <boxGeometry args={[0.014, 0.12, 0.03]} />
      </mesh>
      <mesh position={[-W / 2 - 0.006, 0.24, 0]} material={res.body}>
        <boxGeometry args={[0.014, 0.12, 0.03]} />
      </mesh>
      {/* Зелёная точка на кнопке питания */}
      <mesh position={[W / 2 + 0.014, 0.32, 0]} material={res.accent}>
        <boxGeometry args={[0.002, 0.05, 0.008]} />
      </mesh>

      {/* Блок камер на задней панели */}
      <group position={[-0.16, H / 2 - 0.3, -T / 2 - 0.012]}>
        <RoundedBox args={[0.34, 0.34, 0.024]} radius={0.01} smoothness={3} material={res.body} />
        {[
          [-0.075, 0.075],
          [0.075, -0.075],
          [-0.075, -0.075],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, -0.014]} rotation={[Math.PI / 2, 0, 0]} material={res.lens}>
            <cylinderGeometry args={[0.052, 0.052, 0.01, 32]} />
          </mesh>
        ))}
      </group>

      <pointLight ref={rimLight} position={[0.9, 0.4, 0.6]} color="#39FF88" intensity={1.6} distance={3.5} decay={2} />
    </group>
  )
}

/** Радиальная альфа-маска для ореола (мягкие края без постобработки). */
function createHaloAlpha() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64)
  g.addColorStop(0, '#9a9a9a')
  g.addColorStop(0.3, '#555555')
  g.addColorStop(0.65, '#181818')
  g.addColorStop(1, '#000000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  return t
}
