'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import type { GameDefinition } from '../types/game'
import { gameBrandKind } from '../lib/mission'
import { gameAssetPath } from '../lib/game-asset-path'

function ExcelBrand({ label }: { label: string }) {
  return <span className="quest-brand quest-brand-excel">
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <rect x="5" y="13" width="67" height="62" rx="16" fill="var(--quest-brand-tile)"/>
      <rect x="12" y="29" width="53" height="38" rx="8" fill="var(--quest-brand-surface)"/>
      <path d="M15 22h17m6 0h5M29 31v34m18-34v34M14 47h49" fill="none" stroke="var(--quest-brand-grid)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M22 57h16V43h17V25" fill="none" stroke="var(--quest-brand-accent)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="22" cy="57" r="5" fill="var(--quest-brand-accent)" stroke="white" strokeWidth="3"/><circle cx="38" cy="43" r="5" fill="var(--quest-brand-tile)" stroke="white" strokeWidth="3"/>
      <path d="M55 26V5l17 5-17 6" fill="var(--quest-brand-flag)"/><path d="M55 26V5" stroke="var(--quest-brand-pole)" strokeWidth="4" strokeLinecap="round"/>
    </svg><span>{label}</span>
  </span>
}

export function GameBrand({ game, legacy = false }: { game?: GameDefinition | null; legacy?: boolean }) {
  const label = game?.settings.theme?.brandLabel || game?.title || (legacy ? 'Excel Master' : '學習任務')
  const logo = game?.settings.theme?.logoUrl
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const resolvedLogo = logo && (/^https?:\/\//i.test(logo) || /^\/(?!\/)/.test(logo)) ? gameAssetPath(logo) : null
  if (resolvedLogo && failedUrl !== resolvedLogo) return <img src={resolvedLogo} alt={label} className="quest-custom-logo" onError={() => setFailedUrl(resolvedLogo)} /> // eslint-disable-line @next/next/no-img-element
  if (gameBrandKind(label, legacy) === 'excel') return <ExcelBrand label={label} />
  return <span className="quest-brand"><Flag aria-hidden="true" /><span>{label}</span></span>
}
