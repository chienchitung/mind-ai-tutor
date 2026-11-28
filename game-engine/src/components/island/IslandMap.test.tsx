// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Lesson } from '../../types/lesson'

const scene = vi.hoisted(() => ({ props: null as null | { selected: number; walkTo: number; refusals: number; celebrate: number | null; onSelect: (i: number) => void; onCelebrate: () => void; onReady: () => void } }))
// The 3D scene is replaced by a stub that records what the map asks of it.
vi.mock('next/dynamic', () => ({ default: () => (props: NonNullable<typeof scene.props>) => { scene.props = props; return null } }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
// eslint-disable-next-line import/first
import { IslandMap } from './IslandMap'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const lessons: Lesson[] = Array.from({ length: 6 }, (_, n) => ({ lesson_id: `l${n}`, title: `第 ${n} 關`, description: '', content: '', number: n }))
let container: HTMLDivElement, root: Root
beforeEach(() => { window.localStorage.clear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('IslandMap player', () => {
  it('starts at the current lesson, walks to reached stops and refuses locked ones', () => {
    act(() => root.render(<IslandMap template="discovery" lessons={lessons} completedLessons={['l0', 'l1']} signedIn href={id => `/x/${id}`} onUnavailable={() => {}} />))
    expect(scene.props).toMatchObject({ selected: 2, walkTo: 2, refusals: 0 })
    act(() => scene.props!.onSelect(0))
    expect(scene.props).toMatchObject({ selected: 0, walkTo: 0, refusals: 0 })
    act(() => scene.props!.onSelect(4))
    expect(scene.props).toMatchObject({ selected: 4, walkTo: 0, refusals: 1 })
    expect(container.textContent).toContain('先完成「第 3 關」')
  })
})

describe('IslandMap unlock celebration', () => {
  const render = (completed: string[], signedIn = true) =>
    act(() => root.render(<IslandMap template="discovery" gameId="g" lessons={lessons} completedLessons={completed} signedIn={signedIn} href={id => `/x/${id}`} onUnavailable={() => {}} />))

  it('walks from the stop last seen to the newly opened one, then announces it', () => {
    vi.useFakeTimers()
    try {
      window.localStorage.setItem('game:g:island_seen_stop', '1')
      render(['l0', 'l1'])
      expect(scene.props).toMatchObject({ walkTo: 1, celebrate: 2, selected: 2 })
      // A slow model download: nothing moves, and nothing is remembered, until the island shows
      act(() => { vi.advanceTimersByTime(5000) })
      expect(scene.props).toMatchObject({ walkTo: 1 })
      expect(window.localStorage.getItem('game:g:island_seen_stop')).toBe('1')
      act(() => scene.props!.onReady())
      act(() => { vi.advanceTimersByTime(800) })
      expect(scene.props).toMatchObject({ walkTo: 2, celebrate: 2 })
      expect(window.localStorage.getItem('game:g:island_seen_stop')).toBe('2')
      act(() => scene.props!.onCelebrate())
      expect(container.querySelector('[role="status"]')?.textContent).toContain('新關卡解鎖：第 2 關')
      act(() => { vi.advanceTimersByTime(5000) })
      expect(container.querySelector('.island-unlock')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not celebrate on the first visit or before signing in', () => {
    render(['l0', 'l1'])
    expect(scene.props).toMatchObject({ walkTo: 2, celebrate: null })
    act(() => root.unmount()); root = createRoot(container)
    window.localStorage.clear()
    window.localStorage.setItem('game:g:island_seen_stop', '0')
    render(['l0', 'l1'], false)
    expect(scene.props).toMatchObject({ celebrate: null })
  })

  it('describes the island for screen readers', () => {
    render(['l0', 'l1'])
    const stage = container.querySelector('.island-stage')!
    const summary = document.getElementById(stage.getAttribute('aria-describedby')!)
    expect(summary?.textContent).toMatch(/共 6 站，已完成 2 站，目前在「.*第 2 關」/)
  })
})
