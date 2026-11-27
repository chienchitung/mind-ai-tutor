import * as THREE from 'three'
import type { IslandLayout, IslandSpot } from './layout'
import { REGION_CENTERS, islandSpots } from './layout'
import type { IslandModelName, IslandTheme } from './themes'
import { DECORATION_MODELS } from './themes'

export type IslandModels = Partial<Record<IslandModelName, THREE.Object3D>>
export type StopStatus = 'done' | 'current' | 'locked'

/** Deterministic randomness: the same island every visit. */
function seeded(seed = 7) {
  let value = seed
  return () => ((value = (value * 16807) % 2147483647) / 2147483647)
}

class Kit {
  constructor(readonly theme: IslandTheme, readonly models: IslandModels) {}

  mat(color: number, extra: THREE.MeshStandardMaterialParameters & { glowable?: boolean } = {}) {
    const { glowable, ...rest } = extra
    const glow = this.theme.glow && glowable
    return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...(glow ? { emissive: color, emissiveIntensity: 0.6 } : {}), ...rest })
  }

  mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadow = true, outline = true) {
    const m = new THREE.Mesh(geo, material)
    m.castShadow = shadow
    m.receiveShadow = true
    if (outline && this.theme.outline !== undefined) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: this.theme.outline })))
    return m
  }

  neonEdges(geo: THREE.BufferGeometry, color: number) {
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color }))
  }

  glowMesh(geo: THREE.BufferGeometry, color: number) {
    // toneMapped off so bloom picks the colour up on night templates
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }))
  }

  model(name: IslandModelName, scale = 1) {
    const source = this.models[name]
    if (!source) return null
    const copy = source.clone(true)
    copy.scale.setScalar(scale)
    copy.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return copy
  }
}

// ---- Decorations: Kenney models where the template has them, simple shapes otherwise ----
function decoration(kit: Kit, rand: () => number) {
  const names = DECORATION_MODELS[kit.theme.decoration]
  if (names.length) {
    const model = kit.model(names[Math.floor(rand() * names.length)], 1.1 + rand() * 0.4)
    if (model) { model.rotation.y = rand() * Math.PI * 2; return model }
  }
  const g = new THREE.Group(), r = rand()
  switch (kit.theme.decoration) {
    case 'neon': {
      const geo = new THREE.ConeGeometry(0.35, 1.1, 4)
      const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x120d3a })); body.position.y = 0.55; g.add(body)
      const edges = kit.neonEdges(geo, r > 0.5 ? 0x49e7ff : 0xff4fd8); edges.position.y = 0.55; g.add(edges)
      break
    }
    case 'antenna': {
      const mast = kit.mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5), kit.mat(0xb8c8d0)); mast.position.y = 0.45; g.add(mast)
      const tip = kit.glowMesh(new THREE.SphereGeometry(0.09, 8, 6), r > 0.5 ? 0x5ce0ff : 0xff7a59); tip.position.y = 0.95; g.add(tip)
      const dish = kit.mesh(new THREE.ConeGeometry(0.22, 0.12, 10, 1, true), kit.mat(0xdbe9f0, { side: THREE.DoubleSide })); dish.position.y = 0.7; dish.rotation.x = 0.9; g.add(dish)
      break
    }
    case 'crystal': {
      const c = kit.mesh(new THREE.OctahedronGeometry(0.3 + r * 0.15, 0), kit.mat(r > 0.5 ? 0xb58de0 : 0x7fd6c2, { emissive: r > 0.5 ? 0x6a3fa0 : 0x2f8f7a, emissiveIntensity: 0.7 }))
      c.position.y = 0.55; c.scale.y = 1.6; c.userData.float = r * 6; g.add(c)
      break
    }
    default: {
      const trunk = kit.mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 5), kit.mat(0x8a5a3a)); trunk.position.y = 0.22; g.add(trunk)
      const crown = kit.mesh(new THREE.IcosahedronGeometry(0.42 + r * 0.15, 0), kit.mat(0x4f9a5a)); crown.position.y = 0.75; g.add(crown)
    }
  }
  return g
}

