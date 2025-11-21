import '@/styles/globals.css'

export const metadata = {
  title: '소싱 자동화 관리 시스템',
  description: '상품 소싱 및 자동화 관리 도구',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
