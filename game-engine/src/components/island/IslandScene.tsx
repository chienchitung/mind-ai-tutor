'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, MeshReflectorMaterial, OrbitControls, Sparkles, Stars, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Flag } from 'lucide-react'
import type { GameVisualTemplate } from '../../types/game'
import { LAYOUT_FOR_TEMPLATE, regionsInUse, type IslandLayout, type IslandSpot } from '../../lib/island/layout'
import { ISLAND_MODELS, ISLAND_THEMES } from '../../lib/island/themes'
import { animateIsland, buildLand, buildRoute, markShared, type IslandModels, type IslandRouteStop } from '../../lib/island/builder'
import { animateCharacter, buildPlayer } from '../../lib/island/character'
import { FACE_CAMERA, WALK_SPEED, planWalk, redirectWalk, sampleWalk, standPoint, type Walk } from '../../lib/island/walker'
import { MAX_DISTANCE, VIEW_DIRECTION, frameOpenIsland } from '../../lib/island/framing'
import { gameAssetPath } from '../../lib/game-asset-path'

export interface IslandSceneStop extends IslandRouteStop { label: string; ariaLabel: string }

interface IslandSceneProps {
  template: GameVisualTemplate
  stops: IslandSceneStop[]
  selected: number
  /** Stop the player walks to; it starts at the student's current lesson. */
  walkTo: number
  /** Bumped when the student picks a stop that isn't open yet: the player shakes its head. */
  refusals: number
  onSelect: (index: number) => void
  reduceMotion: boolean
  /** Bloom and reflections cost GPU time; small screens skip them. */
  richEffects: boolean
}