// ---- Land ----
export interface IslandLand {
  root: THREE.Group
  regions: THREE.Group[]
  /** Separate stage tiles (neon template), shown once the teacher has made that lesson. */
  stages: THREE.Object3D[]
  boat: THREE.Object3D | null
  lake: { x: number; z: number; y: number; radius: number } | null
  spots: IslandSpot[]
  dispose: () => void
}

export function buildLand(theme: IslandTheme, layout: IslandLayout, models: IslandModels): IslandLand {
  const kit = new Kit(theme, models)
  const rand = seeded()
  const spots = islandSpots(layout)
  const root = new THREE.Group()
  const regions = [0, 1, 2, 3].map(() => { const g = new THREE.Group(); root.add(g); return g })
  const stages: THREE.Object3D[] = []
  let boat: THREE.Object3D | null = null
  let lake: IslandLand['lake'] = null

  const decorate = (spot: IslandSpot, g: THREE.Group, near: boolean) => {
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2, d = near ? 0.6 + rand() * 0.4 : 1.6 + rand() * 0.8
      const deco = decoration(kit, rand)
      deco.position.set(spot.x + Math.cos(a) * d, spot.y, spot.z + Math.sin(a) * d)
      g.add(deco)
    }
  }
  const blob = (g: THREE.Group, x: number, z: number, top: number, radius: number, color: number, seg = 9) => {
    const h = top + 1.2
    const land = kit.mesh(new THREE.CylinderGeometry(radius, radius * 1.12, h, seg), kit.mat(color), false, false)
    land.position.set(x, top - h / 2, z); land.rotation.y = rand() * Math.PI; g.add(land)
    const beach = kit.mesh(new THREE.CylinderGeometry(radius * 1.18, radius * 1.3, 0.9, seg), kit.mat(theme.base), false, false)
    beach.position.set(x, -0.5, z); beach.rotation.y = land.rotation.y; g.add(beach)
  }
  const dockAt = (g: THREE.Group, spot: IslandSpot) => {
    const wood = kit.mat(0xa8744a)
    for (let k = 0; k < 6; k++) { const plank = kit.mesh(new THREE.BoxGeometry(1.1, 0.08, 0.32), wood); plank.position.set(spot.x, 0.05, spot.z + 2.2 + k * 0.42); g.add(plank) }
    boat = kit.model('canoe', 1.4)
    if (!boat) {
      const fallback = new THREE.Group()
      fallback.add(kit.mesh(new THREE.BoxGeometry(0.7, 0.3, 1.5), kit.mat(theme.roofs[0])))
      boat = fallback
    }
    boat.position.set(spot.x + 1.6, -0.25, spot.z + 4.6)
    g.add(boat)
  }

  if (layout === 'plates') {
    regions.forEach((g, r) => {
      const pts = spots.filter(p => p.region === r), top = pts[0].y, z = pts[0].z
      const minX = Math.min(...pts.map(p => p.x)) - 1.6, maxX = Math.max(...pts.map(p => p.x)) + 1.6, w = maxX - minX, h = top + 1.2
      const plate = kit.mesh(new THREE.BoxGeometry(w, h, 3.4), kit.mat(theme.grass[r]), false, false)
      plate.position.set((minX + maxX) / 2, top - h / 2, z); g.add(plate)
      plate.add(new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x111111 })))
      for (let k = 0; k < Math.round(w / 1.25); k++) [-1.45, 1.45].forEach(dz => {
        const stud = kit.mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10), kit.mat(theme.grass[r]), false, false)
        stud.position.set(minX + 0.6 + k * 1.25, top + 0.05, z + dz); g.add(stud)
      })
      pts.forEach(p => decorate(p, g, true))
    })
    dockAt(regions[0], spots[0])
  } else if (layout === 'hexes') {
    spots.forEach((p, i) => {
      const geo = new THREE.CylinderGeometry(1.35, 1.2, 0.5, 6)
      const stage = new THREE.Group(); stage.userData.spotIndex = i; regions[p.region].add(stage); stages.push(stage)
      const tile = kit.mesh(geo, kit.mat(theme.grass[p.region]), false, false); tile.position.set(p.x, p.y - 0.25, p.z); stage.add(tile)
      const edges = kit.neonEdges(geo, i % 2 ? 0x49e7ff : 0xff4fd8); edges.position.copy(tile.position); stage.add(edges)
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, p.y + 0.4, 6), new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.6 }))
      pillar.position.set(p.x, (p.y - 0.5) / 2 - 0.2, p.z); stage.add(pillar)
      if (rand() < 0.6) { const d = decoration(kit, rand); d.position.set(p.x + (rand() > 0.5 ? 0.8 : -0.8), p.y, p.z + (rand() - 0.5) * 0.8); d.scale.multiplyScalar(0.7); stage.add(d) }
    })
  } else if (layout === 'floaters' || layout === 'station') {
    REGION_CENTERS[layout].forEach(([cx, cz, cy], r) => {
      const g = regions[r]
      if (layout === 'floaters') {
        const top = kit.mesh(new THREE.CylinderGeometry(4.2, 3.8, 0.8, 10), kit.mat(theme.grass[r]), false, false); top.position.set(cx, cy - 0.4, cz); g.add(top)
        const under = kit.mesh(new THREE.ConeGeometry(3.8, 2.6, 10), kit.mat(theme.base), false, false); under.rotation.x = Math.PI; under.position.set(cx, cy - 2.1, cz); g.add(under)
        for (let k = 0; k < 3; k++) {
          const c = kit.mesh(new THREE.OctahedronGeometry(0.25, 0), kit.mat(0xb58de0, { emissive: 0x6a3fa0, emissiveIntensity: 0.8 }), false, false)
          c.position.set(cx + (rand() - 0.5) * 3, cy - 1.4 - rand() * 0.8, cz + (rand() - 0.5) * 3); c.userData.float = rand() * 6; g.add(c)
        }
      } else {
        const disc = kit.mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.3, 28), kit.mat(theme.grass[r]), false, false); disc.position.set(cx, cy - 0.15, cz); g.add(disc)
        const rim = kit.glowMesh(new THREE.TorusGeometry(4.1, 0.07, 6, 48), theme.roofs[r]); rim.rotation.x = Math.PI / 2; rim.position.set(cx, cy, cz); g.add(rim)
        const thruster = kit.mesh(new THREE.ConeGeometry(0.7, 1.2, 12), kit.mat(0x203845), false, false); thruster.rotation.x = Math.PI; thruster.position.set(cx, cy - 0.9, cz); g.add(thruster)
        const ang = Math.atan2(-cz, -cx), len = Math.max(0.5, Math.hypot(cx, cz) - 4.1 - 1.2), mid = 4.1 + len / 2
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 8), kit.mat(0x9fb4c0, { transparent: true, opacity: 0.6 }))
        tube.scale.y = len; tube.rotation.z = Math.PI / 2; tube.rotation.y = -ang
        tube.position.set(cx + Math.cos(ang) * mid, cy - 0.1, cz + Math.sin(ang) * mid); g.add(tube)
      }
      spots.filter(p => p.region === r).forEach(p => decorate(p, g, true))
    })
    if (layout === 'station') {
      const hub = new THREE.Group()
      const core = kit.mesh(new THREE.CylinderGeometry(0.9, 1.2, 4, 12), kit.mat(0xdbe9f0), false, false); core.position.y = 1.2; hub.add(core)
      const orbit = kit.glowMesh(new THREE.TorusGeometry(2.2, 0.12, 8, 48), 0x5ce0ff); orbit.position.y = 2; orbit.rotation.x = Math.PI / 2.3; orbit.userData.spinY = 0.01; hub.add(orbit)
      const beacon = kit.glowMesh(new THREE.SphereGeometry(0.35, 12, 10), 0x43dfbc); beacon.position.y = 3.5; hub.add(beacon)
      regions[0].add(hub)
    }
  } else if (layout === 'lake') {
    spots.forEach((p, i) => {
      blob(regions[p.region], p.x, p.z, p.y, 2.4 + rand() * 0.6, theme.grass[p.region])
      const n = spots[i + 1]
      if (n) blob(regions[p.region], (p.x + n.x) / 2, (p.z + n.z) / 2, Math.min(p.y, n.y), 2.2, theme.grass[p.region])
      decorate(p, regions[p.region], false)
    })
    const inner = kit.mesh(new THREE.CylinderGeometry(5.6, 5.6, 1.55, 16), kit.mat(theme.grass[0]), false, false); inner.position.set(0, 0.35 - 0.775, 0); regions[0].add(inner)
    lake = { x: 0, z: 0, y: 0.37, radius: 3.6 } // drawn by the scene with a reflective surface
    const lily = kit.model('lily_large', 1.4); if (lily) { lily.position.set(1.4, 0.39, 0.8); regions[0].add(lily) }
    const final = spots[spots.length - 1], ang = Math.atan2(final.z, final.x)
    const mountain = kit.mesh(new THREE.ConeGeometry(2.8, 4, 8), kit.mat(0x8c8a76), false, false); mountain.position.set(Math.cos(ang) * 11, 1.6, Math.sin(ang) * 11); regions[3].add(mountain)
    const snow = kit.mesh(new THREE.ConeGeometry(1, 1.2, 8), kit.mat(0xf4f1e6), false, false); snow.position.set(mountain.position.x, 3.2, mountain.position.z); regions[3].add(snow)
    dockAt(regions[0], spots[0])
  } else { // archipelago: a main island with islets around it
    spots.forEach((p, i) => {
      blob(regions[p.region], p.x, p.z, p.y, 2.3 + rand() * 0.8, theme.grass[p.region])
      const n = spots[i + 1]
      if (n) blob(regions[p.region], (p.x + n.x) / 2, (p.z + n.z) / 2, Math.min(p.y, n.y), 2.3 + rand() * 0.6, theme.grass[p.region])
      decorate(p, regions[p.region], false)
    })
    ;([[-10, 9], [11, 6], [-9.5, -7], [10.5, -3]] as const).forEach(([x, z], k) => {
      blob(regions[k], x, z, 0.25, 1.4 + rand(), theme.grass[k], 7)
      const palm = kit.model('tree_palmTall', 1.5) ?? decoration(kit, rand); palm.position.set(x, 0.25, z); regions[k].add(palm)
    })
    dockAt(regions[0], spots[0])
  }

  return { root, regions, stages, boat, lake, spots, dispose: () => disposeObject(root) }
}

