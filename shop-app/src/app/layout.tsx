import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/modules/common/providers/SessionProvider'
import { ToastProvider } from '@/modules/common/ui-kit/src/ui'

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
      <head>
        {/* 리소스 힌트: 초기 HTML에 포함되어 가장 효과적 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://s3.amazonaws.com" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