/** The player is about this tall; the badge of the stop it stands at moves up to stay clear. */
const PLAYER_HEIGHT = 2
const CAMERA_FOV = 42
const MODEL_URLS = ISLAND_MODELS.map(name => gameAssetPath(`/island/kenney/${name}.glb`))
const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`

function useIslandModels(): IslandModels {
  // No Draco: the Kenney models are plain glTF, so no decoder is fetched.
  const gltfs = useGLTF(MODEL_URLS, false)
  return useMemo(() => Object.fromEntries(ISLAND_MODELS.map((name, i) => [name, markShared(gltfs[i].scene)])) as IslandModels, [gltfs])
}

function Sea({ template, reduceMotion }: { template: GameVisualTemplate; reduceMotion: boolean }) {
  const theme = ISLAND_THEMES[template]
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(160, 160, 48, 48)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }) => {
    if (reduceMotion || theme.sea === 'void') return
    const t = clock.elapsedTime, p = geometry.attributes.position.array as Float32Array, amp = theme.sea === 'grid' ? 0.05 : 1
    for (let k = 0; k < p.length; k += 3) p[k + 1] = base[k + 1] + (Math.sin(p[k] * 0.35 + t * 0.9) * 0.12 + Math.cos(p[k + 2] * 0.3 + t * 0.7) * 0.1) * amp
    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
  })
  if (theme.sea === 'void') return null
  return <>
    <mesh geometry={geometry} position={[0, -0.35, 0]} receiveShadow>
      <meshStandardMaterial color={theme.seaColor} flatShading roughness={0.6} metalness={0.05} />
    </mesh>
    {theme.sea === 'grid' && <gridHelper args={[160, 80, 0xff4fd8, 0x49e7ff]} position={[0, -0.2, 0]} material-transparent material-opacity={0.35} />}
  </>
}

function World({ template, stops, selected, walkTo, refusals, onSelect, reduceMotion, richEffects }: IslandSceneProps) {
  const theme = ISLAND_THEMES[template]
  const layout = LAYOUT_FOR_TEMPLATE[template]
  const models = useIslandModels()
  const land = useMemo(() => buildLand(theme, layout, models), [theme, layout, models])
  useEffect(() => () => land.dispose(), [land])
  // Rebuilt only when a lesson's state changes, not on every render
  const stopsKey = stops.map(stop => `${stop.status}${stop.intro ? 'i' : ''}${stop.final ? 'f' : ''}`).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const route = useMemo(() => buildRoute(theme, land.spots, stops, models), [theme, land, models, stopsKey])
  useEffect(() => () => route.dispose(), [route])

  useEffect(() => {
    const used = regionsInUse(stops.length)
    land.regions.forEach((group, r) => { group.visible = used[r] })
    land.stages.forEach(stage => { stage.visible = stage.userData.spotIndex < stops.length })
  }, [land, stops.length])

  // The player walks the route
  const player = useMemo(() => {
    const figure = buildPlayer(template)
    // A ring in the template's accent marks the player wherever it walks
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 32), new THREE.MeshBasicMaterial({ color: theme.ring, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }))
    marker.rotation.x = -Math.PI / 2
    marker.position.y = 0.03
    figure.root.add(marker)
    return figure
  }, [template, theme.ring])
  useEffect(() => () => player.dispose(), [player])
  const walk = usePlayerWalk(layout, land.spots, Math.min(walkTo, stops.length - 1), reduceMotion)
  const refusedAt = useRef(-Infinity)
  useEffect(() => { if (refusals) refusedAt.current = performance.now() }, [refusals])

  // The camera frames the island's open part until the student picks a stop, then follows the pick
  const controls = useThree(state => state.controls) as unknown as { target: THREE.Vector3; maxDistance: number; update: () => void } | null
  const camera = useThree(state => state.camera)
  const scene = useThree(state => state.scene)
  const aspect = useThree(state => state.size.width / Math.max(1, state.size.height))
  const framing = useMemo(() => frameOpenIsland(land.spots, stops.length, aspect, CAMERA_FOV), [land, stops.length, aspect])
  useEffect(() => {
    const { center, distance } = framing
    camera.position.set(center.x + VIEW_DIRECTION.x * distance, center.y + VIEW_DIRECTION.y * distance, center.z + VIEW_DIRECTION.z * distance)
    if (controls) {
      // A narrow view may need the camera further back than the usual zoom-out limit
      controls.maxDistance = Math.max(MAX_DISTANCE, distance + 4)
      controls.target.set(center.x, center.y, center.z); controls.update()
    }
    // Haze begins past the island, however far back the camera is
    if (scene.fog instanceof THREE.Fog) { scene.fog.near = distance + 10; scene.fog.far = distance + 75 }
  }, [framing, camera, controls, scene])
  const firstSelection = useRef(selected)
  const picked = useRef(false)
  if (selected !== firstSelection.current) picked.current = true
  const focus = useMemo(() => new THREE.Vector3(), [])
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, delta) => {
    const frame = walk.advance(delta)
    player.root.position.set(frame.position.x, frame.position.y, frame.position.z)
    player.root.rotation.y = frame.heading
    // Reduced motion: the walk is instant and the player holds still
    const time = reduceMotion ? 0 : clock.elapsedTime
    // The player shakes its head when the student picks a stop that isn't open yet
    const shake = reduceMotion ? 0 : Math.max(0, 1 - (performance.now() - refusedAt.current) / 700)
    animateCharacter(player, time, { moving: frame.moving, hopping: frame.hopping, shake })
    // While the player walks the camera follows; after a pick it frames the picked stop.
    const spot = land.spots[Math.min(selected, stops.length - 1)]
    if (frame.moving) focus.set(frame.position.x, frame.position.y + 0.4, frame.position.z)
    else if (picked.current) focus.set(spot.x, spot.y + 0.4, spot.z)
    else focus.set(framing.center.x, framing.center.y, framing.center.z)
    if (controls) { controls.target.lerp(focus, reduceMotion ? 1 : 0.06); controls.update() }
    if (reduceMotion) return
    const t = clock.elapsedTime
    animateIsland(land.root, t)
    animateIsland(route.root, t)
    if (land.boat) { land.boat.position.y = -0.25 + Math.sin(t * 1.3) * 0.06; land.boat.rotation.z = Math.sin(t * 1.1) * 0.05 }
    if (layout === 'floaters' || layout === 'station') land.regions.forEach((group, r) => { group.position.y = Math.sin(t * 0.6 + r) * 0.08 })
    if (ring.current) {
      const material = ring.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.55 + Math.sin(t * 3) * 0.3
      ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.05)
    }
  })

  const pick = (event: ThreeEvent<MouseEvent>) => {
    let object: THREE.Object3D | null = event.object
    while (object && object.userData.lessonIndex === undefined) object = object.parent
    if (!object) return
    event.stopPropagation()
    onSelect(object.userData.lessonIndex as number)
  }

  const current = stops.findIndex(stop => stop.status === 'current')
  const currentSpot = current >= 0 ? land.spots[current] : null

  return <>
    <color attach="background" args={[theme.sky]} />
    <fog attach="fog" args={[theme.sky, 40, 90]} />
    <hemisphereLight args={[theme.hemi[0], theme.hemi[1], theme.hemi[2]]} />
    <directionalLight castShadow position={[12, 22, 10]} intensity={theme.sun} shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} />
    <Sea template={template} reduceMotion={reduceMotion} />
    {theme.skyTop !== undefined && <SkyDome top={theme.skyTop} bottom={theme.sky} />}
    {theme.stars && <Stars radius={70} depth={30} count={1500} factor={3} saturation={0} fade speed={reduceMotion ? 0 : 0.5} />}
    {template === 'arcane-archive' && <Sparkles count={70} scale={[30, 8, 30]} position={[0, 3, -1]} size={3} speed={reduceMotion ? 0 : 0.3} color="#f0d28c" />}
    <primitive object={land.root} />
    {land.lake && <mesh rotation-x={-Math.PI / 2} position={[land.lake.x, land.lake.y, land.lake.z]}>
      <circleGeometry args={[land.lake.radius, 40]} />
      {richEffects
        ? <MeshReflectorMaterial color={hex(theme.lake ?? 0x74c6cc)} blur={[200, 80]} resolution={512} mixBlur={1} mixStrength={0.4} roughness={0.5} depthScale={0.4} minDepthThreshold={0.4} maxDepthThreshold={1.2} metalness={0.05} mirror={0.3} />
        : <meshStandardMaterial color={hex(theme.lake ?? 0x74c6cc)} roughness={0.3} />}
    </mesh>}
    <primitive object={route.root} onClick={pick} />
    {currentSpot && <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[currentSpot.x, currentSpot.y + 0.06, currentSpot.z]}>
        <ringGeometry args={[0.85, 1.05, 32]} />
        <meshBasicMaterial color={theme.ring} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Sparkles count={18} scale={[2, 2, 2]} position={[currentSpot.x, currentSpot.y + 1, currentSpot.z]} size={4} speed={reduceMotion ? 0 : 0.6} color={hex(theme.ring)} />
    </>}
    <primitive object={player.root} />
    {route.labels.map((position, i) => <Html key={i} position={i === walkTo ? [position.x, position.y + PLAYER_HEIGHT * 0.75, position.z] : position} center zIndexRange={[30, 0]}>
      <button type="button" className={`island-badge is-${stops[i].status}${stops[i].final ? ' is-final' : ''}${i === selected ? ' is-selected' : ''}`}
        aria-label={stops[i].ariaLabel} aria-pressed={i === selected} onClick={() => onSelect(i)}>{stops[i].intro ? <Flag size={14} strokeWidth={2.5} aria-hidden="true" /> : stops[i].label}</button>
    </Html>)}
    {richEffects && theme.glow && <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.75} intensity={0.9} />
    </EffectComposer>}
  </>
}

/** Keeps the player's walk along the route, re-planning from where it is whenever the target changes. */
function usePlayerWalk(layout: IslandLayout, spots: IslandSpot[], target: number, reduceMotion: boolean) {
  const state = useRef<{ walk: Walk; travelled: number } | null>(null)
  if (!state.current) state.current = { walk: planWalk(layout, spots, standPoint(spots[target], layout), target, target, target), travelled: 0 }
  useEffect(() => {
    const s = state.current!
    if (s.walk.target === target) return
    s.walk = redirectWalk(layout, spots, s.walk, s.travelled, target)
    s.travelled = 0
  }, [layout, spots, target])
  return {
    advance(delta: number) {
      const s = state.current!
      s.travelled = reduceMotion ? s.walk.total : s.travelled + Math.min(delta, 0.1) * WALK_SPEED
      const frame = sampleWalk(s.walk, s.travelled)
      return { position: frame.position, heading: frame.done ? FACE_CAMERA : frame.heading, moving: !frame.done, hopping: frame.hopping }
    },
  }
}

/** A large sphere seen from inside, coloured from `top` overhead down to `bottom` at the horizon. */
function SkyDome({ top, bottom }: { top: number; bottom: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(SKY_RADIUS, 32, 16)
    const low = new THREE.Color(bottom), high = new THREE.Color(top), c = new THREE.Color(), colors: number[] = []
    const pos = geo.attributes.position
    for (let k = 0; k < pos.count; k++) {
      c.copy(low).lerp(high, THREE.MathUtils.smoothstep(pos.getY(k) / SKY_RADIUS, -0.05, 0.6))
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geo
  }, [top, bottom])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry}><meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} /></mesh>
}
const SKY_RADIUS = 150

export default function IslandScene(props: IslandSceneProps) {
  return <Canvas shadows flat dpr={[1, 1.75]} camera={{ position: [11, 13.5, 17.5], fov: CAMERA_FOV, near: 0.1, far: 220 }} aria-label="島嶼地圖">
    <OrbitControls makeDefault enableDamping minDistance={7} maxDistance={MAX_DISTANCE} maxPolarAngle={Math.PI * 0.44} />
    <World {...props} />
  </Canvas>
}
