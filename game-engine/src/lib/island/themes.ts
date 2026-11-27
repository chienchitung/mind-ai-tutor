import type { GameVisualTemplate } from '../../types/game'

export type IslandBuildingKind = 'hut' | 'block' | 'neon' | 'tent' | 'tower' | 'dome'
export type IslandFinalKind = 'lighthouse' | 'stack' | 'castle' | 'summit' | 'spire' | 'rocket'
export type IslandDecoration = 'tropical' | 'pine' | 'block' | 'neon' | 'crystal' | 'antenna'

/** How a template's island looks. Colours follow the template's 2D palette in quest.css. */
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
}

export const ISLAND_THEMES: Record<GameVisualTemplate, IslandTheme> = {
  discovery: {
    regions: ['海灣碼頭', '雨林小徑', '瞭望山丘', '燈塔海岬'],
    sky: 0xcfe8ee, sea: 'water', seaColor: 0x2c8aa0,
    grass: [0x8cc47a, 0x5fa865, 0x9cbb6a, 0x7fb98a], base: 0xe8d3a1,
    roofs: [0xd8664a, 0x2f7f8f, 0xd9a441, 0xc4574a], wall: 0xf4ecdc,
    path: 0xd9d5c8, pathDone: 0xe3c27a, ring: 0xffc94d,
    building: 'hut', final: 'lighthouse', decoration: 'tropical',
    hemi: [0xffffff, 0x6b8f7a, 0.75], sun: 0.9, fogPuff: 0xffffff, daySky: true,
  },
  'neo-brutal': {
    regions: ['底板區', '零件區', '組裝區', '成品台'],
    sky: 0xfff1b8, sea: 'water', seaColor: 0x70e1f5,
    grass: [0xffde59, 0x9be564, 0xff9f68, 0xb8a6ff], base: 0xffffff,
    roofs: [0x7c5cff, 0xff5c8a, 0x70e1f5, 0x111111], wall: 0xffffff,
    path: 0xffffff, pathDone: 0x111111, ring: 0x7c5cff,
    building: 'block', final: 'stack', decoration: 'block',
    hemi: [0xffffff, 0xbbaa77, 0.9], sun: 0.8, fogPuff: 0xffffff, outline: 0x111111,
  },
  arcade: {
    regions: ['新手港', '霓虹街區', '電路高塔', '頭目城堡'],
    sky: 0x0b0828, sea: 'grid', seaColor: 0x120d3a,
    grass: [0x2d2380, 0x35299a, 0x3d2fae, 0x4a2a8a], base: 0x1b1450,
    roofs: [0x49e7ff, 0xff4fd8, 0xfff49b, 0x7c5cff], wall: 0x1a1540,
    path: 0x2c2466, pathDone: 0x49e7ff, ring: 0xff4fd8,
    building: 'neon', final: 'castle', decoration: 'neon',
    hemi: [0x8a7dff, 0x110a30, 0.65], sun: 0.35, fogPuff: 0x5a4fa8, glow: true, stars: true,
  },
  'forest-camp': {
    regions: ['湖畔營地', '松林步道', '溪谷吊橋', '山頂瞭望'],
    sky: 0xe6ead0, sea: 'water', seaColor: 0x5f8f8a,
    grass: [0x8fae6a, 0x6f8d52, 0x7d9a5c, 0x9aa86f], base: 0xd8c79a,
    roofs: [0xc37438, 0xe3ad48, 0x6f8d52, 0xb5532f], wall: 0xfff7dd,
    path: 0xcdbf98, pathDone: 0xa0703f, ring: 0xe3ad48,
    building: 'tent', final: 'summit', decoration: 'pine',
    hemi: [0xfffbe8, 0x5d6b45, 0.8], sun: 0.85, fogPuff: 0xffffff, daySky: true,
  },
  'arcane-archive': {
    regions: ['入館前庭', '書塔迴廊', '星象天台', '終章大殿'],
    sky: 0x2a1d3d, sea: 'water', seaColor: 0x241a3a,
    grass: [0x4b5e4a, 0x3e5a52, 0x55496b, 0x4a3d63], base: 0x7a6a8c,
    roofs: [0x704487, 0x3e8c75, 0xd9b261, 0x8a3f6f], wall: 0xe9dcc0,
    path: 0x6a5a7c, pathDone: 0xd9b261, ring: 0xd9b261,
    building: 'tower', final: 'spire', decoration: 'crystal',
    hemi: [0xb9a6e6, 0x1c1428, 0.6], sun: 0.45, fogPuff: 0x9a86c4, glow: true, stars: true,
  },
  'orbital-lab': {
    regions: ['發射平台', '資料艙', '溫室實驗區', '火箭發射場'],
    sky: 0x061521, sea: 'void', seaColor: 0x061521,
    grass: [0x2b4756, 0x2f5163, 0x2a5a58, 0x334b66], base: 0x1b2e3a,
    roofs: [0x5ce0ff, 0x43dfbc, 0xffd36b, 0xff7a59], wall: 0xdbe9f0,
    path: 0x2b5f75, pathDone: 0x5ce0ff, ring: 0x5ce0ff,
    building: 'dome', final: 'rocket', decoration: 'antenna',
    hemi: [0x9fdcff, 0x061521, 0.65], sun: 0.6, fogPuff: 0x5ce0ff, glow: true, stars: true,
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
