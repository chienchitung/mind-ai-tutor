import * as THREE from 'three'
import type { GameVisualTemplate } from '../../types/game'
import { disposeObject } from './builder'

/**
 * Figures on the island, built from primitives so they need no extra assets and stay in the
 * island's low-poly look:
 * - the island owner, one per template, modelled on that template's mentor portrait
 *   (public/avatars/mentor-*.webp); it waits at the student's current lesson;
 * - the player, a person dressed for the template's setting, who walks the route.
 */
export interface IslandCharacter {
  root: THREE.Group
  /** Everything above the ground: bobs, leans and hops. */
  body: THREE.Group
  head: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  legL: THREE.Object3D | null
  legR: THREE.Object3D | null
  /** Swinging tail, waving flag, orbiting ring: small loops of their own. */
  tail: THREE.Object3D | null
  flag: THREE.Object3D | null
  ring: THREE.Object3D | null
  /** Floats instead of walking (the book and the space robot). */
  hover: boolean
  dispose: () => void
}

type Material = THREE.Material
/** Modelled about a metre tall; drawn larger so they read at map distance. */
export const OWNER_SCALE = 1.7
export const PLAYER_SCALE = 1.55
interface Parts { outline?: number }

function maker({ outline }: Parts) {
  const solid = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra })
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
  const mesh = (geo: THREE.BufferGeometry, material: Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    if (outline !== undefined) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: outline })))
    return m
  }
  /** A limb hangs from its pivot (shoulder or hip), so rotating the pivot swings it. */
  const pivot = (x: number, y: number, z = 0, ...children: THREE.Object3D[]) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    children.forEach(c => g.add(c))
    return g
  }
  const sphere = (r: number, seg = 18) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75))
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg)
  return { solid, glow, mesh, pivot, sphere, box, cyl }
}

function assemble(parts: Omit<IslandCharacter, 'root' | 'dispose'>, scale = OWNER_SCALE) {
  const root = new THREE.Group()
  root.add(parts.body)
  root.scale.setScalar(scale)
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  return { ...parts, root, dispose: () => disposeObject(root) }
}

// 洛奇: navy explorer robot with a dark visor, flag antenna and satchel.
function roki(): IslandCharacter {
  const { solid, glow, mesh, pivot, sphere, box, cyl } = maker({})
  const navy = solid(0x34548c), teal = solid(0x3fb8a8), white = solid(0xf4f4f4), sole = solid(0x2f7f8f)
  const body = new THREE.Group()
  const leg = (x: number) => pivot(x, 0.5, 0, mesh(cyl(0.08, 0.08, 0.38), navy, 0, -0.2), mesh(box(0.2, 0.12, 0.3), white, 0, -0.43, 0.05), mesh(box(0.21, 0.04, 0.31), sole, 0, -0.49, 0.05))
  const legL = leg(-0.14), legR = leg(0.14)
  body.add(legL, legR)
  body.add(mesh(cyl(0.24, 0.28, 0.46), navy, 0, 0.74), mesh(box(0.26, 0.16, 0.05), teal, 0, 0.8, 0.25))
  body.add(mesh(box(0.2, 0.2, 0.08), solid(0xa8744a), 0.3, 0.62, 0.06))
  const arm = (x: number) => pivot(x, 0.93, 0, mesh(cyl(0.065, 0.065, 0.38), navy, 0, -0.2), mesh(sphere(0.085), white, 0, -0.42))
  const armL = arm(-0.33), armR = arm(0.33)
  body.add(armL, armR)
  const head = pivot(0, 1.2)
  const visor = mesh(sphere(0.24), solid(0x10182a, { roughness: 0.2, metalness: 0.4 }), 0, 0.01, 0.16)
  visor.scale.z = 0.55
  head.add(mesh(sphere(0.31), navy), visor, mesh(sphere(0.05), glow(0x7fe8ff), -0.08, 0.03, 0.29), mesh(sphere(0.05), glow(0x7fe8ff), 0.08, 0.03, 0.29))
  for (const x of [-0.3, 0.3]) { const ear = mesh(cyl(0.1, 0.1, 0.07), teal, x, 0, 0); ear.rotation.z = Math.PI / 2; head.add(ear) }
  head.add(mesh(cyl(0.015, 0.015, 0.3), navy, 0, 0.42))
  const flag = pivot(0, 0.52, 0, mesh(box(0.18, 0.11, 0.015), solid(0x3aa66a, { side: THREE.DoubleSide }), 0.09, 0, 0))
  head.add(flag)
  body.add(head)
  return assemble({ body, head, armL, armR, legL, legR, tail: null, flag, ring: null, hover: false })
}

