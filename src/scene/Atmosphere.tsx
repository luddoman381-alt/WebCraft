import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Grid, Lightformer, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Окружение для отражений собирается из процедурных источников света
 * (Lightformer) — без HDR-файлов и сетевых запросов.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#050706']} />
      {/* Большой мягкий софтбокс сверху */}
      <Lightformer form="rect" intensity={2.2} color="#e8f2ec" position={[0, 6, -2]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} />
      {/* Длинные полосы — дают «автомобильные» блики на металле */}
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[-6, 1.5, 1]} rotation-y={Math.PI / 2} scale={[8, 0.35, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[6, 2.5, 0]} rotation-y={-Math.PI / 2} scale={[8, 0.25, 1]} />
      {/* Зелёный контровой источник */}
      <Lightformer form="rect" intensity={3} color="#39FF88" position={[0, 0.5, -6]} scale={[12, 0.18, 1]} />
      <Lightformer form="ring" intensity={1.4} color="#17C964" position={[4, 3, 4]} scale={2} />
    </Environment>
  )
}

/** Горизонтальные световые линии в глубине сцены. */
export function LightLines({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null)
  const lines = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        y: -0.9 + i * 0.62 + (i % 3) * 0.11,
        z: -7 - (i % 4) * 1.6,
        len: 5 + ((i * 7) % 6),
        x: ((i * 37) % 13) - 6,
        speed: 0.25 + ((i * 13) % 7) * 0.06,
        opacity: 0.18 + ((i * 11) % 5) * 0.08,
      })),
    [],
  )
  const mats = useMemo(
    () =>
      lines.map(
        (l) =>
          new THREE.MeshBasicMaterial({
            color: '#39FF88',
            transparent: true,
            opacity: l.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [lines],
  )

  useFrame((_, delta) => {
    if (!animate || !group.current) return
    group.current.children.forEach((child, i) => {
      const l = lines[i]
      child.position.x += l.speed * delta * (i % 2 ? 1 : -1)
      if (child.position.x > 14) child.position.x = -14
      if (child.position.x < -14) child.position.x = 14
    })
  })

  return (
    <group ref={group}>
      {lines.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} material={mats[i]}>
          <planeGeometry args={[l.len, 0.012]} />
        </mesh>
      ))}
    </group>
  )
}

export function Floor() {
  return (
    <group position={[0, -1.2, 0]}>
      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#13261b"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#1d5c37"
        fadeDistance={22}
        fadeStrength={1.6}
        infiniteGrid
        followCamera={false}
      />
      {/* Отражающая тёмная подложка */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#060807" roughness={0.6} metalness={0.4} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

export function Dust({ count }: { count: number }) {
  return <Sparkles count={count} scale={[14, 6, 8]} position={[0, 1, -1]} size={1.6} speed={0.18} opacity={0.5} color="#39FF88" noise={0.6} />
}
