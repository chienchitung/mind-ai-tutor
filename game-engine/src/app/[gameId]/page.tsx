import HomePage from '@/app/page'

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>
  searchParams: Promise<{ assignment?: string | string[] }>
}) {
  const { gameId } = await params
  const query = await searchParams
  const assignmentId = typeof query.assignment === 'string' ? query.assignment : null
  return <HomePage gameId={gameId} assignmentId={assignmentId} />
}