// 波波: boxy yellow robot with a screen face, headphones and pink/blue limbs.
function bobo(): IslandCharacter {
  const { solid, mesh, pivot, sphere, box, cyl } = maker({ outline: 0x111111 })
  const yellow = solid(0xffde59), pink = solid(0xff5c8a), blue = solid(0x70e1f5), white = solid(0xffffff)
  const body = new THREE.Group()
  const leg = (x: number, color: Material, shoe: Material) => pivot(x, 0.5, 0, mesh(box(0.16, 0.34, 0.16), color, 0, -0.2), mesh(box(0.22, 0.12, 0.3), shoe, 0, -0.43, 0.05))
  const legL = leg(-0.15, blue, pink), legR = leg(0.15, pink, blue)
  body.add(legL, legR)
  body.add(mesh(box(0.5, 0.42, 0.36), yellow, 0, 0.73))
  body.add(mesh(box(0.1, 0.1, 0.02), pink, -0.1, 0.78, 0.19), mesh(box(0.1, 0.1, 0.02), blue, 0.1, 0.78, 0.19))
  const arm = (x: number, color: Material) => pivot(x, 0.9, 0, mesh(box(0.13, 0.36, 0.13), color, 0, -0.18), mesh(box(0.17, 0.1, 0.17), yellow, 0, -0.41))
  const armL = arm(-0.33, pink), armR = arm(0.33, blue)
  body.add(armL, armR)
  const head = pivot(0, 1.2)
  head.add(mesh(box(0.56, 0.46, 0.44), yellow), mesh(box(0.42, 0.3, 0.02), white, 0, 0, 0.23))
  for (const x of [-0.09, 0.09]) { const eye = mesh(sphere(0.055), solid(0x2a7fd4), x, 0.03, 0.245); eye.scale.z = 0.4; head.add(eye) }
  head.add(mesh(box(0.1, 0.03, 0.02), pink, 0, -0.08, 0.245))
  for (const [x, color] of [[-0.31, pink], [0.31, blue]] as const) { const can = mesh(cyl(0.12, 0.12, 0.08), color, x, 0, 0); can.rotation.z = Math.PI / 2; head.add(can) }
  head.add(mesh(cyl(0.02, 0.02, 0.2), solid(0x111111), 0, 0.33), mesh(sphere(0.06), solid(0xff4040), 0, 0.46))
  body.add(head)
  return assemble({ body, head, armL, armR, legL, legR, tail: null, flag: null, ring: null, hover: false })
}

