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
        contactPhone: true,
        contactEmail: true,
        ownerName: true,
        businessNumber: true,
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
      contactPhone: shop.contactPhone || undefined,
      contactEmail: shop.contactEmail || undefined,
      ownerName: shop.ownerName || undefined,
      businessNumber: shop.businessNumber || undefined,
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

  const shopName = shop?.name || '가족함께'
  const title = `${shopName} - 신선한 수산물 농수산물 횟감 과일 한우 밀키트 산지직송`
  const description = `${shopName}에서 신선한 수산물, 횟감, 과일, 한우, 밀키트, 농수산물, 축산물을 산지직송으로 만나보세요. 매일 경매로 엄선한 최상급 식품을 합리적인 가격에!`

  // favicon 설정
  const faviconUrl = shop?.theme?.faviconUrl
  const icons = faviconUrl
    ? {
        icon: faviconUrl,
        shortcut: faviconUrl,
        apple: faviconUrl,
      }
    : undefined

  const logoUrl = shop?.theme?.logoUrl
  const bannerUrl = shop?.theme?.bannerUrl

  return {
    title,
    description,
    icons,
    openGraph: {
      title,
      description,
      siteName: shopName,
      locale: 'ko_KR',
      type: 'website',
      images: bannerUrl || logoUrl
        ? [{ url: bannerUrl || logoUrl!, alt: shopName }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: bannerUrl || logoUrl ? [bannerUrl || logoUrl!] : undefined,
    },
  }
}

/**
 * 구조화 데이터 JSON-LD — Organization + WebSite + BreadcrumbList
 * 구글 검색결과에 사이트링크, 검색박스, 로고 등 리치 스니펫 노출
 */
function ShopJsonLd({ shop }: { shop: ShopInfo | null }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'
  const shopName = shop?.name || '가족함께'
  const logoUrl = shop?.theme?.logoUrl || `${siteUrl}/logo.png`

  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: shopName,
    url: siteUrl,
    logo: logoUrl,
    description:
      '신선한 수산물, 횟감, 과일, 한우, 밀키트, 농수산물, 축산물을 산지직송으로 판매하는 온라인 쇼핑몰',
    contactPoint: shop?.contactPhone
      ? {
          '@type': 'ContactPoint',
          telephone: shop.contactPhone,
          contactType: 'customer service',
          availableLanguage: 'Korean',
        }
      : undefined,
  }

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: shopName,
    url: siteUrl,
    description:
      '신선한 수산물, 횟감, 과일, 한우, 밀키트를 산지직송으로 만나보세요.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/main?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '홈',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '수산물',
        item: `${siteUrl}/category/SEA`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: '농산물',
        item: `${siteUrl}/category/AGR`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: '축산물',
        item: `${siteUrl}/category/MEA`,
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: '밀키트/반찬',
        item: `${siteUrl}/category/MKT`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  )
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
        <ShopJsonLd shop={shop} />
        <StoreLayout>{children}</StoreLayout>
      </ThemeProvider>
    </ShopProvider>
  )
}
