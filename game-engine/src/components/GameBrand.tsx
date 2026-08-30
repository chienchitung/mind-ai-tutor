'use client'

import { useState } from 'react'
import { Compass } from 'lucide-react'
import type { GameDefinition } from '../types/game'
import { gameBrandKind } from '../lib/mission'

export function GameBrand({ game, legacy = false }: { game?: GameDefinition | null; legacy?: boolean }) {
  const label = game?.settings.theme?.brandLabel || game?.title || (legacy ? 'Excel Master' : '學習任務')
  const logo = game?.settings.theme?.logoUrl
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const safeLogo = logo && (/^https?:\/\//i.test(logo) || /^\/(?!\/)/.test(logo)) && failedUrl !== logo
  if (safeLogo) return <img src={logo} alt={label} className="quest-custom-logo" onError={() => setFailedUrl(logo)} /> // eslint-disable-line @next/next/no-img-element
  if (gameBrandKind(label, legacy) === 'excel') {
    return <img src="/excel-master-logo.svg" alt={label} className="quest-excel-logo" /> // eslint-disable-line @next/next/no-img-element
  }
  return <span className="quest-brand"><Compass aria-hidden="true" /><span>{label}</span></span>
}
