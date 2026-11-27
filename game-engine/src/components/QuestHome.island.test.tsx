// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Lesson } from '../types/lesson'

const island = vi.hoisted(() => ({ webgl: true }))
vi.mock('./island/IslandMap', () => ({
  webglAvailable: () => island.webgl,
  IslandMap: ({ lessons }: { lessons: Lesson[] }) => <div data-testid="island-map">{lessons.length} stops</div>,
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
// eslint-disable-next-line import/first
import { QuestHome } from './QuestHome'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const lesson = (n: number): Lesson => ({ lesson_id: `l${n}`, title: `第 ${n} 關`, description: '', content: '', number: n, role: n === 0 ? 'intro' : undefined })
const props = (count: number) => ({
  gameId: 'game-1', lessons: Array.from({ length: count }, (_, i) => lesson(i)), completedLessons: ['l0'],
  stars: 0, level: 1, exp: 0, signedIn: true, completionTime: null, rank: null,
  onStart: () => {}, onReset: () => {}, onLeaderboard: () => {},
})

let container: HTMLDivElement, root: Root
beforeEach(() => { island.webgl = true; window.localStorage.clear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove() })
const render = (count: number) => act(() => { root.render(<QuestHome {...props(count)} />) })
const button = (name: string) => Array.from(container.querySelectorAll('button')).find(b => b.textContent === name)

describe('QuestHome island view', () => {
  it('keeps the route map by default and switches to the island on request, remembering the choice', () => {
    render(5)
    expect(container.querySelector('.quest-path')).not.toBeNull()
    expect(button('路線圖')?.getAttribute('aria-pressed')).toBe('true')
    act(() => button('3D 島嶼')!.click())
    expect(container.querySelector('[data-testid="island-map"]')?.textContent).toBe('5 stops')
    expect(container.querySelector('.quest-path')).toBeNull()
    expect(window.localStorage.getItem('quest-map-view:game-1')).toBe('island')

    act(() => root.unmount()); root = createRoot(container)
    render(5)
    expect(container.querySelector('[data-testid="island-map"]')).not.toBeNull()
  })

  it('offers no island when the browser has no WebGL or the game is longer than the island', () => {
    island.webgl = false
    render(5)
    expect(button('3D 島嶼')).toBeUndefined()
    island.webgl = true
    render(18)
    expect(button('3D 島嶼')).toBeUndefined()
  })
})
