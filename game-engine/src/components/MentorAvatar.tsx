import Image from 'next/image'

/** Refined from the original robot identity; surrounding controls supply accessible labels. */
export function MentorAvatar({ className = '' }: { className?: string }) {
  return <Image src="/avatars/ellis-robot-v2.svg" alt="" aria-hidden="true"
    width={96} height={96} unoptimized className={`mentor-avatar ${className}`} />
}
