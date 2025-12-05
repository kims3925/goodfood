import { redirect } from 'next/navigation'

export default async function HomePage() {
  // 루트 경로 접근 시 메인 페이지로 리다이렉트
  // Shop 식별은 middleware에서 처리됨
  redirect('/main')
}
