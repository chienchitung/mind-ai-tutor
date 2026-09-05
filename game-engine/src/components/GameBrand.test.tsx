import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameBrand } from './GameBrand'

describe('GameBrand asset paths', () => {
  it('renders the recolorable legacy flag mark and label', () => {
    const html = renderToStaticMarkup(<GameBrand legacy />)
    expect(html).toContain('quest-brand-excel')
    expect(html).toContain('var(--quest-brand-flag)')
    expect(html).toContain('Excel Master')
  })
  it('prefixes app-local custom logos and keeps remote logos', () => {
    const local = { title:'Course', settings:{ theme:{ logoUrl:'/brand.svg' } } } as never
    const remote = { title:'Course', settings:{ theme:{ logoUrl:'https://cdn.example/brand.svg' } } } as never
    expect(renderToStaticMarkup(<GameBrand game={local} />)).toContain('src="/games/brand.svg"')
    expect(renderToStaticMarkup(<GameBrand game={remote} />)).toContain('src="https://cdn.example/brand.svg"')
  })
})
