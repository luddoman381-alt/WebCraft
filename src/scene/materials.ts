import * as THREE from 'three'

/** Тёмный анодированный алюминий — основной материал корпусов. */
export function createBodyMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#1a1f1d',
    metalness: 0.92,
    roughness: 0.34,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.1,
  })
}

/** Глянцевое тёмное стекло рамки экрана. */
export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#040605',
    metalness: 0.2,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
  })
}

/** Материал экрана: текстура интерфейса светится сама (emissive). */
export function createScreenMaterial(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    color: '#000000',
    map,
    emissiveMap: map,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.9,
    // Матовое покрытие: без бликов окружения, которые bloom раздувает в пятна
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.08,
    toneMapped: false,
  })
}

/**
 * «Окно» в canvas: пишет в буфер кадра прозрачный пиксель (без смешивания),
 * сквозь который виден DOM-сайт под canvas. Глубину пишет как обычная
 * поверхность, поэтому объекты перед экраном (смартфон) его перекрывают.
 */
export function createScreenHoleMaterial() {
  return new THREE.MeshBasicMaterial({
    color: '#000000',
    opacity: 0,
    blending: THREE.NoBlending,
    toneMapped: false,
    fog: false,
  })
}

/** Зелёная световая полоса. */
export function createAccentMaterial(intensity = 2) {
  return new THREE.MeshStandardMaterial({
    color: '#0b2416',
    emissive: new THREE.Color('#39FF88'),
    emissiveIntensity: intensity,
    toneMapped: false,
  })
}
