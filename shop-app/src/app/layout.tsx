import type { Metadata, Viewport } from 'next'
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0077B6',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '가족함께 - 신선한 수산물 농수산물 축산물 산지직송 쇼핑몰',
    template: '%s | 가족함께',
  },
  description:
    '가족함께 쇼핑몰에서 신선한 수산물, 횟감, 과일, 한우, 밀키트, 농수산물, 축산물을 산지직송으로 만나보세요. 매일 새벽 경매로 엄선한 최상급 식품을 합리적인 가격에 제공합니다.',
  keywords: [
    '수산물', '농수산물', '축산물', '횟감', '과일', '한우', '밀키트', '식품',
    '산지직송', '새벽배송', '신선식품', '해산물', '생선', '회', '참치',
    '전복', '랍스타', '킹크랩', '대게', '오징어', '갈치', '고등어',
    '사과', '딸기', '귤', '한라봉', '수박', '포도', '복숭아',
    '한우선물세트', '소고기', '돼지고기', '닭고기',
    '반찬', '간편식', '가공식품', '건강식품',
    '온라인수산시장', '직거래쇼핑몰', '가족함께',
  ],
  authors: [{ name: '가족함께' }],
  creator: '가족함께',
  publisher: '가족함께',
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '가족함께',
    title: '가족함께 - 신선한 수산물 농수산물 산지직송 쇼핑몰',
    description:
      '매일 새벽 경매로 엄선한 신선한 수산물, 횟감, 과일, 한우, 밀키트를 산지직송으로 만나보세요.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: '가족함께 - 신선한 수산물 농수산물 산지직송 쇼핑몰',
    description:
      '매일 새벽 경매로 엄선한 신선한 수산물, 횟감, 과일, 한우, 밀키트를 산지직송으로 만나보세요.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    // 네이버 서치어드바이저 인증코드는 환경변수로 관리
    other: {
      'naver-site-verification': process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || '',
    },
  },
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
