import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import prisma from '@bandauto/db'
import { CATEGORY_MAP, isCategoryCode, type CategoryCode } from '@/lib/categories'
import CategoryClient from './CategoryClient'

type Props = {
  params: { code: string }
}

async function getShopFromHeaders() {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  const shopSlug = headersList.get('x-shop-slug')
  if (!shopId) return null
  const shop = await prisma.shop.findUnique({
    where: { id: parseInt(shopId) },
    select: {
      id: true,
      subdomain: true,
      name: true,
      theme: { select: { bannerUrl: true, logoUrl: true } },
    },
  })
  if (!shop) return null
  return { ...shop, slug: shopSlug || shop.subdomain }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = params.code?.toUpperCase()
  if (!isCategoryCode(code)) {
    return { title: '카테고리를 찾을 수 없습니다' }
  }
  const cat = CATEGORY_MAP[code]
  const shop = await getShopFromHeaders()
  const shopName = shop?.name || '쇼핑몰'
  const title = `${cat.emoji} ${cat.name} - ${shopName}`
  const description = `${shopName}의 ${cat.name} 상품을 만나보세요.`
  const ogImage = shop?.theme?.bannerUrl || shop?.theme?.logoUrl || undefined
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
      type: 'website',
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const codeRaw = params.code
  const code = codeRaw?.toUpperCase()
  if (!isCategoryCode(code)) {
    notFound()
  }

  const cat = CATEGORY_MAP[code as CategoryCode]
  return <CategoryClient categoryCode={code as CategoryCode} categoryMeta={cat} />
}