// ---- Buildings, one per lesson ----
function building(kit: Kit, region: number, intro: boolean, variant: number) {
  const t = kit.theme, g = new THREE.Group()
  const roofColor = t.roofs[region], alt = t.roofs[(region + 1) % 4]
  const wall = kit.mat(t.wall), roof = kit.mat(roofColor, { glowable: true })
  const win = kit.mat(0xffd77a, { emissive: 0xffb84a, emissiveIntensity: 0.8 })
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, ry = 0) => { const m = kit.mesh(geo, material); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m }
  const glow = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => { const m = kit.glowMesh(geo, color); m.position.set(x, y, z); g.add(m); return m }
  switch (t.building) {
    case 'block':
      if (variant === 0) { add(new THREE.BoxGeometry(0.9, 0.55, 0.9), wall, 0, 0.28, 0); add(new THREE.BoxGeometry(0.6, 0.45, 0.6), roof, 0.1, 0.78, -0.05, 0.3); add(new THREE.BoxGeometry(0.3, 0.3, 0.3), kit.mat(alt), -0.2, 1.15, 0.05) }
      else if (variant === 1) { add(new THREE.BoxGeometry(0.55, 0.7, 0.55), roof, -0.3, 0.35, 0); add(new THREE.BoxGeometry(0.55, 0.45, 0.55), kit.mat(alt), 0.3, 0.23, 0.1); add(new THREE.BoxGeometry(0.35, 0.35, 0.35), wall, -0.3, 0.88, 0, 0.4) }
      else [roof, wall, kit.mat(alt)].forEach((m, k) => add(new THREE.BoxGeometry(0.62 - k * 0.1, 0.42, 0.62 - k * 0.1), m, 0, 0.21 + k * 0.42, 0, k * 0.4))
      break
    case 'neon': {
      const edge = (geo: THREE.BufferGeometry, y: number) => { const e = kit.neonEdges(geo, roofColor); e.position.y = y; g.add(e) }
      if (variant === 0) { const geo = new THREE.BoxGeometry(0.85, 1.1, 0.85); add(geo, wall, 0, 0.55, 0); edge(geo, 0.55); glow(new THREE.PlaneGeometry(0.6, 0.22), roofColor, 0, 0.85, 0.431); glow(new THREE.BoxGeometry(0.35, 0.35, 0.35), roofColor, 0, 1.35, 0).userData.spinY = 0.02 }
      else if (variant === 1) { const geo = new THREE.BoxGeometry(0.6, 1.2, 0.55); add(geo, wall, 0, 0.6, 0); edge(geo, 0.6); const screen = glow(new THREE.PlaneGeometry(0.46, 0.36), alt, 0, 0.85, 0.28); screen.rotation.x = -0.25; glow(new THREE.BoxGeometry(0.5, 0.08, 0.2), roofColor, 0, 0.55, 0.32) }
      else { const geo = new THREE.BoxGeometry(1.1, 0.6, 0.8); add(geo, wall, 0, 0.3, 0); edge(geo, 0.3); glow(new THREE.TorusGeometry(0.3, 0.04, 6, 24), alt, 0, 1.0, 0).userData.spinY = 0.03; glow(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), roofColor, 0, 0.75, 0) }
      break
    }
    case 'tent': {
      const tent = kit.model(variant === 1 ? 'tent_smallClosed' : 'tent_detailedOpen', 1.3)
      if (tent && variant !== 2) { tent.rotation.y = Math.PI; g.add(tent) }
      else if (variant === 2) { add(new THREE.BoxGeometry(0.9, 0.55, 0.7), kit.mat(0x9c6b3f), 0, 0.28, 0); add(new THREE.ConeGeometry(0.7, 0.45, 4), roof, 0, 0.78, 0, Math.PI / 4); add(new THREE.BoxGeometry(0.12, 0.3, 0.12), kit.mat(0x7d7a6a), 0.25, 0.95, -0.1); add(new THREE.BoxGeometry(0.18, 0.18, 0.02), win, -0.2, 0.32, 0.36) }
      else add(new THREE.ConeGeometry(0.62, 0.95, 4), roof, 0, 0.47, 0, Math.PI / 4)
      const fire = kit.model('campfire_stones', 1.2)
      if (fire) { fire.position.set(0.85, 0, 0.5); g.add(fire) }
      const flame = kit.glowMesh(new THREE.ConeGeometry(0.1, 0.28, 6), 0xffa23a); flame.position.set(0.85, 0.18, 0.5); flame.userData.flicker = true; g.add(flame)
      break
    }
    case 'tower':
      if (variant === 0) { add(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8), wall, 0, 0.65, 0); add(new THREE.ConeGeometry(0.42, 0.8, 8), roof, 0, 1.7, 0); add(new THREE.BoxGeometry(0.14, 0.22, 0.02), win, 0, 0.85, 0.37) }
      else if (variant === 1) { [-0.28, 0.28].forEach((x, k) => { add(new THREE.CylinderGeometry(0.22, 0.27, 1.0 + k * 0.3, 8), wall, x, 0.5 + k * 0.15, 0); add(new THREE.ConeGeometry(0.3, 0.6, 8), roof, x, 1.3 + k * 0.3, 0) }); add(new THREE.BoxGeometry(0.4, 0.08, 0.1), kit.mat(0xd9b261), 0, 0.85, 0) }
      else { [roof, kit.mat(alt), kit.mat(0x8a3f6f)].forEach((m, k) => add(new THREE.BoxGeometry(0.85 - k * 0.08, 0.22, 0.6), m, 0, 0.11 + k * 0.22, 0, k * 0.2)); add(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(0xd9b261), 0, 0.66, 0) }
      glow(new THREE.OctahedronGeometry(0.1, 0), 0xf0d28c, 0, variant === 2 ? 1.15 : variant === 1 ? 2.05 : 2.25, 0).userData.spinY = 0.03
      break
    case 'dome':
      if (variant === 0) { add(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 14), wall, 0, 0.15, 0); add(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(roofColor, { transparent: true, opacity: 0.75, emissive: roofColor, emissiveIntensity: 0.35 }), 0, 0.3, 0) }
      else if (variant === 1) { add(new THREE.BoxGeometry(0.7, 0.5, 0.6), wall, 0, 0.25, 0); ([-1, 1] as const).forEach(d => { const panel = add(new THREE.BoxGeometry(0.5, 0.03, 0.35), kit.mat(0x2b5f9a, { emissive: 0x1d4a7a, emissiveIntensity: 0.4 }), d * 0.65, 0.55, 0); panel.rotation.z = d * 0.4 }); glow(new THREE.BoxGeometry(0.5, 0.06, 0.02), roofColor, 0, 0.35, 0.31) }
      else { add(new THREE.CylinderGeometry(0.3, 0.34, 1.3, 12), wall, 0, 0.65, 0); add(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(roofColor), 0, 1.3, 0); const band = glow(new THREE.TorusGeometry(0.33, 0.035, 6, 24), roofColor, 0, 0.8, 0); band.rotation.x = Math.PI / 2 }
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), kit.mat(0xb8c8d0), 0.35, 0.9, 0)
      glow(new THREE.SphereGeometry(0.06, 8, 6), 0xff7a59, 0.35, 1.22, 0)
      break
    default: // hut
      if (variant === 1) { add(new THREE.BoxGeometry(0.8, 1.1, 0.75), wall, 0, 0.55, 0); add(new THREE.ConeGeometry(0.66, 0.5, 4), roof, 0, 1.35, 0, Math.PI / 4); add(new THREE.BoxGeometry(0.18, 0.18, 0.02), win, 0.18, 0.8, 0.38); add(new THREE.BoxGeometry(0.18, 0.18, 0.02), win, -0.18, 0.8, 0.38) }
      else { add(new THREE.BoxGeometry(0.9, 0.7, 0.8), wall, 0, 0.35, 0); add(new THREE.ConeGeometry(0.74, 0.55, 4), roof, 0, 0.97, 0, Math.PI / 4); add(new THREE.BoxGeometry(0.2, 0.2, 0.02), win, 0.18, 0.42, 0.41) }
      add(new THREE.BoxGeometry(0.2, 0.34, 0.02), kit.mat(0x8a5a3a), -0.2, 0.17, 0.41)
      if (variant === 2) { add(new THREE.BoxGeometry(0.45, 0.4, 0.5), kit.mat(0xe9dcc4), 0.68, 0.2, 0.05); add(new THREE.ConeGeometry(0.4, 0.3, 4), kit.mat(alt), 0.68, 0.55, 0.05, Math.PI / 4) }
  }
  if (intro) {
    const sign = kit.model('sign', 1.3)
    if (sign) { sign.position.set(-0.8, 0, 0.5); g.add(sign) }
    else { add(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), kit.mat(0x8a5a3a), -0.75, 0.4, 0.45); add(new THREE.BoxGeometry(0.5, 0.25, 0.04), kit.mat(t.roofs[0]), -0.75, 0.72, 0.47) }
  }
  return g
}

