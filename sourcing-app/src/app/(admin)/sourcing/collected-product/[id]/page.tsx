import CollectedProductDetailClient from './CollectedProductDetailClient'

export default async function CollectedProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CollectedProductDetailClient id={id} />
}
