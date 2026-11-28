import type { GameVisualTemplate } from '../../types/game'

export type IslandBuildingKind = 'hut' | 'block' | 'neon' | 'tent' | 'tower' | 'dome'
export type IslandFinalKind = 'lighthouse' | 'stack' | 'castle' | 'summit' | 'spire' | 'rocket'
export type IslandDecoration = 'tropical' | 'pine' | 'block' | 'neon' | 'crystal' | 'antenna'

/**
 * How a template's island looks. Colours are taken from the template's illustration
 * (public/template-art/*-hero.webp), so the island matches the art teachers pick it by.
 */
export interface IslandTheme {
  regions: [string, string, string, string]
  sky: number
  sea: 'water' | 'grid' | 'void'
  seaColor: number
  grass: [number, number, number, number]
  base: number
  roofs: [number, number, number, number]
  wall: number
  path: number
  pathDone: number
  ring: number
  building: IslandBuildingKind
  final: IslandFinalKind
  decoration: IslandDecoration
  hemi: [number, number, number]
  sun: number
  fogPuff: number
  /** Black edges on buildings (neo-brutal). */
  outline?: number
  /** Self-lit roofs and stones, with bloom (night templates). */
  glow?: boolean
  stars?: boolean
  /** Daylight sky dome and clouds. */
  daySky?: boolean
  /** Water inside the island (the lake layout); clearer than the sea around it. */
  lake?: number
  /** Shallow water ringing the coast; templates without it have no shoreline shoals. */
  shallow?: number
}

export const ISLAND_THEMES: Record<GameVisualTemplate, IslandTheme> = {
  discovery: {
    regions: ['海灣碼頭', '雨林小徑', '瞭望山丘', '燈塔海岬'],
    sky: 0xd6ecf8, sea: 'water', seaColor: 0x2a92bf, shallow: 0x9fe6ee,
    grass: [0x6ed174, 0x4db85c, 0x84d468, 0x5cc47a], base: 0xe8d3a1,
    roofs: [0xd8664a, 0x2f7f8f, 0xd9a441, 0xc4574a], wall: 0xf4ecdc,
    path: 0xd9d5c8, pathDone: 0xe3c27a, ring: 0xffc94d,
    building: 'hut', final: 'lighthouse', decoration: 'tropical',
    hemi: [0xffffff, 0x7fb08a, 1.05], sun: 1.15, fogPuff: 0xffffff, daySky: true,
  },
  'neo-brutal': {
    regions: ['底板區', '零件區', '組裝區', '成品台'],
    sky: 0xfff1b8, sea: 'water', seaColor: 0x57e5f7,
    grass: [0xfcd72c, 0xfa8fb0, 0xfaac54, 0x9f86ff], base: 0xffffff,
    roofs: [0x7849fa, 0xfa5b8b, 0x57e5f7, 0x111111], wall: 0xffffff,
    path: 0xffffff, pathDone: 0x111111, ring: 0x7c5cff,
    building: 'block', final: 'stack', decoration: 'block',
    hemi: [0xffffff, 0xbbaa77, 1.0], sun: 0.95, fogPuff: 0xffffff, outline: 0x111111,
  },
  arcade: {
    regions: ['新手港', '霓虹街區', '電路高塔', '頭目城堡'],
    sky: 0x070a3a, sea: 'grid', seaColor: 0x0a1660,
    grass: [0x1d2f96, 0x2a45b4, 0x3a2aa8, 0x52219a], base: 0x0d1870,
    roofs: [0x49e7ff, 0xd25cff, 0xf5cc6c, 0x2b6fcc], wall: 0x111a5a,
    path: 0x22307a, pathDone: 0x49e7ff, ring: 0xd25cff,
    building: 'neon', final: 'castle', decoration: 'neon',
    hemi: [0x8a7dff, 0x110a30, 0.65], sun: 0.35, fogPuff: 0x5a4fa8, glow: true, stars: true,
  },
  'forest-camp': {
    regions: ['湖畔營地', '松林步道', '溪谷吊橋', '山頂瞭望'],
    sky: 0xeef3e2, sea: 'water', seaColor: 0x6fa8a4, lake: 0x6bbdc4, shallow: 0xbfe2d8,
    grass: [0x8cb04a, 0x6f9a36, 0x9db752, 0xa8bb5e], base: 0xd8b36d,
    roofs: [0xc37438, 0xe3ad48, 0x6f8d52, 0xb5532f], wall: 0xfff7dd,
    path: 0xcdbf98, pathDone: 0xa0703f, ring: 0xe3ad48,
    building: 'tent', final: 'summit', decoration: 'pine',
    hemi: [0xfffbe8, 0x9aab78, 1.15], sun: 1.2, fogPuff: 0xffffff, daySky: true,
  },
  'arcane-archive': {
    regions: ['入館前庭', '書塔迴廊', '星象天台', '終章大殿'],
    sky: 0x2e1a36, sea: 'water', seaColor: 0x281633,
    grass: [0x6a9a5c, 0x86689a, 0xa47a4e, 0x7a5a86], base: 0x7a5030,
    roofs: [0x704487, 0x3e8c75, 0xd9b261, 0x8a3f6f], wall: 0xf1d9ae,
    path: 0xc9a273, pathDone: 0xf0c46a, ring: 0xf0c46a,
    building: 'tower', final: 'spire', decoration: 'crystal',
    hemi: [0xf4dcb4, 0x4a2a3a, 1.05], sun: 1.0, fogPuff: 0x9a86c4, glow: true, stars: true,
  },
  'orbital-lab': {
    regions: ['發射平台', '資料艙', '溫室實驗區', '火箭發射場'],
    sky: 0x061521, sea: 'void', seaColor: 0x061521,
    grass: [0xe2e8f2, 0xd2def0, 0xcfe6d8, 0xdbe3f2], base: 0x2160ba,
    roofs: [0x6ebbe6, 0x2160ba, 0x6fb75f, 0xc76936], wall: 0xf1f3f5,
    path: 0x6ebbe6, pathDone: 0x07a7f8, ring: 0x07a7f8,
    building: 'dome', final: 'rocket', decoration: 'antenna',
    hemi: [0xeaf4ff, 0x3a5a80, 1.05], sun: 1.1, fogPuff: 0x5ce0ff, glow: true, stars: true,
  },
}