// 尼克斯: neon cyber-cat with glowing eyes and a lit tail.
function nyx(): IslandCharacter {
  const { solid, glow, mesh, pivot, sphere, cyl } = maker({})
  const purple = solid(0x4a36b0, { roughness: 0.35, metalness: 0.2, emissive: 0x1c1250, emissiveIntensity: 0.6 }), lilac = solid(0xb9a8ff), cyan = glow(0x49e7ff), pink = glow(0xff4fd8)
  const body = new THREE.Group()
  const leg = (x: number) => pivot(x, 0.38, 0, mesh(cyl(0.085, 0.085, 0.3), purple, 0, -0.15), mesh(sphere(0.1), lilac, 0, -0.33, 0.03))
  const legL = leg(-0.13), legR = leg(0.13)
  body.add(legL, legR)
  body.add(mesh(cyl(0.2, 0.24, 0.44), purple, 0, 0.6), mesh(cyl(0.205, 0.205, 0.04), cyan, 0, 0.66))
  const collar = mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), cyan, 0, 0.83)
  collar.rotation.x = Math.PI / 2
  body.add(collar)
  const arm = (x: number) => pivot(x, 0.78, 0, mesh(cyl(0.06, 0.06, 0.3), purple, 0, -0.16), mesh(sphere(0.08), lilac, 0, -0.33))
  const armL = arm(-0.27), armR = arm(0.27)
  body.add(armL, armR)
  const head = pivot(0, 1.07)
  const skull = mesh(sphere(0.32), purple)
  skull.scale.set(1.1, 0.95, 1)
  head.add(skull)
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.12, 0.24, 4), purple, side * 0.19, 0.3, 0)
    ear.rotation.z = -side * 0.3
    const inner = mesh(new THREE.ConeGeometry(0.06, 0.14, 4), pink, side * 0.185, 0.29, 0.04)
    inner.rotation.z = -side * 0.3
    const eye = mesh(sphere(0.07), cyan, side * 0.12, 0.03, 0.27)
    eye.scale.set(1, 1.3, 0.5)
    head.add(ear, inner, eye)
  }
  head.add(mesh(sphere(0.03), pink, 0, -0.07, 0.31))
  body.add(head)
  const tail = pivot(0, 0.45, -0.2)
  for (let k = 0; k < 7; k++) {
    const a = k / 6
    tail.add(mesh(sphere(0.055 - a * 0.015, 10), k === 6 ? cyan : purple, 0, a * 0.55 + Math.sin(a * 2.2) * 0.05, -0.08 - Math.sin(a * 1.6) * 0.3))
  }
  body.add(tail)
  return assemble({ body, head, armL, armR, legL, legR, tail, flag: null, ring: null, hover: false })
}

// 莫里: owl ranger in a brimmed hat, with scarf and backpack.
function mori(): IslandCharacter {
  const { solid, mesh, pivot, sphere, box, cyl } = maker({})
  const plumage = solid(0xb9a98a), cream = solid(0xf2e6c8), wing = solid(0x7d9a5c), orange = solid(0xe3a040), hat = solid(0x6f7a3e)
  const body = new THREE.Group()
  const leg = (x: number) => pivot(x, 0.22, 0, mesh(cyl(0.04, 0.04, 0.16), orange, 0, -0.08), mesh(box(0.15, 0.04, 0.17), orange, 0, -0.18, 0.04))
  const legL = leg(-0.12), legR = leg(0.12)
  body.add(legL, legR)
  const trunk = mesh(sphere(0.42), plumage, 0, 0.62)
  trunk.scale.set(1, 1.15, 0.95)
  const belly = mesh(sphere(0.33), cream, 0, 0.58, 0.14)
  belly.scale.set(1, 1.1, 0.8)
  body.add(trunk, belly, mesh(box(0.32, 0.36, 0.16), solid(0x8a5a2b), 0, 0.7, -0.38))
  const scarf = mesh(new THREE.TorusGeometry(0.29, 0.065, 8, 20), solid(0xc37438), 0, 0.95)
  scarf.rotation.x = Math.PI / 2
  body.add(scarf)
  const arm = (side: number) => {
    const feathers = mesh(sphere(0.21), wing, 0, -0.2, 0)
    feathers.scale.set(0.35, 1, 0.7)
    return pivot(side * 0.4, 0.88, 0, feathers)
  }
  const armL = arm(-1), armR = arm(1)
  body.add(armL, armR)
  const head = pivot(0, 1.2)
  head.add(mesh(sphere(0.36), plumage))
  for (const x of [-0.13, 0.13]) {
    const disc = mesh(cyl(0.14, 0.14, 0.04, 20), cream, x, 0.02, 0.3); disc.rotation.x = Math.PI / 2
    const iris = mesh(cyl(0.085, 0.085, 0.03, 18), solid(0xf0a020), x, 0.02, 0.325); iris.rotation.x = Math.PI / 2
    const pupil = mesh(cyl(0.045, 0.045, 0.03, 14), solid(0x1a1a1a), x, 0.02, 0.34); pupil.rotation.x = Math.PI / 2
    head.add(disc, iris, pupil)
  }
  const beak = mesh(new THREE.ConeGeometry(0.05, 0.13, 8), orange, 0, -0.08, 0.35)
  beak.rotation.x = Math.PI / 1.7
  head.add(beak)
  head.add(mesh(cyl(0.46, 0.46, 0.04, 24), hat, 0, 0.27), mesh(cyl(0.25, 0.29, 0.22, 20), hat, 0, 0.39), mesh(cyl(0.295, 0.295, 0.05, 20), solid(0x8a5a2b), 0, 0.31))
  const leaf = mesh(sphere(0.07), wing, 0.24, 0.4, 0.1)
  leaf.scale.set(1.6, 0.4, 0.8)
  head.add(leaf)
  body.add(head)
  return assemble({ body, head, armL, armR, legL, legR, tail: null, flag: null, ring: null, hover: false })
}

