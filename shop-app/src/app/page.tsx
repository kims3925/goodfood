import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function HomePage() {
  const headersList = await headers()
  const channelId = headersList.get('x-channel-id')

  // 채널이 식별된 경우 메인 페이지로
  if (channelId) {
    redirect('/main')
  }

  // 채널 미식별 시 채널 선택 페이지로
  redirect('/channel-select')
}
