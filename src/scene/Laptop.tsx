import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createLaptopScreenTexture } from './screenTextures'
import { createAccentMaterial, createBodyMaterial, createGlassMaterial, createScreenHoleMaterial, createScreenMaterial } from './materials'
import { dive, screenAnchor, screenLight, SCREEN_SIZE } from '../dive/diveStore'

/*
 * Процедурный ноутбук. Размеры в условных единицах сцены (~ метры * 10).
 * Ширина 3.2, глубина 2.2. Крышка вращается вокруг заднего края (шарнира).
 */

const W = 3.2
const D = 2.2
const BASE_H = 0.11
const LID_H = 2.08
const LID_T = 0.06
const OPEN_ANGLE = THREE.MathUtils.degToRad(108)

type Props = {
  hovered: boolean
  focused: boolean
  dimmed: boolean
  reducedMotion: boolean
  onHover: (v: boolean) => void
  onSelect: () => void
  anisotropy: number
  /**
   * Экран показывает настоящий DOM-сайт (canvas здесь прозрачен).
   * false — запасной вариант с процедурной текстурой.
   */
  liveScreen: boolean
}

export function Keyboard({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const cols = 14
  const rows = 5
  const count = cols * rows + 1 // + пробел
  const keyW = 0.16
  const gap = 0.032
  const totalW = cols * keyW + (cols - 1) * gap

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -totalW / 2 + keyW / 2 + c * (keyW + gap)
        const z = -0.86 + r * (keyW + gap)
        m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1))
        mesh.setMatrixAt(i++, m)
      }
    }
    // пробел
    const spaceZ = -0.86 + rows * (keyW + gap)
    m.compose(new THREE.Vector3(0, 0, spaceZ), q, new THREE.Vector3(6, 1, 1))
    mesh.setMatrixAt(i, m)
    mesh.instanceMatrix.needsUpdate = true
  }, [totalW])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={material} castShadow={false}>
      <boxGeometry args={[keyW, 0.018, keyW]} />
    </instancedMesh>
  )
}