// 萊拉: a living spellbook with a face, a quill and floating golden hands.
function lyra(): IslandCharacter {
  const { solid, glow, mesh, pivot, sphere, box, cyl } = maker({})
  const cover = solid(0x5a2a6e, { roughness: 0.45 }), gold = solid(0xd9b261, { metalness: 0.6, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.5 })
  const body = new THREE.Group()
  const head = pivot(0, 0.95)
  head.add(mesh(box(0.7, 0.92, 0.18), solid(0xf3e6c4), 0.02, 0, 0))
  head.add(mesh(box(0.78, 1, 0.04), cover, 0, 0, 0.11), mesh(box(0.78, 1, 0.04), cover, 0, 0, -0.11), mesh(box(0.06, 1, 0.26), cover, -0.4, 0, 0))
  for (const [x, y] of [[-0.33, 0.44], [0.33, 0.44], [-0.33, -0.44], [0.33, -0.44]]) head.add(mesh(box(0.12, 0.12, 0.02), gold, x, y, 0.135))
  head.add(mesh(new THREE.OctahedronGeometry(0.06), glow(0x3fd0a0), 0, -0.25, 0.15))
  for (const x of [-0.14, 0.14]) {
    const white = mesh(sphere(0.09), solid(0xffffff), x, 0.13, 0.14); white.scale.z = 0.35
    const iris = mesh(sphere(0.055), solid(0x2fa57a), x, 0.12, 0.165); iris.scale.z = 0.3
    const pupil = mesh(sphere(0.028), solid(0x111111), x, 0.12, 0.18); pupil.scale.z = 0.3
    head.add(white, iris, pupil)
  }
  head.add(mesh(box(0.14, 0.03, 0.02), solid(0x2a1030), 0, -0.04, 0.14))
  const quill = pivot(0.22, 0.5, -0.05, mesh(cyl(0.012, 0.012, 0.5), gold, 0, 0.15), (() => { const vane = mesh(sphere(0.12), solid(0x3e8c75), 0, 0.3, 0); vane.scale.set(0.35, 1.6, 0.15); return vane })())
  quill.rotation.z = -0.45
  head.add(quill)
  body.add(head)
  const hand = (side: number) => pivot(side * 0.58, 0.85, 0.1, mesh(sphere(0.085), gold))
  const armL = hand(-1), armR = hand(1)
  body.add(armL, armR)
  const ring = new THREE.Group()
  ring.position.y = 0.9
  const ribbon = mesh(new THREE.TorusGeometry(0.62, 0.02, 6, 40), glow(0xf0d28c))
  ribbon.rotation.x = Math.PI / 2.4
  ring.add(ribbon)
  body.add(ring)
  return assemble({ body, head, armL, armR, legL: null, legR: null, tail: null, flag: null, ring, hover: true })
}

