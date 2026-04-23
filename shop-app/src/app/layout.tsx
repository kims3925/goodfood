import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import SessionProvider from '@/modules/common/providers/SessionProvider'
import { ToastProvider } from '@/modules/common/ui-kit/src/ui'
import { Toaster } from 'react-hot-toast'

// Pretendard 폰트 로컬 로딩 (CDN 불필요)
const pretendard = localFont({
  src: '../fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '100 900',
})

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
    <html lang="ko" className={pretendard.variable}>
      <body className={`${pretendard.className} min-h-screen bg-gray-50`}>
        <SessionProvider>
          <ToastProvider>
            {children}
            <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
