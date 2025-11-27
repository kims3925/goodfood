import StoreLayout from '../store/StoreLayout'

export const metadata = {
  title: 'ABC마켓 - 신선한 농수산물 직거래 쇼핑몰',
  description: '신선한 농수산물을 합리적인 가격에 만나보세요. ABC마켓에서 빠른 배송으로 받아보세요!',
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StoreLayout>{children}</StoreLayout>
}
