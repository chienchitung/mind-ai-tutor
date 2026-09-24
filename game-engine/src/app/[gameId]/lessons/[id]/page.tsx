import LessonPage from '@/app/lessons/[id]/page'

export default async function GameLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string; id: string }>
  searchParams: Promise<{ assignment?: string | string[] }>
}) {
  const { gameId, id } = await params
  const query = await searchParams
  const assignmentId = typeof query.assignment === 'string' ? query.assignment : null
  return <LessonPage params={Promise.resolve({ id })} gameId={gameId} assignmentId={assignmentId} />
}
