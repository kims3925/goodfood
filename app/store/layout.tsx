import StoreLayout from './StoreLayout'

export const metadata = {
  title: '가족함께 스토어 - 농수산물 직거래 쇼핑몰',
  description: '신선한 농수산물을 합리적인 가격에 만나보세요',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StoreLayout>{children}</StoreLayout>
}
