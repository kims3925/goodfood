import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/modules/common/providers/SessionProvider'

export const metadata: Metadata = {
  title: '쇼핑몰 | 최고의 상품을 최저가로',
  description: '신선한 상품과 다양한 혜택을 만나보세요.',
  keywords: ['쇼핑몰', '온라인쇼핑', '할인', '특가'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
