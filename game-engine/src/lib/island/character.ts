import * as THREE from 'three'
import type { GameVisualTemplate } from '../../types/game'
import { disposeObject } from './builder'

/**
 * The player on the island: a person dressed for the template's setting, who walks the route.
 * Built from primitives so it needs no extra assets and stays in the island's low-poly look.
 */
export interface IslandCharacter {
  root: THREE.Group
  /** Everything above the ground: bobs and hops. */
  body: THREE.Group
  head: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  legL: THREE.Object3D
  legR: THREE.Object3D
  dispose: () => void
}

type Material = THREE.Material
/** Modelled about a metre tall; drawn larger so it reads at map distance. */
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

function assemble(parts: Omit<IslandCharacter, 'root' | 'dispose'>, scale = PLAYER_SCALE) {
  const root = new THREE.Group()
  root.add(parts.body)
  root.scale.setScalar(scale)
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  return { ...parts, root, dispose: () => disposeObject(root) }
}

// ---- One body, dressed for each template ----
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
  return assemble({ body, head, armL, armR, legL, legR })
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
  /** 0–1: head shake when the student picks a stop that isn't open yet. */
  shake: number
  /** 0–1: arms up and little jumps when the player reaches a newly opened stop. */
  cheer?: number
}

/** One frame of the player's animation: walk cycle, hop pose or idle. */
export function animateCharacter(c: IslandCharacter, t: number, { moving, hopping, shake, cheer = 0 }: CharacterMotion) {
  const swing = hopping ? 0 : moving ? Math.sin(t * 11) * 0.7 : 0
  c.legL.rotation.x = hopping ? -0.7 : swing
  c.legR.rotation.x = hopping ? -0.7 : -swing
  c.armL.rotation.x = hopping ? -2.4 : moving ? -swing * 0.8 : Math.sin(t * 1.6) * 0.06
  c.armR.rotation.x = hopping ? -2.4 : moving ? swing * 0.8 : -Math.sin(t * 1.6) * 0.06
  c.body.position.y = moving && !hopping ? Math.abs(Math.sin(t * 11)) * 0.05 : Math.sin(t * 2) * 0.012
  c.head.rotation.y = shake > 0 ? Math.sin(t * 28) * 0.45 * shake : 0
  if (cheer > 0 && !moving) {
    // Both arms up, waving a little, and small jumps on the spot
    c.armL.rotation.x = -2.9 * cheer
    c.armR.rotation.x = -2.9 * cheer
    c.armL.rotation.z = -0.35 * cheer + Math.sin(t * 12) * 0.15 * cheer
    c.armR.rotation.z = 0.35 * cheer - Math.sin(t * 12) * 0.15 * cheer
    c.body.position.y = Math.abs(Math.sin(t * 8)) * 0.22 * cheer
  } else {
    c.armL.rotation.z = 0
    c.armR.rotation.z = 0
  }
}
