import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameBrand } from './GameBrand'

describe('GameBrand asset paths', () => {
  it('renders the legacy logo below /games', () => {
    expect(renderToStaticMarkup(<GameBrand legacy />)).toContain('src="/games/excel-master-logo.svg"')
  })
  it('prefixes app-local custom logos and keeps remote logos', () => {
    const local = { title:'Course', settings:{ theme:{ logoUrl:'/brand.svg' } } } as never
    const remote = { title:'Course', settings:{ theme:{ logoUrl:'https://cdn.example/brand.svg' } } } as never
    expect(renderToStaticMarkup(<GameBrand game={local} />)).toContain('src="/games/brand.svg"')
    expect(renderToStaticMarkup(<GameBrand game={remote} />)).toContain('src="https://cdn.example/brand.svg"')
  })
})
