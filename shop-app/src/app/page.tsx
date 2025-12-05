import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function HomePage() {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')

  // Shop이 식별된 경우 메인 페이지로
  if (shopId) {
    redirect('/main')
  }

  // Shop 미식별 시 not-authorized 페이지로 (middleware에서 이미 처리됨)
  redirect('/not-authorized')
}