export function Laptop({ hovered, focused, dimmed, reducedMotion, onHover, onSelect, anisotropy, liveScreen }: Props) {
  const lid = useRef<THREE.Group>(null)
  const glowLight = useRef<THREE.PointLight>(null)
  const anchorRef = useRef<THREE.Object3D>(null)

  useEffect(() => {
    screenAnchor.current = anchorRef.current
    return () => {
      if (screenAnchor.current === anchorRef.current) screenAnchor.current = null
    }
  }, [])

  const mats = useMemo(() => {
    const screenTex = createLaptopScreenTexture(anisotropy)
    return {
      body: createBodyMaterial(),
      glass: createGlassMaterial(),
      screen: createScreenMaterial(screenTex),
      screenTex,
      hole: createScreenHoleMaterial(),
      accent: createAccentMaterial(1.6),
      key: new THREE.MeshStandardMaterial({ color: '#0c0f0e', roughness: 0.7, metalness: 0.2 }),
      deck: new THREE.MeshStandardMaterial({ color: '#121715', roughness: 0.55, metalness: 0.6 }),
      pad: new THREE.MeshPhysicalMaterial({ color: '#171d1a', roughness: 0.45, metalness: 0.35, clearcoat: 0.25 }),
    }
  }, [anisotropy])

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => (m as THREE.Material | THREE.Texture).dispose())
    },
    [mats],
  )

  // Плавная подсветка при наведении / фокусе
  useFrame((state, delta) => {
    const diving = dive.phase !== 'idle'
    const active = hovered || focused || diving
    screenLight.dimTarget = diving ? 0 : dimmed ? 0.62 : active ? 0 : 0.14
    const screenTarget = dimmed ? 0.35 : active ? 1.35 : 0.9
    mats.screen.emissiveIntensity = THREE.MathUtils.damp(mats.screen.emissiveIntensity, screenTarget, 6, delta)
    const accentTarget = dimmed ? 0.4 : active ? 4.2 : 1.6
    mats.accent.emissiveIntensity = THREE.MathUtils.damp(mats.accent.emissiveIntensity, accentTarget, 6, delta)
    if (glowLight.current) {
      const lt = dimmed ? 0.2 : active ? 5 : 1.8
      glowLight.current.intensity = THREE.MathUtils.damp(glowLight.current.intensity, lt, 5, delta)
    }
    if (lid.current) {
      // едва заметное «дыхание» крышки
      // во время перехода крышка неподвижна: камера стыкуется с плоскостью экрана
      const breathe = reducedMotion || diving ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.012
      const tilt = !diving && (hovered || focused) ? -0.025 : 0
      lid.current.rotation.x = -OPEN_ANGLE + Math.PI / 2 + breathe + tilt
    }
  })

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(true)
  }
  const handleOut = () => onHover(false)
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
      {/* Нижняя часть корпуса */}
      <RoundedBox args={[W, BASE_H, D]} radius={0.05} smoothness={4} position={[0, BASE_H / 2, 0]} material={mats.body} castShadow receiveShadow />
      {/* Утопленная панель клавиатуры */}
      <mesh position={[0, BASE_H + 0.001, -0.28]} rotation={[-Math.PI / 2, 0, 0]} material={mats.deck}>
        <planeGeometry args={[W - 0.34, 1.12]} />
      </mesh>
      <group position={[0, BASE_H + 0.01, 0]}>
        <Keyboard material={mats.key} />
      </group>
      {/* Тачпад */}
      <RoundedBox args={[1.25, 0.006, 0.72]} radius={0.003} smoothness={2} position={[0, BASE_H + 0.002, 0.62]} material={mats.pad} />
      {/* Передняя световая кромка */}
      <mesh position={[0, 0.035, D / 2 + 0.002]} material={mats.accent}>
        <boxGeometry args={[W * 0.42, 0.008, 0.004]} />
      </mesh>
      {/* Шарнир */}
      <mesh position={[0, BASE_H + 0.02, -D / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]} material={mats.body}>
        <cylinderGeometry args={[0.05, 0.05, W * 0.82, 24]} />
      </mesh>

      {/* Крышка вращается вокруг шарнира */}
      <group ref={lid} position={[0, BASE_H + 0.02, -D / 2 + 0.05]} rotation={[-OPEN_ANGLE + Math.PI / 2, 0, 0]}>
        <group position={[0, LID_H / 2, 0]}>
          <RoundedBox args={[W, LID_H, LID_T]} radius={0.03} smoothness={4} position={[0, 0, -LID_T / 2]} material={mats.body} castShadow />
          {/* Стеклянная рамка */}
          <mesh position={[0, 0, 0.002]} material={mats.glass}>
            <planeGeometry args={[W - 0.06, LID_H - 0.06]} />
          </mesh>
          {/* Экран 16:10 */}
          <mesh position={[0, 0.03, 0.004]} material={liveScreen ? mats.hole : mats.screen}>
            <planeGeometry args={[SCREEN_SIZE.w, SCREEN_SIZE.h]} />
          </mesh>
          <object3D ref={anchorRef} position={[0, 0.03, 0.004]} />
          {/* Камера */}
          <mesh position={[0, LID_H / 2 - 0.05, 0.005]}>
            <circleGeometry args={[0.012, 16]} />
            <meshStandardMaterial color="#0a1a10" emissive="#17C964" emissiveIntensity={0.6} />
          </mesh>
          {/* Логотип на задней крышке */}
          <mesh position={[0, 0, -LID_T - 0.001]} rotation={[0, Math.PI, 0]} material={mats.accent}>
            <ringGeometry args={[0.13, 0.145, 4, 1, Math.PI / 4]} />
          </mesh>
          {/* Свет от экрана на клавиатуру */}
          <pointLight ref={glowLight} position={[0, -0.2, 0.9]} color="#39FF88" intensity={1.8} distance={3} decay={2} />
        </group>
      </group>
    </group>
  )
}