function finalBuilding(kit: Kit) {
  const t = kit.theme, g = new THREE.Group()
  const wall = kit.mat(t.wall), roof = kit.mat(t.roofs[3], { glowable: true })
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, ry = 0) => { const m = kit.mesh(geo, material); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m }
  const glow = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => { const m = kit.glowMesh(geo, color); m.position.set(x, y, z); g.add(m); return m }
  switch (t.final) {
    case 'stack':
      for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.9 - k * 0.13, 0.5, 0.9 - k * 0.13), kit.mat(t.roofs[k % 4]), 0, 0.25 + k * 0.5, 0, k * 0.35)
      add(new THREE.BoxGeometry(0.05, 0.8, 0.05), kit.mat(0x111111), 0, 2.9, 0)
      add(new THREE.BoxGeometry(0.4, 0.25, 0.03), kit.mat(0xff5c8a), 0.22, 3.15, 0)
      break
    case 'castle': {
      const geo = new THREE.BoxGeometry(1.3, 1, 1.1); add(geo, wall, 0, 0.5, 0)
      const e = kit.neonEdges(geo, 0xff4fd8); e.position.y = 0.5; g.add(e)
      ;([[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.55], [0.65, 0.55]] as const).forEach(([x, z]) => { const tg = new THREE.CylinderGeometry(0.2, 0.2, 1.6, 6); add(tg, wall, x, 0.8, z); const te = kit.neonEdges(tg, 0x49e7ff); te.position.set(x, 0.8, z); g.add(te) })
      glow(new THREE.TorusGeometry(0.35, 0.06, 8, 24), 0xfff49b, 0, 1.6, 0).userData.spinY = 0.02
      break
    }
    case 'summit': {
      add(new THREE.DodecahedronGeometry(0.9, 0), kit.mat(0x8c8a76), 0, 0.4, 0).scale.y = 1.2
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), kit.mat(0x4b5d3d), 0, 1.9, 0)
      add(new THREE.BoxGeometry(0.5, 0.3, 0.03), kit.mat(0xe3ad48), 0.27, 2.3, 0).userData.wave = true
      const fire = kit.model('campfire_stones', 1.2); if (fire) { fire.position.set(0.9, 0, 0.6); g.add(fire) }
      glow(new THREE.ConeGeometry(0.14, 0.35, 6), 0xffa23a, 0.9, 0.22, 0.6).userData.flicker = true
      break
    }
    case 'spire':
      add(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 8), wall, 0, 1.2, 0)
      add(new THREE.ConeGeometry(0.6, 1.1, 8), roof, 0, 2.95, 0)
      glow(new THREE.SphereGeometry(0.22, 16, 12), 0xf0d28c, 0, 3.9, 0).userData.float = 1
      glow(new THREE.TorusGeometry(0.45, 0.03, 6, 32), 0xd9b261, 0, 3.9, 0).userData.spinY = 0.02
      break
    case 'rocket':
      add(new THREE.CylinderGeometry(0.8, 0.9, 0.15, 12), kit.mat(0x203845), 0, 0.07, 0)
      add(new THREE.CylinderGeometry(0.28, 0.32, 1.8, 12), wall, 0, 1.05, 0)
      add(new THREE.ConeGeometry(0.28, 0.6, 12), kit.mat(0xff7a59), 0, 2.25, 0)
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; add(new THREE.BoxGeometry(0.04, 0.45, 0.35), kit.mat(0x5ce0ff), Math.cos(a) * 0.32, 0.35, Math.sin(a) * 0.32, -a) }
      { const flame = glow(new THREE.ConeGeometry(0.22, 0.5, 10), 0x5ce0ff, 0, 0, 0); flame.rotation.x = Math.PI; flame.userData.flicker = true }
      break
    default: { // lighthouse
      for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.42 - k * 0.05, 0.47 - k * 0.05, 0.6, 8), k % 2 ? kit.mat(0xd8664a) : wall, 0, 0.3 + k * 0.6, 0)
      glow(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), 0xffd77a, 0, 2.6, 0)
      add(new THREE.ConeGeometry(0.4, 0.45, 8), roof, 0, 3.02, 0)
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }))
      beam.rotation.z = Math.PI / 2; beam.position.set(2.5, 2.6, 0)
      const pivot = new THREE.Group(); pivot.add(beam); pivot.userData.spinY = 0.012; g.add(pivot)
    }
  }
  return g
}

