import '@/styles/globals.css'

export const metadata = {
  title: 'GoodShop - 굿푸드몰 관리자',
  description: 'Band 기반 상품 소싱, AI 가공, 멀티 쇼핑몰 운영 자동화',
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
