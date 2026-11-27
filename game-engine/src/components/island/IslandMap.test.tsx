// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Lesson } from '../../types/lesson'

const scene = vi.hoisted(() => ({ props: null as null | { selected: number; walkTo: number; refusals: number; onSelect: (i: number) => void } }))
// The 3D scene is replaced by a stub that records what the map asks of it.
vi.mock('next/dynamic', () => ({ default: () => (props: NonNullable<typeof scene.props>) => { scene.props = props; return null } }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
// eslint-disable-next-line import/first
import { IslandMap } from './IslandMap'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const lessons: Lesson[] = Array.from({ length: 6 }, (_, n) => ({ lesson_id: `l${n}`, title: `第 ${n} 關`, description: '', content: '', number: n }))
let container: HTMLDivElement, root: Root
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
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