function construction(kit: Kit) {
  const t = kit.theme, g = new THREE.Group()
  const pad = kit.mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.08, 10), kit.mat(t.path)); pad.position.y = 0.04; g.add(pad)
  const frame = t.glow ? new THREE.MeshBasicMaterial({ color: t.ring, toneMapped: false }) : kit.mat(0xa8744a)
  ;([[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]] as const).forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), frame); p.position.set(x, 0.44, z); p.castShadow = true; g.add(p) })
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.07), frame); beam.position.y = 0.82; g.add(beam)
  const logs = kit.model('log_stack', 0.9)
  if (logs && !t.glow) { logs.position.set(0.6, 0, 0.45); g.add(logs) }
  else { const crate = kit.mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), kit.mat(t.roofs[1], { glowable: true })); crate.position.set(0.55, 0.14, 0.45); g.add(crate) }
  return g
}

function lockedPlot(kit: Kit) {
  const t = kit.theme, g = new THREE.Group()
  const pad = kit.mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.06, 10), kit.mat(t.path)); pad.position.y = 0.03; g.add(pad)
  const fog = new THREE.MeshStandardMaterial({ color: t.fogPuff, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false, emissive: t.glow ? t.fogPuff : 0x000000, emissiveIntensity: t.glow ? 0.4 : 0 })
  ;([[0, 0.55, 0, 0.55], [0.35, 0.45, 0.1, 0.4], [-0.32, 0.5, -0.05, 0.42]] as const).forEach(([x, y, z, r]) => { const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), fog); puff.position.set(x, y, z); g.add(puff) })
  return g
}

