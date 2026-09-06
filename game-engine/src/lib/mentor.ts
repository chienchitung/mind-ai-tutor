import type { GameVisualTemplate } from '../types/game'

export interface GameMentor {
  name: string
  role: string
  avatarPath: string
  tagline: string
  homeMessage: string
  greetingLead: string
}

export const GAME_MENTORS: Record<GameVisualTemplate, GameMentor> = {
  discovery: {
    name: '洛奇',
    role: '探索嚮導',
    avatarPath: '/avatars/mentor-roki.webp',
    tagline: '先觀察線索，再一起找出下一步',
    homeMessage: '卡住時，我會陪你整理線索、釐清目標，再由你完成最後一步。',
    greetingLead: '我們先看看已知線索，再決定下一步。',
  },
  'neo-brutal': {
    name: '波波',
    role: '拼裝教練',
    avatarPath: '/avatars/mentor-bobo.webp',
    tagline: '把大問題拆成一塊一塊',
    homeMessage: '難題也能拆小。我會幫你找出關鍵積木，再一起把解法拼起來。',
    greetingLead: '把問題拆成幾個小積木，我們從第一塊開始。',
  },
  arcade: {
    name: '尼克斯',
    role: '闖關拍檔',
    avatarPath: '/avatars/mentor-nyx.webp',
    tagline: '讀懂規則，破解這一關',
    homeMessage: '我會提示關卡規則與關鍵方向，讓你保留親手破關的成就感。',
    greetingLead: '先讀懂這關的規則，再鎖定突破口。',
  },
  'forest-camp': {
    name: '莫里',
    role: '森林嚮導',
    avatarPath: '/avatars/mentor-mori.webp',
    tagline: '放慢腳步，把路看清楚',
    homeMessage: '我會陪你確認方向、留下學習足跡；走錯岔路，也能回頭再試。',
    greetingLead: '別急著趕路，我們先確認方向與沿途線索。',
  },
  'arcane-archive': {
    name: '萊拉',
    role: '典藏書靈',
    avatarPath: '/avatars/mentor-lyra.webp',
    tagline: '翻開線索，讀出解法',
    homeMessage: '我會替你整理散落的知識線索，協助你親手解開每個章節。',
    greetingLead: '讓我們翻開線索，找出這一頁真正要解開的問題。',
  },
  'orbital-lab': {
    name: '奧比',
    role: '實驗領航員',
    avatarPath: '/avatars/mentor-orbi.webp',
    tagline: '建立假設，逐步驗證',
    homeMessage: '我會協助你讀取任務資料、建立假設，再用證據完成驗證。',
    greetingLead: '先讀取任務資料，建立一個可以驗證的方向。',
  },
}

export function mentorForTemplate(template: GameVisualTemplate = 'discovery') {
  return GAME_MENTORS[template]
}