// 奧比: round space robot with a glass visor, orbit ring and floating hands.
function orbi(): IslandCharacter {
  const { solid, glow, mesh, pivot, sphere, cyl } = maker({})
  const white = solid(0xf2f6fa, { roughness: 0.3 }), blue = solid(0x3a7bd5)
  const body = new THREE.Group()
  const head = pivot(0, 0.95)
  const visor = mesh(sphere(0.33), solid(0x2fb8e8, { roughness: 0.1, metalness: 0.5 }), 0, 0.02, 0.17)
  visor.scale.z = 0.6
  head.add(mesh(sphere(0.42, 24), white), visor, mesh(sphere(0.06), glow(0xd8fbff), -0.1, 0.06, 0.37), mesh(sphere(0.06), glow(0xd8fbff), 0.1, 0.06, 0.37))
  for (const x of [-0.42, 0.42]) { const pod = mesh(cyl(0.12, 0.12, 0.1), blue, x, 0, 0); pod.rotation.z = Math.PI / 2; head.add(pod) }
  head.add(mesh(cyl(0.015, 0.015, 0.22), white, 0, 0.5), mesh(sphere(0.07), glow(0xff7a59), 0, 0.63))
  body.add(head)
  const hand = (side: number) => pivot(side * 0.62, 0.82, 0.08, mesh(sphere(0.1), white))
  const armL = hand(-1), armR = hand(1)
  body.add(armL, armR)
  const ring = new THREE.Group()
  ring.position.y = 0.95
  const orbit = mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 40), glow(0x5ce0ff))
  orbit.rotation.x = Math.PI / 2.6
  ring.add(orbit)
  body.add(ring)
  return assemble({ body, head, armL, armR, legL: null, legR: null, tail: null, flag: null, ring, hover: true })
}

const BUILDERS: Record<GameVisualTemplate, () => IslandCharacter> = {
  discovery: roki,
  'neo-brutal': bobo,
  arcade: nyx,
  'forest-camp': mori,
  'arcane-archive': lyra,
  'orbital-lab': orbi,
}

export function buildOwner(template: GameVisualTemplate): IslandCharacter {
  return (BUILDERS[template] ?? roki)()
}

// ---- The player: one body, dressed for each template ----
interface Outfit {
  top: number
  bottom: number
  shoes: number
  hair: number
  outline?: number
  /** A long robe over the legs (the apprentice). */
  robe?: number
  dress: (kit: ReturnType<typeof maker>, figure: { body: THREE.Group; head: THREE.Group; armR: THREE.Group }) => void
}

const SKIN = 0xf0c8a0

function person(outfit: Outfit): IslandCharacter {
  const kit = maker({ outline: outfit.outline })
  const { solid, mesh, pivot, sphere, box, cyl } = kit
  const skin = solid(SKIN), top = solid(outfit.top), bottom = solid(outfit.bottom), shoes = solid(outfit.shoes)
  const body = new THREE.Group()
  const leg = (x: number) => pivot(x, 0.5, 0, mesh(cyl(0.075, 0.075, 0.36), bottom, 0, -0.19), mesh(box(0.14, 0.1, 0.24), shoes, 0, -0.43, 0.04))
  const legL = leg(-0.1), legR = leg(0.1)
  body.add(legL, legR)
  body.add(mesh(cyl(0.19, 0.22, 0.42), top, 0, 0.74), mesh(cyl(0.21, 0.21, 0.06), bottom, 0, 0.55))
  if (outfit.robe !== undefined) body.add(mesh(cyl(0.2, 0.33, 0.62), solid(outfit.robe), 0, 0.5))
  const arm = (x: number) => pivot(x, 0.92, 0, mesh(cyl(0.06, 0.055, 0.34), top, 0, -0.17), mesh(sphere(0.065), skin, 0, -0.37))
  const armL = arm(-0.26), armR = arm(0.26)
  body.add(armL, armR)
  body.add(mesh(cyl(0.07, 0.07, 0.08), skin, 0, 0.98))
  const head = pivot(0, 1.22)
  const hair = mesh(sphere(0.275), solid(outfit.hair), 0, 0.05, -0.04)
  hair.scale.set(1, 0.82, 1)
  head.add(mesh(sphere(0.26), skin), hair)
  for (const x of [-0.085, 0.085]) head.add(mesh(sphere(0.032, 10), solid(0x2a2020), x, -0.01, 0.24))
  head.add(mesh(sphere(0.035, 10), solid(0xe89a8a), -0.15, -0.08, 0.2), mesh(sphere(0.035, 10), solid(0xe89a8a), 0.15, -0.08, 0.2))
  body.add(head)
  outfit.dress(kit, { body, head, armR })
  return assemble({ body, head, armL, armR, legL, legR, tail: null, flag: null, ring: null, hover: false }, PLAYER_SCALE)
}

