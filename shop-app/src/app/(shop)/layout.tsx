import { headers } from 'next/headers'
import StoreLayout from './StoreLayout'
import { ShopProvider, ShopInfo, RelatedShop } from '@/contexts/ShopContext'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import prisma from '@bandauto/db'

// 같은 유저의 다른 Shop들 조회
async function getRelatedShops(currentShopId: number, userId: number | null): Promise<RelatedShop[]> {
  if (!userId) return []

  try {
    const shops = await prisma.shop.findMany({
      where: {
        userId,
        isActive: true,
        id: { not: currentShopId }, // 현재 Shop 제외
      },
      select: {
        id: true,
        subdomain: true,
        name: true,
        theme: {
          select: {
            logoUrl: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return shops.map((shop) => ({
      id: shop.id,
      subdomain: shop.subdomain,
      name: shop.name,
      logoUrl: shop.theme?.logoUrl || undefined,
    }))
  } catch (error) {
    console.error('Failed to get related shops:', error)
    return []
  }
}

// Shop 정보 조회
async function getShopFromHeaders(): Promise<ShopInfo | null> {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  const shopSlug = headersList.get('x-shop-slug')

  if (!shopId) return null

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: parseInt(shopId) },
      select: {
        id: true,
        userId: true,
        subdomain: true,
        name: true,
        coverUrl: true,
        freeShippingAmount: true,
        defaultShippingFee: true,
        contactPhone: true,
        contactEmail: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
        theme: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            logoUrl: true,
            faviconUrl: true,
            bannerUrl: true,
          },
        },
      },
    })

    if (!shop) return null

    return {
      id: shop.id,
      subdomain: shop.subdomain,
      name: shop.name,
      coverUrl: shop.coverUrl || undefined,
      freeShippingAmount: shop.freeShippingAmount || undefined,
      defaultShippingFee: shop.defaultShippingFee || undefined,
      contactPhone: shop.contactPhone || undefined,
      contactEmail: shop.contactEmail || undefined,
      bankInfo: shop.bankName
        ? {
            bankName: shop.bankName,
            bankAccount: shop.bankAccount!,
            accountHolder: shop.accountHolder!,
          }
        : undefined,
      theme: shop.theme
        ? {
            primaryColor: shop.theme.primaryColor || undefined,
            secondaryColor: shop.theme.secondaryColor || undefined,
            logoUrl: shop.theme.logoUrl || undefined,
            faviconUrl: shop.theme.faviconUrl || undefined,
            bannerUrl: shop.theme.bannerUrl || undefined,
          }
        : undefined,
      relatedShops: await getRelatedShops(shop.id, shop.userId),
    }
  } catch (error) {
    console.error('Failed to get shop from headers:', error)
    return null
  }
}

// 동적 메타데이터 생성
export async function generateMetadata() {
  const shop = await getShopFromHeaders()

  const title = shop
    ? `${shop.name} - 신선한 농수산물 직거래 쇼핑몰`
    : 'ABC마켓 - 신선한 농수산물 직거래 쇼핑몰'

  // favicon 설정
  const faviconUrl = shop?.theme?.faviconUrl
  const icons = faviconUrl
    ? {
        icon: faviconUrl,
        shortcut: faviconUrl,
        apple: faviconUrl,
      }
    : undefined

  return {
    title,
    description: '신선한 농수산물을 합리적인 가격에 만나보세요!',
    icons,
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const shop = await getShopFromHeaders()

  return (
    <ShopProvider initialShop={shop}>
      <ThemeProvider>
        <StoreLayout>{children}</StoreLayout>
      </ThemeProvider>
    </ShopProvider>
  )
}