// ---- Route: stones between plots and one building site per lesson ----
export interface IslandRouteStop { status: StopStatus; intro: boolean; final: boolean }
export interface IslandRoute {
  root: THREE.Group
  /** World position for each lesson's label, above its building. */
  labels: THREE.Vector3[]
  dispose: () => void
}

export function buildRoute(theme: IslandTheme, spots: IslandSpot[], stops: IslandRouteStop[], models: IslandModels): IslandRoute {
  const kit = new Kit(theme, models)
  const root = new THREE.Group()
  const doneStone = kit.mat(theme.pathDone, { glowable: true }), todoStone = kit.mat(theme.path)
  for (let i = 0; i < stops.length - 1; i++) {
    const a = spots[i], b = spots[i + 1]
    for (let k = 1; k < 5; k++) {
      const t = k / 5
      const geo = theme.outline !== undefined ? new THREE.BoxGeometry(0.36, 0.08, 0.36) : new THREE.CylinderGeometry(0.22, 0.24, 0.08, 7)
      const stone = kit.mesh(geo, stops[i].status === 'done' ? doneStone : todoStone, false, false)
      stone.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 0.04, a.z + (b.z - a.z) * t)
      stone.rotation.y = t * 3
      root.add(stone)
    }
  }
  const labels = stops.map((stop, i) => {
    const spot = spots[i]
    const site = stop.status === 'done'
      ? stop.final ? finalBuilding(kit) : building(kit, spot.region, stop.intro, i % 3)
      : stop.status === 'current' ? construction(kit) : lockedPlot(kit)
    site.position.set(spot.x, spot.y, spot.z)
    site.rotation.y = Math.atan2(-spot.x, 12 - spot.z) * 0.6
    site.userData.lessonIndex = i
    // A generous invisible target so a tap anywhere near the plot selects it
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.6, 8), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.y = 1.2; hit.userData.lessonIndex = i; site.add(hit)
    root.add(site)
    const lift = stop.status === 'done' ? (stop.final ? 4.3 : 2.5) : 1.4
    return new THREE.Vector3(spot.x, spot.y + lift, spot.z)
  })
  return { root, labels, dispose: () => disposeObject(root) }
}