const OUTFITS: Record<GameVisualTemplate, Outfit> = {
  // Explorer: safari hat and a satchel-backpack
  discovery: {
    top: 0x2f7f8f, bottom: 0xc9b27c, shoes: 0x6b4a2b, hair: 0x4a3020,
    dress: ({ solid, mesh, box, cyl }, { body, head }) => {
      const hat = solid(0xe0c890)
      head.add(mesh(cyl(0.38, 0.38, 0.03, 20), hat, 0, 0.17), mesh(cyl(0.2, 0.23, 0.16, 16), hat, 0, 0.26), mesh(cyl(0.235, 0.235, 0.04, 16), solid(0xd8664a), 0, 0.2))
      body.add(mesh(box(0.3, 0.32, 0.14), solid(0xa8744a), 0, 0.78, -0.25))
    },
  },
  // Maker: hard hat, overall bib and a wrench
  'neo-brutal': {
    top: 0x70e1f5, bottom: 0xff5c8a, shoes: 0x111111, hair: 0x2a1a10, outline: 0x111111,
    dress: ({ solid, mesh, box, sphere, cyl }, { body, head, armR }) => {
      const helmet = mesh(sphere(0.29), solid(0xffde59), 0, 0.08, 0)
      helmet.scale.y = 0.6
      head.add(helmet, mesh(cyl(0.33, 0.33, 0.03, 18), solid(0xffde59), 0, 0.06, 0.04))
      body.add(mesh(box(0.26, 0.22, 0.05), solid(0xff5c8a), 0, 0.78, 0.19))
      armR.add(mesh(box(0.05, 0.26, 0.05), solid(0x9a9a9a), 0, -0.42, 0.08))
    },
  },
  // Gamer: neon-trimmed hoodie, glowing headphones, cap
  arcade: {
    top: 0x5a3fd0, bottom: 0x1a1540, shoes: 0xf4f4ff, hair: 0x1a1a2e,
    dress: ({ solid, glow, mesh, cyl }, { body, head }) => {
      body.add(mesh(cyl(0.225, 0.225, 0.03), glow(0x49e7ff), 0, 0.6))
      const band = mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 20, Math.PI), glow(0x49e7ff), 0, 0.02, 0)
      band.rotation.z = 0
      head.add(band)
      for (const x of [-0.28, 0.28]) { const can = mesh(cyl(0.08, 0.08, 0.06), glow(0xff4fd8), x, 0, 0); can.rotation.z = Math.PI / 2; head.add(can) }
      const cap = mesh(cyl(0.27, 0.27, 0.1, 18), solid(0xff4fd8), 0, 0.17, -0.02)
      head.add(cap, mesh(cyl(0.14, 0.14, 0.02, 14), solid(0xff4fd8), 0, 0.14, -0.3))
    },
  },
  // Scout: ranger hat, scarf and a big pack with a bedroll
  'forest-camp': {
    top: 0x9aa86f, bottom: 0x8a5a2b, shoes: 0x5a3a20, hair: 0x6a4020,
    dress: ({ solid, mesh, box, cyl }, { body, head }) => {
      const hat = solid(0x6f8d52)
      head.add(mesh(cyl(0.4, 0.4, 0.03, 20), hat, 0, 0.16), mesh(new THREE.ConeGeometry(0.22, 0.22, 4), hat, 0, 0.3))
      const scarf = mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 18), solid(0xc37438), 0, 0.96)
      scarf.rotation.x = Math.PI / 2
      body.add(scarf, mesh(box(0.34, 0.42, 0.18), solid(0xc37438), 0, 0.76, -0.27))
      const roll = mesh(cyl(0.08, 0.08, 0.38), solid(0x5d6b45), 0, 1.02, -0.27)
      roll.rotation.z = Math.PI / 2
      body.add(roll)
    },
  },
  // Apprentice: robe with gold hem, pointed hat, a book under the arm
  'arcane-archive': {
    top: 0x704487, bottom: 0x3a2a4a, shoes: 0x2a1f30, hair: 0x9a4a2a, robe: 0x704487,
    dress: ({ solid, glow, mesh, box, cyl }, { body, head, armR }) => {
      body.add(mesh(cyl(0.335, 0.335, 0.03), glow(0xf0d28c), 0, 0.2))
      head.add(mesh(cyl(0.34, 0.34, 0.03, 20), solid(0x704487), 0, 0.14), mesh(new THREE.ConeGeometry(0.22, 0.5, 14), solid(0x704487), 0, 0.4), mesh(cyl(0.21, 0.21, 0.04, 14), solid(0xd9b261), 0, 0.18))
      armR.add(mesh(box(0.2, 0.26, 0.06), solid(0x3e8c75), 0.04, -0.36, 0.1))
    },
  },
  // Astronaut: white suit, glass helmet, life-support pack
  'orbital-lab': {
    top: 0xe9eef3, bottom: 0xe9eef3, shoes: 0x8a96a3, hair: 0x3a2a20,
    dress: ({ solid, glow, mesh, sphere, box, cyl }, { body, head }) => {
      const glass = mesh(sphere(0.36, 24), new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2 }))
      glass.castShadow = false
      head.add(glass)
      body.add(mesh(cyl(0.2, 0.2, 0.05), solid(0x3a7bd5), 0, 0.82), mesh(box(0.32, 0.4, 0.16), solid(0xdbe9f0), 0, 0.78, -0.26))
      body.add(mesh(sphere(0.035, 8), glow(0xff7a59), -0.08, 0.9, -0.35), mesh(sphere(0.035, 8), glow(0x5ce0ff), 0.08, 0.9, -0.35))
    },
  },
}

