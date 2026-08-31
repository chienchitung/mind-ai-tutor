import HomePage from '@/app/page'

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  return <HomePage gameId={gameId} />
}