/** Frees GPU memory; shared model geometry is left alone (it belongs to the loader cache). */
export function disposeObject(object: THREE.Object3D) {
  object.traverse(o => {
    if (o.userData.shared) return
    const mesh = o as THREE.Mesh
    if (mesh.geometry && !isModelGeometry(mesh)) mesh.geometry.dispose()
    const material = mesh.material
    if (material && !isModelGeometry(mesh)) (Array.isArray(material) ? material : [material]).forEach(m => m.dispose())
  })
}
function isModelGeometry(mesh: THREE.Mesh) {
  return !!mesh.geometry?.userData?.fromModel
}

/** Marks a loaded model's geometry/materials as shared, so disposing a scene keeps them. */
export function markShared(model: THREE.Object3D) {
  model.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.userData.fromModel = true
  })
  return model
}

/** Advances the small looping animations tagged on the scene (spin, float, flicker, flag wave). */
export function animateIsland(root: THREE.Object3D, time: number) {
  root.traverse(o => {
    if (o.userData.spinY) o.rotation.y += o.userData.spinY
    if (o.userData.float !== undefined) o.position.y += Math.sin(time * 1.5 + o.userData.float) * 0.002
    if (o.userData.flicker) o.scale.y = 0.85 + Math.abs(Math.sin(time * 9 + o.id)) * 0.3
    if (o.userData.wave) o.rotation.y = Math.sin(time * 2) * 0.25
  })
}

/** The island owner: the template's mentor on a round standee in the template's accent colour. */
export function standeeTexture(avatarUrl: string, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const draw = (image?: HTMLImageElement) => {
    if (!ctx) return
    ctx.clearRect(0, 0, 256, 256)
    ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
    ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill()
    if (image) { ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 108, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(image, 20, 20, 216, 216); ctx.restore() }
    texture.needsUpdate = true
  }
  draw()
  const image = new Image()
  image.onload = () => draw(image)
  image.src = avatarUrl
  return texture
}