export function buildPlayer(template: GameVisualTemplate): IslandCharacter {
  return person(OUTFITS[template] ?? OUTFITS.discovery)
}

export interface CharacterMotion {
  moving: boolean
  hopping: boolean
  /** 0–1: head shake when the student picks a stop the owner can't go to yet. */
  shake: number
}

/** One frame of the owner's animation: walk cycle, hop pose or idle, plus its own loops. */
export function animateCharacter(c: IslandCharacter, t: number, { moving, hopping, shake }: CharacterMotion) {
  if (c.hover) {
    c.body.position.y = 0.25 + Math.sin(t * 2.2) * 0.08 + (hopping ? 0.15 : 0)
    c.body.rotation.x = moving ? 0.22 : 0
    c.armL.position.y = 0.85 + Math.sin(t * 3) * 0.05
    c.armR.position.y = 0.85 + Math.sin(t * 3 + 1.5) * 0.05
  } else {
    const swing = hopping ? 0 : moving ? Math.sin(t * 11) * 0.7 : 0
    if (c.legL && c.legR) { c.legL.rotation.x = hopping ? -0.7 : swing; c.legR.rotation.x = hopping ? -0.7 : -swing }
    c.armL.rotation.x = hopping ? -2.4 : moving ? -swing * 0.8 : Math.sin(t * 1.6) * 0.06
    c.armR.rotation.x = hopping ? -2.4 : moving ? swing * 0.8 : -Math.sin(t * 1.6) * 0.06
    c.body.position.y = moving && !hopping ? Math.abs(Math.sin(t * 11)) * 0.05 : Math.sin(t * 2) * 0.012
  }
  c.head.rotation.y = shake > 0 ? Math.sin(t * 28) * 0.45 * shake : 0
  if (c.tail) c.tail.rotation.y = Math.sin(t * 3) * 0.45
  if (c.flag) c.flag.rotation.y = Math.sin(t * 4) * 0.4
  if (c.ring) c.ring.rotation.y = t * 0.9
}
