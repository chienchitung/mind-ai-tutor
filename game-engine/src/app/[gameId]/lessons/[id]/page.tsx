import LessonPage from '@/app/lessons/[id]/page'

export default async function GameLessonPage({
  params,
}: {
  params: Promise<{ gameId: string; id: string }>
}) {
  const { gameId, id } = await params
  return <LessonPage params={Promise.resolve({ id })} gameId={gameId} />
}
