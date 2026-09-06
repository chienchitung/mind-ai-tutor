import Image from 'next/image'
import { gameAssetPath } from '../lib/game-asset-path'
import { mentorForTemplate } from '../lib/mentor'
import type { GameVisualTemplate } from '../types/game'

/** Decorative avatar; surrounding controls and headings provide the accessible mentor name. */
export function MentorAvatar({ template = 'discovery', className = '' }: { template?: GameVisualTemplate; className?: string }) {
  const mentor = mentorForTemplate(template)
  return <Image src={gameAssetPath(mentor.avatarPath)} alt="" aria-hidden="true"
    width={96} height={96} unoptimized className={`mentor-avatar ${className}`} />
}