export function islandThemeFor(template: GameVisualTemplate) {
  return ISLAND_THEMES[template]
}

/** Kenney "Nature Kit" models (CC0, see public/island/kenney/License.txt). */
export const ISLAND_MODELS = [
  'tree_palm', 'tree_palmTall', 'tree_default', 'tree_oak', 'plant_bush', 'plant_bushLarge', 'rock_largeA', 'rock_smallA',
  'flower_redA', 'flower_yellowA', 'canoe', 'tree_pineRoundA', 'tree_pineTallA', 'tree_pineDefaultA', 'tent_detailedOpen',
  'tent_smallClosed', 'campfire_stones', 'log_stack', 'stump_round', 'mushroom_redGroup', 'rock_largeB', 'lily_large',
  'tree_blocks', 'tree_blocks_fall', 'statue_obelisk', 'statue_column', 'statue_ring', 'sign',
] as const
export type IslandModelName = typeof ISLAND_MODELS[number]

/** Which models each decoration style scatters around the plots. */
export const DECORATION_MODELS: Record<IslandDecoration, IslandModelName[]> = {
  tropical: ['tree_palm', 'tree_palmTall', 'tree_default', 'tree_oak', 'plant_bush', 'rock_largeA', 'flower_redA', 'flower_yellowA'],
  pine: ['tree_pineRoundA', 'tree_pineTallA', 'tree_pineDefaultA', 'stump_round', 'mushroom_redGroup', 'rock_largeB', 'log_stack', 'plant_bushLarge'],
  block: ['tree_blocks', 'tree_blocks_fall'],
  neon: [],
  crystal: ['statue_obelisk', 'statue_column', 'statue_ring'],
  antenna: [],
}
