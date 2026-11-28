'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QuestHome } from '../../components/QuestHome'
import { gameVisualTemplate } from '../../lib/mission'
import type { GameDefinition } from '../../types/game'
import type { Lesson } from '../../types/lesson'

// Stars, sparkles and other scattered decoration use Math.random: seed it so every snapshot of
// the same code draws the same picture. Only this page's bundle does this.
if (typeof window !== 'undefined') {
  let seed = 20261128
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GAME_ID = 'visual-qa'
const TITLES = ['認識資料表', '排序與篩選', '常用函數', '條件判斷', '查找資料', '樞紐分析', '圖表呈現', '資料清理', '自動化小技巧', '綜合練習', '專題規劃', '專題實作', '成果發表', '延伸挑戰', '進階函數', '資料驗證', '期末任務']

function lessonsFor(count: number): Lesson[] {
  return Array.from({ length: count }, (_, i) => ({
    lesson_id: `qa-${i}`,
    title: TITLES[i] ?? `關卡 ${i + 1}`,
    description: '用一個生活中的小問題，練習這一站的技巧。',
    content: '',
    number: i,
    duration: '10',
    role: i === 0 ? 'intro' : i === count - 1 ? 'final' : 'standard',
  }))
}

function Fixture() {
  const params = useSearchParams()
  const template = gameVisualTemplate({ template: (params.get('t') ?? undefined) as never })
  const count = Math.max(2, Math.min(17, Number(params.get('n') ?? 9) || 9))
  const done = Math.max(0, Math.min(count, Number(params.get('done') ?? 3) || 0))
  const view = params.get('view') === 'route' ? 'route' : 'island'
  const seen = params.get('seen')
  // The home reads its map view (and the stop last seen) from local storage on mount
  const [ready, setReady] = useState(false)
  useEffect(() => {
    window.localStorage.clear()
    window.localStorage.setItem(`quest-map-view:${GAME_ID}`, view)
    if (seen !== null) window.localStorage.setItem(`game:${GAME_ID}:island_seen_stop`, seen)
    setReady(true)
  }, [view, seen])
  if (!ready) return null
  const lessons = lessonsFor(count)
  const game: GameDefinition = { id: GAME_ID, title: '資料探險隊', description: '從一個問題開始，探索資料、練習解題。', settings: { theme: { template } }, lessons }
  return <QuestHome game={game} gameId={GAME_ID} lessons={lessons} completedLessons={lessons.slice(0, done).map(l => l.lesson_id)}
    stars={done * 3} level={1 + Math.floor(done / 3)} exp={done * 40} signedIn completionTime={null} rank={null}
    onStart={() => {}} onReset={() => {}} onLeaderboard={() => {}} />
}

export function VisualQa() {
  return <Suspense fallback={null}><Fixture /></Suspense>
}
