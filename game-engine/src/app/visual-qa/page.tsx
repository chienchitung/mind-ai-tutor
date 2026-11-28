import { notFound } from 'next/navigation'
import { VisualQa } from './VisualQa'

// A fixed game home for the visual snapshot check (game-engine/visual). It exists only where the
// server is started with VISUAL_QA=1, which the deployed game never is.
export const dynamic = 'force-dynamic'

export default function VisualQaPage() {
  if (process.env.VISUAL_QA !== '1') notFound()
  return <VisualQa />
}
