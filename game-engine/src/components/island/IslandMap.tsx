'use client'

import { Component, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ChevronRight, LockKeyhole, PartyPopper } from 'lucide-react'
import type { GameVisualTemplate } from '../../types/game'
import type { Lesson } from '../../types/lesson'
import { canEnterLesson } from '../../lib/mission'
import { experienceForTemplate } from '../../lib/template-experience'
import { ISLAND_THEMES } from '../../lib/island/themes'
import { regionOf } from '../../lib/island/layout'
import type { IslandSceneStop } from './IslandScene'
import { readSeenStop, rememberSeenStop, unlockFrom } from '../../lib/island/celebration'
import { islandSummary } from '../../lib/island/keyboard'

// WebGL only exists in the browser, and three.js is large: load it on demand.
const IslandScene = dynamic(() => import('./IslandScene'), { ssr: false, loading: () => <IslandLoading /> })

function IslandLoading() {
  return <div className="island-loading" role="status">島嶼載入中…</div>
}

/** Any failure inside the 3D view hands the student back to the route map. */
class IslandBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

interface IslandMapProps {
  template: GameVisualTemplate
  /** Scopes the stop the student last saw here, so a newly opened one can be celebrated. */
  gameId?: string
  lessons: Lesson[]
  completedLessons: string[]
  signedIn: boolean
  href: (lessonId: string) => string
  onUnavailable: () => void
}

export function IslandMap({ template, gameId, lessons, completedLessons, signedIn, href, onUnavailable }: IslandMapProps) {
  const experience = experienceForTemplate(template)
  const theme = ISLAND_THEMES[template]
  const currentIndex = lessons.findIndex(lesson => !completedLessons.includes(lesson.lesson_id))
  // The furthest stop the student has reached: the lesson they are on, or the last one when all are done
  const reachedTo = currentIndex >= 0 ? currentIndex : lessons.length - 1
  const [selected, setSelected] = useState(reachedTo)
  // Back with a stop newly opened since the last visit: the player starts where the student last
  // saw it and walks to the new stop, which then celebrates. Read once, when the map opens.
  const [arrival] = useState(() => signedIn ? unlockFrom(readSeenStop(gameId), reachedTo) : null)
  const celebrate = arrival === null ? null : reachedTo
  // The player walks to stops the student has reached; further ones are still fogged in.
  const [walkTo, setWalkTo] = useState(arrival ?? reachedTo)
  const [refusals, setRefusals] = useState(0)
  const [cheered, setCheered] = useState(false)
  // Nothing starts until the island is on screen: a slow model download must not skip the walk,
  // and the stop is only remembered as seen once the student could actually see it.
  const [sceneReady, setSceneReady] = useState(false)
  useEffect(() => { if (signedIn && sceneReady) rememberSeenStop(gameId, reachedTo) }, [gameId, reachedTo, signedIn, sceneReady])
  const opened = useRef(false)
  useEffect(() => {
    if (!sceneReady) return
    if (!opened.current) {
      opened.current = true
      // A short pause on the old stop, so the walk to the new one is seen
      if (arrival !== null) { const timer = setTimeout(() => setWalkTo(reachedTo), 700); return () => clearTimeout(timer) }
      setWalkTo(reachedTo)
      return
    }
    setSelected(reachedTo); setWalkTo(reachedTo)
  }, [reachedTo, arrival, sceneReady])
  useEffect(() => {
    if (!cheered) return
    const timer = setTimeout(() => setCheered(false), 4500)
    return () => clearTimeout(timer)
  }, [cheered])
  const pick = (index: number) => {
    setSelected(index)
    if (index <= reachedTo) setWalkTo(index)
    else setRefusals(count => count + 1)
  }

  const [env, setEnv] = useState({ reduceMotion: false, richEffects: true })
  useEffect(() => {
    setEnv({
      reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      richEffects: window.innerWidth >= 760,
    })
  }, [])

  const stops: IslandSceneStop[] = useMemo(() => lessons.map((lesson, index) => {
    const done = completedLessons.includes(lesson.lesson_id)
    const status = done ? 'done' : index === currentIndex ? 'current' : 'locked'
    const intro = lesson.role === 'intro'
    const final = lesson.role === 'final'
    // The first stop is drawn with a flag (see IslandScene); the last with a star
    const label = intro ? '' : final ? '★' : String(lesson.number)
    const state = done ? '已完成' : status === 'current' ? '目前關卡' : '尚未解鎖'
    return { status, intro, final, label, ariaLabel: `${experience.home.stopLabel(lesson.role, lesson.number)}：${lesson.title}（${state}）` }
  }), [lessons, completedLessons, currentIndex, experience])

  const summaryId = useId()
  const lesson = lessons[selected]
  if (!lesson) return null
  const done = completedLessons.includes(lesson.lesson_id)
  const unlocked = canEnterLesson(lessons, selected, completedLessons, signedIn)
  const active = selected === currentIndex
  const prerequisite = selected > 0 ? lessons[selected - 1]?.title : undefined

  return <div className="island-map">
    <div className="island-stage" role="group" aria-label="島嶼地圖" aria-describedby={summaryId}>
      <p id={summaryId} className="island-sr-only">{islandSummary(lessons.length, lessons.filter(l => completedLessons.includes(l.lesson_id)).length, currentIndex >= 0 ? `${experience.home.stopLabel(lessons[currentIndex].role, lessons[currentIndex].number)}：${lessons[currentIndex].title}` : null)}</p>
      <IslandBoundary onError={onUnavailable}>
        <Suspense fallback={<IslandLoading />}>
          <IslandScene template={template} stops={stops} selected={selected} walkTo={walkTo}
            refusals={refusals} onSelect={pick} celebrate={celebrate} onCelebrate={() => setCheered(true)} onReady={() => setSceneReady(true)}
            reduceMotion={env.reduceMotion} richEffects={env.richEffects} />
        </Suspense>
      </IslandBoundary>
      {/* Always present, so screen readers announce the unlock when it appears */}
      <div className="island-unlock-region" role="status">
        {cheered && celebrate !== null && <p className="island-unlock"><PartyPopper size={18} aria-hidden="true" />新關卡解鎖：{lessons[celebrate]?.title}</p>}
      </div>
      <ol className="island-regions" aria-label="島嶼區域">
        {theme.regions.map((name, region) => {
          const open = lessons.some((_, index) => regionOf(index) === region)
          return <li key={name} className={open ? 'is-open' : undefined}>{name}<span>{open ? '已開放' : '待更多關卡'}</span></li>
        })}
      </ol>
    </div>
    <section className="island-card" aria-live="polite" aria-label="選取的關卡">
      <span className="quest-kicker">{experience.home.stopLabel(lesson.role, lesson.number)}</span>
      <h3>{lesson.title}</h3>
      <p>{lesson.description || '進入關卡查看學習資料與任務指引。'}</p>
      <div className="island-card-footer">
        <span className="quest-status">{done ? '已完成' : active && signedIn ? '你在這裡' : unlocked ? '可開始' : !signedIn ? '登入後開始' : '待解鎖'}</span>
        {unlocked
          ? <Link href={href(lesson.lesson_id)} className="quest-stop-link">{done ? '再看一次' : active ? '開始任務' : '進入任務'}<ChevronRight className="quest-direction-icon" size={16} aria-hidden="true" /></Link>
          : <span className="quest-lock"><LockKeyhole size={14} />{!signedIn ? '登入後即可開始' : prerequisite ? `先完成「${prerequisite}」` : '尚未解鎖'}</span>}
      </div>
    </section>
  </div>
}

/** True when this browser can draw WebGL; checked once on the client. */
export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
