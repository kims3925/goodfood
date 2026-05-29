import { Metadata } from 'next'
import { headers } from 'next/headers'
import prisma from '@bandauto/db'
import ProductDetailClient from './ProductDetailClient'

type Props = {
  params: { id: string }
}

async function getProduct(id: string) {
  try {
    const productId = parseInt(id)
    if (isNaN(productId)) return null

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 3,
        },
      },
    })

    return product
  } catch (error) {
    console.error('Failed to fetch product for metadata:', error)
    return null
  }
}

// 현재 요청의 Shop 이름 조회 (미들웨어가 설정한 x-shop-id 헤더 기반)
async function getShopName(): Promise<string> {
  const fallback = '가족함께'
  try {
    const shopId = headers().get('x-shop-id')
    if (!shopId) return fallback

    const shop = await prisma.shop.findUnique({
      where: { id: parseInt(shopId) },
      select: { name: true },
    })

    return shop?.name || fallback
  } catch (error) {
    console.error('Failed to resolve shop name:', error)
    return fallback
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id)

  if (!product) {
    return {
      title: '상품을 찾을 수 없습니다',
    }
  }

  const shopName = await getShopName()
  const title = `${product.name} - ${shopName}`
  const description =
    product.description?.slice(0, 155) ||
    `${product.name} - ${shopName}에서 신선한 식품을 산지직송으로 만나보세요.`
  const price = product.variants[0]?.price || product.price

  // 대표 이미지 (최대 3장)
  const mainImage =
    product.images?.[0]?.url ||
    product.thumbnailUrl ||
    '/images/placeholder.png'
  const ogImages = product.images?.length
    ? product.images.map((img) => ({
        url: img.url,
        width: 800,
        height: 800,
        alt: product.name,
      }))
    : [{ url: mainImage, width: 800, height: 800, alt: product.name }]

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImages,
      type: 'website',
      siteName: shopName,
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [mainImage],
    },
  }
}

/**
 * 상품 JSON-LD 구조화 데이터 (Product + Offer)
 * 구글 검색결과에 가격/재고 리치 스니펫 노출
 */
async function ProductJsonLd({ id }: { id: string }) {
  const product = await getProduct(id)
  if (!product) return null

  const price = product.variants[0]?.price || product.price || 0
  const mainImage =
    product.images?.[0]?.url ||
    product.thumbnailUrl ||
    '/images/placeholder.png'
  const shopName = await getShopName()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://familyshop.kr'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} - ${shopName} 산지직송`,
    image: product.images?.map((img) => img.url) || [mainImage],
    brand: {
      '@type': 'Brand',
      name: shopName,
    },
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/product/${product.id}`,
      priceCurrency: 'KRW',
      price: price,
      availability: product.isActive
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: shopName,
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default function ProductDetailPage({ params }: Props) {
  return (
    <>
      <ProductJsonLd id={params.id} />
      <ProductDetailClient />
    </>
  )
}
