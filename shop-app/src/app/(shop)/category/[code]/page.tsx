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

// 카테고리별 SEO 키워드 — 구글/네이버 검색 노출 최적화
const CATEGORY_SEO: Record<string, { keywords: string; desc: string }> = {
  SEA: { keywords: '수산물, 해산물, 횟감, 생선, 회, 전복, 참치, 대게, 킹크랩, 갈치, 고등어, 오징어, 새우, 산지직송', desc: '산지직송 신선한 수산물과 횟감을 합리적인 가격에 만나보세요.' },
  AGR: { keywords: '농산물, 과일, 채소, 사과, 딸기, 귤, 한라봉, 수박, 포도, 복숭아, 감자, 고구마, 산지직송', desc: '산지직송 신선한 농산물과 제철 과일을 만나보세요.' },
  MEA: { keywords: '축산물, 한우, 소고기, 돼지고기, 닭고기, 한우선물세트, 등심, 갈비, 삼겹살, 목살', desc: '최상급 한우와 신선한 축산물을 산지직송으로 만나보세요.' },
  MKT: { keywords: '밀키트, 반찬, 간편식, 가정간편식, HMR, 도시락, 국, 찌개, 볶음, 조림', desc: '간편하고 맛있는 밀키트와 반찬을 만나보세요.' },
  PRC: { keywords: '가공식품, 김, 젓갈, 장류, 소스, 양념, 통조림, 식품', desc: '엄선된 가공식품과 전통 식품을 만나보세요.' },
  HLT: { keywords: '건강식품, 홍삼, 꿀, 견과류, 비타민, 프로바이오틱스, 건강즙', desc: '건강을 위한 프리미엄 건강식품을 만나보세요.' },
  COM: { keywords: '상시상품, 베스트셀러, 인기상품, 추천상품, 특가, 할인', desc: '항상 만날 수 있는 인기 상시 판매 상품입니다.' },
  ETC: { keywords: '식품, 추천상품, 특가상품, 선물세트, 명절선물', desc: '다양한 추천 식품과 선물세트를 만나보세요.' },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = params.code?.toUpperCase()
  if (!isCategoryCode(code)) {
    return { title: '카테고리를 찾을 수 없습니다' }
  }
  const cat = CATEGORY_MAP[code]
  const seo = CATEGORY_SEO[code] || { keywords: cat.name, desc: `${cat.name} 상품을 만나보세요.` }
  const shop = await getShopFromHeaders()
  const shopName = shop?.name || '가족함께'
  const title = `${cat.name} - ${shopName} | 신선한 ${cat.name} 산지직송`
  const description = `${shopName}의 ${seo.desc} ${seo.keywords.split(',').slice(0, 5).join(', ')} 등 다양한 상품을 합리적인 가격에!`
  const ogImage = shop?.theme?.bannerUrl || shop?.theme?.logoUrl || undefined
  return {
    title,
    description,
    keywords: seo.keywords.split(', '),
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
      type: 'website',
      siteName: shopName,
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
